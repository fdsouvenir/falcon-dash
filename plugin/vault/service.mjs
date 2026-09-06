import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DomainError, requireValue } from '../errors.mjs';

export class Vault {
	constructor(directory, { owners = [], executors = [] } = {}) {
		requireValue(
			path.isAbsolute(directory),
			'invalid_config',
			'Vault requires an explicit private directory'
		);
		fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
		requireValue(
			fs.realpathSync(directory) === directory,
			'unsafe_path',
			'Vault path must not contain symbolic links'
		);
		fs.chmodSync(directory, 0o700);
		this.directory = directory;
		this.owners = new Set(owners);
		this.executors = new Set(executors);
		this.locked = true;
		this.generation = 0;
	}
	lock(actor = 'system:vault') {
		this.locked = true;
		this.generation++;
		if (!fs.existsSync(path.join(this.directory, 'policy.json')))
			return Promise.resolve({ locked: true });
		return this.worker({ action: 'lock', actor });
	}
	authorize(actor, human = false) {
		requireValue(!this.locked, 'vault_locked', 'Unlock Vault before use');
		requireValue(
			human
				? this.owners.has(actor) && actor.startsWith('human:')
				: this.executors.has(actor) || this.owners.has(actor),
			'access_denied',
			'Credential access is not authorized'
		);
	}
	async worker(request) {
		const result = await new Promise((resolve, reject) => {
			const child = spawn(
				'flock',
				[
					'--exclusive',
					'--timeout',
					'15',
					path.join(this.directory, 'transaction.lock'),
					process.execPath,
					fileURLToPath(new URL('./worker.mjs', import.meta.url)),
					this.directory
				],
				{ stdio: ['pipe', 'pipe', 'pipe'] }
			);
			let output = '',
				size = 0;
			const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
			child.stdout.on('data', (chunk) => {
				size += chunk.length;
				if (size > 1048576) child.kill('SIGKILL');
				else output += chunk;
			});
			child.stderr.resume();
			child.on('error', () => {
				clearTimeout(timer);
				reject(new DomainError('vault_unavailable', 'Protected storage is unavailable'));
			});
			child.on('close', () => {
				clearTimeout(timer);
				try {
					const data = JSON.parse(output);
					if (data.error) reject(new DomainError(data.error, 'Protected storage operation failed'));
					else resolve(data);
				} catch {
					reject(new DomainError('vault_unavailable', 'Protected storage is unavailable'));
				}
			});
			child.stdin.on('error', () => {});
			child.stdin.end(JSON.stringify(request));
		});
		return result;
	}
	async initialize(actor) {
		requireValue(
			this.owners.has(actor) && actor.startsWith('human:'),
			'access_denied',
			'Only an authorized human can provision Vault'
		);
		return this.worker({
			action: 'initialize',
			actor,
			owners: [...this.owners],
			executors: [...this.executors]
		});
	}
	async unlock(actor) {
		requireValue(
			this.owners.has(actor) && actor.startsWith('human:'),
			'access_denied',
			'Only an authorized human can unlock Vault'
		);
		const epoch = ++this.generation;
		const result = await this.worker({ action: 'unlock', actor });
		requireValue(
			this.generation === epoch,
			'authority_changed',
			'Vault locked while unlock was pending'
		);
		this.policyGeneration = result.generation;
		this.locked = false;
		return { locked: false };
	}
	async inventory(actor, group = '') {
		this.authorize(actor);
		return this.worker({ action: 'inventory', actor, group, generation: this.policyGeneration });
	}
	async metadata(id, actor) {
		this.authorize(actor);
		return this.worker({ action: 'metadata', id, actor, generation: this.policyGeneration });
	}
	async grantEntryExecutors(id, expected_version, executors, actor) {
		this.authorize(actor, true);
		return this.worker({
			action: 'grant_executors',
			id,
			expected_version,
			executors,
			actor,
			generation: this.policyGeneration
		});
	}

	async revokeEntryExecution(id, expected_version, actor) {
		this.authorize(actor, true);
		return this.worker({
			action: 'revoke_entry',
			id,
			expected_version,
			actor,
			generation: this.policyGeneration
		});
	}
	async restoreEntryExecution(id, expected_version, actor) {
		this.authorize(actor, true);
		return this.worker({
			action: 'restore_entry',
			id,
			expected_version,
			actor,
			generation: this.policyGeneration
		});
	}

	async createGroup(id, actor) {
		this.authorize(actor, true);
		return this.worker({ action: 'group_create', id, actor, generation: this.policyGeneration });
	}
	async create(id, material, actor) {
		this.authorize(actor);
		requireValue(
			material && typeof material === 'object' && !Array.isArray(material),
			'invalid_input',
			'Expected protected credential material'
		);
		return this.worker({
			action: 'create',
			id,
			material,
			actor,
			generation: this.policyGeneration
		});
	}
	async rotate(id, material, expected_version, actor, guard = undefined) {
		this.authorize(actor);
		return this.worker({
			action: 'rotate',
			id,
			material,
			expected_version,
			actor,
			generation: this.policyGeneration,
			guard
		});
	}
	async resolveForExecution(id, actor, execute, { human = false, purpose = 'execute' } = {}) {
		this.authorize(actor);
		const generation = this.generation;
		const record = await this.worker({
			action: 'resolve',
			id,
			human,
			purpose,
			actor,
			generation: this.policyGeneration
		});
		this.authorize(actor);
		requireValue(
			generation === this.generation,
			'authority_changed',
			'Vault authorization changed'
		);
		return execute(record);
	}
	async revokeSecretRefs(ids, actor) {
		this.authorize(actor, true);
		return this.worker({ action: 'revoke_secretrefs', ids, actor });
	}
	async grantSecretRefs(ids, actor) {
		this.authorize(actor, true);
		return this.worker({ action: 'grant_secretrefs', ids, actor });
	}
	async audit(actor, { limit = 25, before = Number.MAX_SAFE_INTEGER } = {}) {
		requireValue(
			this.owners.has(actor) && actor.startsWith('human:'),
			'access_denied',
			'Only an owner can read Vault access history'
		);
		return this.worker({ action: 'audit', actor, limit, before });
	}
	async revealField(id, field, actor) {
		this.authorize(actor, true);
		requireValue(
			typeof field === 'string' && /^[a-z_]{1,80}$/.test(field),
			'invalid_input',
			'Invalid credential field'
		);
		return this.resolveForExecution(
			id,
			actor,
			(record) => {
				requireValue(
					typeof record.material[field] === 'string',
					'not_found',
					'Credential field is unavailable'
				);
				return record.material[field];
			},
			{ human: true, purpose: 'reveal' }
		);
	}
	async copyField(id, field, actor) {
		this.authorize(actor, true);
		requireValue(
			typeof field === 'string' && /^[a-z_]{1,80}$/.test(field),
			'invalid_input',
			'Invalid credential field'
		);
		return this.resolveForExecution(
			id,
			actor,
			(record) => {
				requireValue(
					typeof record.material[field] === 'string',
					'not_found',
					'Credential field is unavailable'
				);
				return record.material[field];
			},
			{ human: true, purpose: 'copy' }
		);
	}
	async reveal(id, actor) {
		this.authorize(actor, true);
		return this.resolveForExecution(id, actor, (record) => record.material, {
			human: true,
			purpose: 'reveal'
		});
	}
}
