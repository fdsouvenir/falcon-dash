// Engineering-only, explicit offline conversion. Never a tool, native RPC or startup import.
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Vault } from './service.mjs';
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function privateFile(file) {
	const stat = fs.lstatSync(file);
	if (
		!path.isAbsolute(file) ||
		fs.realpathSync(file) !== file ||
		!stat.isFile() ||
		stat.nlink !== 1 ||
		stat.mode & 0o077 ||
		stat.size > 64 * 1024 * 1024
	)
		throw Error('Legacy source must be a private bounded regular file');
}
function attribute(database, key, entry, name) {
	const result = spawnSync(
		'keepassxc-cli',
		['show', '-q', '--no-password', '--key-file', key, '-s', '-a', name, database, entry],
		{ encoding: 'utf8', maxBuffer: 1048576, timeout: 30000 }
	);
	if (result.status !== 0) throw Error('Reviewed legacy entry is unavailable');
	return result.stdout.replace(/\n$/, '');
}
const uuid = (value) => String(value).replace(/[-{}]/g, '').toLowerCase();
export async function importLegacyVault({
	database,
	key_file,
	expected_sha256,
	target,
	owners,
	entries,
	quiesced = false,
	archive_unmapped = false
}) {
	if (!quiesced || !archive_unmapped)
		throw Error('Explicit offline source and archival disposition required');
	privateFile(database);
	privateFile(key_file);
	if (!/^[a-f0-9]{64}$/.test(expected_sha256 ?? '') || hash(database) !== expected_sha256)
		throw Error('Legacy database changed since review');
	if (!path.isAbsolute(target) || path.resolve(target) !== target || fs.existsSync(target))
		throw Error('Legacy import requires a new absolute destination');
	const parent = path.dirname(target);
	if (fs.realpathSync(parent) !== parent || fs.statSync(parent).mode & 0o077)
		throw Error('Import parent must be private and canonical');
	if (
		!Array.isArray(owners) ||
		!owners.length ||
		owners.some((owner) => typeof owner !== 'string' || !/^human:[A-Za-z0-9_-]{1,128}$/.test(owner))
	)
		throw Error('Reviewed human owner mapping is required');
	if (!Array.isArray(entries) || !entries.length || entries.length > 1000)
		throw Error('Explicit bounded entry mappings are required');
	const targets = new Set(),
		identities = new Set();
	for (const entry of entries) {
		if (
			typeof entry.source_path !== 'string' ||
			!entry.source_path ||
			entry.source_path.startsWith('-') ||
			[...entry.source_path].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
			entry.source_path.length > 512 ||
			!/^[a-f0-9]{32}$/.test(uuid(entry.source_uuid)) ||
			!/^([a-zA-Z0-9_-]{1,80}\/){0,4}[a-zA-Z0-9_-]{1,80}$/.test(entry.target_id) ||
			targets.has(entry.target_id) ||
			identities.has(uuid(entry.source_uuid))
		)
			throw Error('Invalid or duplicate reviewed entry identity');
		targets.add(entry.target_id);
		identities.add(uuid(entry.source_uuid));
		const fields = Object.entries(entry.fields ?? {});
		if (
			!fields.length ||
			fields.length > 20 ||
			fields.some(
				([field, source]) =>
					!/^[a-z_]{1,80}$/.test(field) ||
					!['Password', 'UserName', 'URL', 'Notes'].includes(source)
			)
		)
			throw Error('Explicit protected attribute mapping required');
	}
	const archive = path.join(parent, 'legacy-archive-' + randomUUID());
	fs.mkdirSync(archive, { mode: 0o700 });
	const archivedDb = path.join(archive, 'credentials.kdbx'),
		archivedKey = path.join(archive, 'unlock.key');
	const keyHash = hash(key_file);
	fs.copyFileSync(database, archivedDb, fs.constants.COPYFILE_EXCL);
	fs.copyFileSync(key_file, archivedKey, fs.constants.COPYFILE_EXCL);
	for (const file of [archivedDb, archivedKey]) fs.chmodSync(file, 0o600);
	if (
		hash(archivedDb) !== expected_sha256 ||
		hash(archivedKey) !== keyHash ||
		hash(database) !== expected_sha256 ||
		hash(key_file) !== keyHash
	)
		throw Error('Legacy source changed during snapshot');
	fs.mkdirSync(target, { mode: 0o700 });
	const vault = new Vault(target, { owners, executors: [] });
	let success = false;
	try {
		await vault.initialize(owners[0]);
		await vault.unlock(owners[0]);
		const groups = new Set();
		const mapping = [];
		for (const entry of entries) {
			if (
				uuid(attribute(archivedDb, archivedKey, entry.source_path, 'Uuid')) !==
				uuid(entry.source_uuid)
			)
				throw Error('Legacy entry identity differs from reviewed UUID');
			const material = Object.create(null);
			for (const [field, source] of Object.entries(entry.fields)) {
				material[field] = attribute(archivedDb, archivedKey, entry.source_path, source);
				if (material[field].length > 65536)
					throw Error('Legacy attribute exceeds protected field limit');
			}
			const parts = entry.target_id.split('/').slice(0, -1);
			for (let i = 1; i <= parts.length; i++) {
				const group = parts.slice(0, i).join('/');
				if (!groups.has(group)) {
					await vault.createGroup(group, owners[0]);
					groups.add(group);
				}
			}
			await vault.create(entry.target_id, material, owners[0]);
			mapping.push({ source_uuid: entry.source_uuid, target_id: entry.target_id });
		}
		await vault.lock(owners[0]);
		if (hash(database) !== expected_sha256 || hash(key_file) !== keyHash)
			throw Error('Legacy source changed during conversion');
		const report = {
			source_sha256: expected_sha256,
			converted: mapping.length,
			mapping,
			unmapped: 'Preserved only in original encrypted archive',
			archive,
			locked: true,
			execution_grants: 0
		};
		fs.writeFileSync(path.join(archive, 'conversion.json'), JSON.stringify(report), {
			mode: 0o600,
			flag: 'wx'
		});
		success = true;
		return report;
	} finally {
		if (!success) {
			try {
				await vault.lock();
			} catch {
				/* No old source is modified during cleanup. */
			}
			fs.rmSync(target, { recursive: true, force: true });
		}
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv.length !== 3)
		throw Error('Usage: node migration.mjs <private-reviewed-plan.json>');
	console.log(
		JSON.stringify(await importLegacyVault(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))))
	);
}
