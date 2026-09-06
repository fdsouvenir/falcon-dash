// Invoked under flock. stdin/stdout are private pipes owned by the Vault service.
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
const directory = process.argv[2];
const database = path.join(directory, 'credentials.kdbx'),
	key = path.join(directory, 'unlock.key');
function cli(args, input = '') {
	const result = spawnSync('keepassxc-cli', args, {
		input,
		encoding: 'utf8',
		maxBuffer: 1048576,
		timeout: 30000
	});
	if (result.status !== 0) throw new Error('vault_operation_failed');
	return result.stdout;
}
try {
	const request = JSON.parse(fs.readFileSync(0, 'utf8'));
	if (request.action === 'initialize') {
		if (fs.existsSync(database)) throw new Error('already_initialized');
		if (fs.existsSync(key)) throw new Error('recovery_required');
		fs.writeFileSync(key, randomBytes(32), { mode: 0o600, flag: 'wx' });
		cli(['db-create', '-q', '--set-key-file', key, database]);
		fs.chmodSync(database, 0o600);
		process.stdout.write(JSON.stringify({ initialized: true }));
	} else {
		const id = request.id;
		if (id && !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('invalid_handle');
		const args = ['-q', '--no-password', '--key-file', key];
		if (request.action === 'inventory') {
			const names = cli(['ls', ...args, database])
				.trim()
				.split('\n')
				.filter((x) => /^[a-zA-Z0-9_-]{1,80}$/.test(x));
			process.stdout.write(JSON.stringify({ entries: names.map((id) => ({ id })) }));
		} else {
			let current = null;
			if (request.action !== 'create')
				current = JSON.parse(cli(['show', ...args, '-s', '-a', 'Password', database, id]));
			if (request.action === 'resolve') process.stdout.write(JSON.stringify(current));
			else {
				if (request.action !== 'create' && request.expected_version !== current.version)
					throw new Error('version_conflict');
				const material =
					request.action === 'rotate'
						? { ...current.material, ...request.material }
						: request.material;
				const next = { version: (current?.version ?? 0) + 1, material };
				const temp = path.join(directory, `transaction-${randomUUID()}.kdbx`);
				try {
					fs.copyFileSync(database, temp, fs.constants.COPYFILE_EXCL);
					fs.chmodSync(temp, 0o600);
					cli(
						[request.action === 'create' ? 'add' : 'edit', ...args, '-p', temp, id],
						JSON.stringify(next) + '\n'
					);
					// Validate both values from the written encrypted snapshot before publishing it.
					const check = JSON.parse(cli(['show', ...args, '-s', '-a', 'Password', temp, id]));
					if (JSON.stringify(check) !== JSON.stringify(next))
						throw new Error('verification_failed');
					const fd = fs.openSync(temp, 'r');
					fs.fsyncSync(fd);
					fs.closeSync(fd);
					fs.renameSync(temp, database);
					const dir = fs.openSync(directory, 'r');
					fs.fsyncSync(dir);
					fs.closeSync(dir);
					process.stdout.write(JSON.stringify({ id, version: next.version }));
				} finally {
					try {
						fs.unlinkSync(temp);
					} catch (e) {
						if (e.code !== 'ENOENT') process.emitWarning('Temporary file cleanup failed');
					}
				}
			}
		}
	}
} catch (error) {
	const safe = [
		'version_conflict',
		'already_initialized',
		'recovery_required',
		'invalid_handle'
	].includes(error.message)
		? error.message
		: 'vault_unavailable';
	process.stdout.write(JSON.stringify({ error: safe }));
	process.exitCode = 1;
}
