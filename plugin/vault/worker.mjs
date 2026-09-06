import { DatabaseSync } from 'node:sqlite';
// Invoked under flock. stdin/stdout are private pipes owned by the Vault service.
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
const directory = process.argv[2];
const database = path.join(directory, 'credentials.kdbx'),
	key = path.join(directory, 'unlock.key');
const policyPath = path.join(directory, 'policy.json');
function policyWrite(policy) {
	const temp = path.join(directory, `policy-${randomUUID()}.tmp`);
	fs.writeFileSync(temp, JSON.stringify(policy), { mode: 0o600, flag: 'wx' });
	const fd = fs.openSync(temp, 'r');
	fs.fsyncSync(fd);
	fs.closeSync(fd);
	fs.renameSync(temp, policyPath);
}
function mutateDatabase(change) {
	const temp = path.join(directory, `transaction-${randomUUID()}.kdbx`);
	try {
		fs.copyFileSync(database, temp, fs.constants.COPYFILE_EXCL);
		fs.chmodSync(temp, 0o600);
		change(temp);
		const fd = fs.openSync(temp, 'r');
		fs.fsyncSync(fd);
		fs.closeSync(fd);
		fs.renameSync(temp, database);
		const dir = fs.openSync(directory, 'r');
		fs.fsyncSync(dir);
		fs.closeSync(dir);
	} finally {
		fs.rmSync(temp, { force: true });
	}
}
function authorize(policy, actor, owner = false) {
	if (!policy.owners.includes(actor) && (owner || !policy.executors.includes(actor)))
		throw new Error('access_denied');
}
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
let auditDb, operation, requestMeta;
function audit(outcome) {
	if (!auditDb || !operation) return;
	auditDb
		.prepare(
			'INSERT INTO access_events(operation,action,entry_id,actor,at,outcome) VALUES(?,?,?,?,?,?)'
		)
		.run(operation, requestMeta.action, requestMeta.entry, requestMeta.actor, Date.now(), outcome);
}
function reply(value) {
	const denied = ['access_denied', 'vault_locked', 'authority_changed'];
	audit(
		value.error
			? denied.includes(value.error)
				? 'denied'
				: `failed:${value.error}`
			: value.errors && Object.keys(value.errors).length
				? Object.keys(value.values ?? {}).length
					? 'partial'
					: 'denied'
				: 'resolved'
	);
	auditDb?.close();
	auditDb = undefined;
	process.stdout.write(JSON.stringify(value));
}
let guardDb;
try {
	const request = JSON.parse(fs.readFileSync(0, 'utf8'));
	auditDb = new DatabaseSync(path.join(directory, 'audit.db'));
	fs.chmodSync(path.join(directory, 'audit.db'), 0o600);
	auditDb.exec(
		"PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS access_events(seq INTEGER PRIMARY KEY,operation TEXT NOT NULL,action TEXT NOT NULL,entry_id TEXT,actor TEXT NOT NULL,at INTEGER NOT NULL,outcome TEXT NOT NULL) STRICT;CREATE TRIGGER IF NOT EXISTS access_events_no_update BEFORE UPDATE ON access_events BEGIN SELECT RAISE(ABORT,'immutable_audit');END;CREATE TRIGGER IF NOT EXISTS access_events_no_delete BEFORE DELETE ON access_events BEGIN SELECT RAISE(ABORT,'immutable_audit');END;"
	);
	const known = new Set([
		'initialize',
		'lock',
		'unlock',
		'inventory',
		'create',
		'rotate',
		'resolve',
		'metadata',
		'group_create',
		'grant_secretrefs',
		'revoke_secretrefs',
		'resolve_refs',
		'revoke_entry',
		'restore_entry',
		'grant_executors',
		'audit'
	]);
	requestMeta = {
		action:
			request.action === 'resolve' && request.human
				? request.purpose === 'copy'
					? 'human_copy'
					: 'human_reveal'
				: known.has(request.action)
					? request.action
					: 'unknown',
		entry:
			typeof request.id === 'string' && /^[a-zA-Z0-9_/-]{1,400}$/.test(request.id)
				? request.id
				: null,
		actor:
			typeof request.actor === 'string' &&
			/^(human|agent|service|system):/.test(request.actor) &&
			request.actor.length <= 256
				? request.actor
				: request.action === 'resolve_refs'
					? 'runtime:secretref'
					: 'system:vault'
	};
	if (!known.has(request.action)) throw new Error('invalid_action');
	if (request.action !== 'audit') {
		operation = randomUUID();
		audit('attempt');
	}

	if (request.action === 'initialize') {
		if (fs.existsSync(database)) throw new Error('already_initialized');
		if (fs.existsSync(key)) throw new Error('recovery_required');
		fs.writeFileSync(key, randomBytes(32), { mode: 0o600, flag: 'wx' });
		cli(['db-create', '-q', '--set-key-file', key, database]);
		fs.chmodSync(database, 0o600);
		policyWrite({
			owners: request.owners,
			executors: request.executors,
			locked: true,
			generation: 1,
			secretref_ids: []
		});
		reply({ initialized: true });
	} else {
		const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
		if (request.action === 'audit') {
			authorize(policy, request.actor, true);
			const limit = request.limit ?? 25,
				before = request.before ?? Number.MAX_SAFE_INTEGER;
			if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(before))
				throw new Error('invalid_handle');
			const rows = auditDb
				.prepare('SELECT * FROM access_events WHERE seq<? ORDER BY seq DESC LIMIT ?')
				.all(before, limit);
			reply({ entries: rows, next_before: rows.length === limit ? rows.at(-1).seq : null });
			process.exit(0);
		}

		if (request.action === 'lock') {
			if (request.actor !== 'system:vault') authorize(policy, request.actor, true);
			policy.locked = true;
			policy.generation++;
			policyWrite(policy);
			reply({ locked: true, generation: policy.generation });
			process.exit(0);
		}
		if (request.action === 'unlock') {
			authorize(policy, request.actor, true);
			policy.locked = false;
			policy.generation++;
			policyWrite(policy);
			reply({ locked: false, generation: policy.generation });
			process.exit(0);
		}
		if (policy.locked) throw new Error('vault_locked');
		if (request.action !== 'resolve_refs') {
			authorize(policy, request.actor);
			if (request.generation !== undefined && request.generation !== policy.generation)
				throw new Error('authority_changed');
		}
		if (request.action === 'grant_secretrefs' || request.action === 'revoke_secretrefs') {
			authorize(policy, request.actor, true);
			if (!Array.isArray(request.ids) || request.ids.length > 100)
				throw new Error('invalid_handle');
			if (
				!request.ids.every(
					(id) =>
						typeof id === 'string' &&
						/^entries\/((?:[a-z][a-z0-9-]{0,79}\/){0,4}[a-z][a-z0-9-]{0,79})\/(password|api-key|access-token|refresh-token|client-secret)$/.test(
							id
						)
				)
			)
				throw new Error('invalid_handle');
			const beforeCount = policy.secretref_ids.length;
			policy.secretref_ids =
				request.action === 'grant_secretrefs'
					? [...new Set([...policy.secretref_ids, ...request.ids])]
					: policy.secretref_ids.filter((id) => !request.ids.includes(id));
			policyWrite(policy);
			reply({
				granted: Math.max(0, policy.secretref_ids.length - beforeCount),
				revoked: Math.max(0, beforeCount - policy.secretref_ids.length),
				total: policy.secretref_ids.length
			});
			process.exit(0);
		}
		if (request.action === 'resolve_refs') {
			if (!Array.isArray(request.ids) || request.ids.length > 50) throw new Error('invalid_handle');
			const values = {},
				errors = {};
			for (const id of request.ids) {
				try {
					if (typeof id !== 'string' || !policy.secretref_ids.includes(id))
						throw new Error('access_denied');
					const match =
						/^entries\/((?:[a-z][a-z0-9-]{0,79}\/){0,4}[a-z][a-z0-9-]{0,79})\/(password|api-key|access-token|refresh-token|client-secret)$/.exec(
							id
						);
					if (!match) throw new Error('invalid_handle');
					const record = JSON.parse(
						cli([
							'show',
							'-q',
							'--no-password',
							'--key-file',
							key,
							'-s',
							'-a',
							'Password',
							database,
							match[1]
						])
					);
					if (record.revoked) throw new Error('access_denied');
					const value = record.material[match[2].replaceAll('-', '_')];
					if (typeof value !== 'string' || !value.length) throw new Error('not_found');
					auditDb
						.prepare(
							'INSERT INTO access_events(operation,action,entry_id,actor,at,outcome) VALUES(?,?,?,?,?,?)'
						)
						.run(operation, 'resolve_ref', match[1], 'runtime:secretref', Date.now(), 'resolved');
					values[id] = value;
				} catch {
					errors[id] = { code: 'NOT_FOUND' };
				}
			}
			reply({ protocolVersion: 1, values, errors });
			process.exit(0);
		}
		const id = request.id;
		if (id && !/^[a-zA-Z0-9_-]{1,80}(?:\/[a-zA-Z0-9_-]{1,80}){0,4}$/.test(id))
			throw new Error('invalid_handle');
		const args = ['-q', '--no-password', '--key-file', key];
		if (request.action === 'group_create') {
			authorize(policy, request.actor, true);
			if (!id) throw new Error('invalid_handle');
			mutateDatabase((temp) => {
				cli(['mkdir', ...args, temp, id]);
				cli(['ls', ...args, temp, id]);
			});
			reply({ id, kind: 'group' });
			process.exit(0);
		}
		if (request.action === 'inventory') {
			const group = request.group ?? '';
			if (group && !/^[a-zA-Z0-9_-]{1,80}(?:\/[a-zA-Z0-9_-]{1,80}){0,4}$/.test(group))
				throw new Error('invalid_handle');
			const names = cli(['ls', ...args, database, ...(group ? [group] : [])])
				.trim()
				.split('\n')
				.filter((x) => /^[a-zA-Z0-9_-]{1,80}\/?$/.test(x));
			reply({
				entries: names.map((name) => ({
					id: (group ? group + '/' : '') + name.replace(/\/$/, ''),
					kind: name.endsWith('/') ? 'group' : 'entry'
				}))
			});
		} else {
			let current = null;
			if (request.action !== 'create')
				current = JSON.parse(cli(['show', ...args, '-s', '-a', 'Password', database, id]));
			if (request.action === 'metadata') {
				reply({
					id,
					version: current.version,
					execution_disabled: !!current.revoked,
					created_by: current.created_by ?? null,
					allowed_executors: current.allowed_executors ?? [],
					execution_policy_review_required: !Array.isArray(current.allowed_executors)
				});
				process.exit(0);
			}
			if (current && !policy.owners.includes(request.actor)) {
				const allowed =
					current.allowed_executors ?? (current.created_by ? [current.created_by] : []);
				if (current.revoked || !allowed.includes(request.actor)) throw new Error('access_denied');
			}
			if (['revoke_entry', 'restore_entry', 'grant_executors'].includes(request.action))
				authorize(policy, request.actor, true);
			if (request.action === 'resolve') {
				if (request.human) authorize(policy, request.actor, true);
				reply(current);
			} else {
				if (request.action !== 'create' && request.expected_version !== current.version)
					throw new Error('version_conflict');
				if (request.guard) {
					if (request.guard.database !== path.join(path.dirname(directory), 'integrations.db'))
						throw new Error('access_denied');
					guardDb = new DatabaseSync(request.guard.database);
					guardDb.exec('PRAGMA busy_timeout=5000;BEGIN IMMEDIATE');
					const row = guardDb
						.prepare('SELECT version,body FROM connections WHERE id=?')
						.get(request.guard.id);
					const connection = row ? JSON.parse(String(row.body)) : null;
					if (
						!row ||
						row.version !== request.guard.version ||
						connection.phase !== request.guard.phase ||
						connection.disconnected ||
						connection.paused ||
						!connection.actors.includes(request.actor)
					)
						throw new Error('authority_changed');
				}
				const material =
					request.action === 'rotate'
						? { ...current.material, ...request.material }
						: ['revoke_entry', 'restore_entry', 'grant_executors'].includes(request.action)
							? current.material
							: request.material;
				if (
					request.action === 'grant_executors' &&
					(!Array.isArray(request.executors) ||
						request.executors.length > 25 ||
						!request.executors.every((x) => policy.executors.includes(x)))
				)
					throw new Error('access_denied');
				const next = {
					...(current ?? {}),
					version: (current?.version ?? 0) + 1,
					material,
					created_by: current?.created_by ?? request.actor,
					allowed_executors:
						request.action === 'grant_executors'
							? [...new Set(request.executors)]
							: (current?.allowed_executors ??
								(policy.executors.includes(request.actor) ? [request.actor] : [])),
					revoked:
						request.action === 'revoke_entry'
							? true
							: request.action === 'restore_entry'
								? false
								: (current?.revoked ?? false)
				};
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
					if (guardDb) {
						guardDb.exec('COMMIT');
						guardDb.close();
						guardDb = undefined;
					}
					reply({ id, version: next.version });
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
	if (guardDb) {
		try {
			guardDb.exec('ROLLBACK');
		} finally {
			guardDb.close();
		}
	}
	const safe = [
		'version_conflict',
		'already_initialized',
		'recovery_required',
		'invalid_handle',
		'invalid_action',
		'access_denied',
		'vault_locked',
		'authority_changed'
	].includes(error.message)
		? error.message
		: 'vault_unavailable';
	try {
		reply({ error: safe });
	} catch {
		auditDb?.close();
		process.stdout.write(JSON.stringify({ error: 'vault_unavailable' }));
	}
	process.exitCode = 1;
}
