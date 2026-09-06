import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DomainError, requireValue } from '../work/store.mjs';

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
	lock() {
		this.locked = true;
		this.generation++;
		return { locked: true };
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
		return this.worker({ action: 'initialize' });
	}
	async unlock(actor) {
		requireValue(
			this.owners.has(actor) && actor.startsWith('human:'),
			'access_denied',
			'Only an authorized human can unlock Vault'
		);
		await this.worker({ action: 'inventory' });
		this.locked = false;
		this.generation++;
		return { locked: false };
	}
	async inventory(actor) {
		this.authorize(actor);
		return this.worker({ action: 'inventory' });
	}
	async create(id, material, actor) {
		this.authorize(actor);
		requireValue(
			material && typeof material === 'object' && !Array.isArray(material),
			'invalid_input',
			'Expected protected credential material'
		);
		return this.worker({ action: 'create', id, material });
	}
	async rotate(id, material, expected_version, actor) {
		this.authorize(actor);
		return this.worker({ action: 'rotate', id, material, expected_version });
	}
	async resolveForExecution(id, actor, execute) {
		this.authorize(actor);
		const generation = this.generation;
		const record = await this.worker({ action: 'resolve', id });
		this.authorize(actor);
		requireValue(
			generation === this.generation,
			'authority_changed',
			'Vault authorization changed'
		);
		return execute(record);
	}
	async reveal(id, actor) {
		this.authorize(actor, true);
		return this.resolveForExecution(id, actor, (record) => record.material);
	}
}
