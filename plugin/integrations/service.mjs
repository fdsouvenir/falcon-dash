import { internalAuthority } from '../authority.mjs';
import { privateDatabase } from '../storage.mjs';
import { readFileSync } from 'node:fs';
import { DomainError, requireValue, text, exact } from '../errors.mjs';

function processStart(pid) {
	try {
		return readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').at(-1).split(' ')[19];
	} catch {
		return null;
	}
}
export class Integrations {
	constructor(path, vault, adapters) {
		this.db = privateDatabase(path, { maxVersion: 1, allowUnversioned: true });
		this.path = path;
		this.inflight = new Set();
		this.closing = false;
		this.vault = vault;
		this.adapters = adapters;
		this.db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,version INTEGER NOT NULL,body TEXT NOT NULL) STRICT;
  CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,connection_id TEXT NOT NULL,action TEXT NOT NULL,at INTEGER NOT NULL,outcome TEXT NOT NULL) STRICT;PRAGMA user_version=1;`);
	}
	async close() {
		this.closing = true;
		if (this.timer) clearInterval(this.timer);
		await Promise.allSettled([...this.inflight]);
		this.db.close();
	}
	get(id) {
		const r = this.db.prepare('SELECT body FROM connections WHERE id=?').get(id);
		requireValue(r, 'not_found', 'Connection not found');
		return JSON.parse(String(r.body));
	}
	save(c) {
		this.db
			.prepare(
				'INSERT INTO connections VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,body=excluded.body'
			)
			.run(c.id, c.version, JSON.stringify(c));
	}
	compareAndSave(c, expected) {
		const result = this.db
			.prepare('UPDATE connections SET version=?,body=? WHERE id=? AND version=?')
			.run(c.version, JSON.stringify(c), c.id, expected);
		requireValue(result.changes === 1, 'authority_changed', 'Connection changed during operation');
	}
	list(actor) {
		return this.db
			.prepare('SELECT body FROM connections')
			.all()
			.map((r) => JSON.parse(String(r.body)))
			.filter((c) => c.actors.includes(actor))
			.map(
				({
					id,
					provider,
					purpose,
					owner,
					health,
					last_success,
					last_failure,
					next_at,
					paused,
					version,
					phase,
					validated_capabilities = []
				}) => ({
					id,
					provider,
					purpose,
					owner,
					health,
					last_success,
					last_failure,
					next_at,
					paused,
					version,
					phase,
					validated_capabilities,
					freshness: last_success && Date.now() - last_success < 3600000 ? 'current' : 'stale'
				})
			);
	}
	create(input, actor) {
		exact(input, ['id', 'provider', 'purpose', 'owner', 'vault_handle', 'actors', 'account_id']);
		requireValue(this.adapters[input.provider], 'unsupported_provider', 'Adapter is unavailable');
		requireValue(
			['falcon', 'native'].includes(input.owner),
			'invalid_input',
			'Credential owner must be explicit'
		);
		requireValue(
			Array.isArray(input.actors) && input.actors.includes(actor),
			'access_denied',
			'Creator must retain connection access'
		);
		const c = {
			...input,
			id: text(input.id, 80),
			purpose: text(input.purpose, 500),
			health: 'unavailable',
			version: 1,
			next_at: Date.now(),
			paused: false,
			phase: 'idle'
		};
		requireValue(
			!this.db.prepare('SELECT id FROM connections WHERE id=?').get(c.id),
			'already_exists',
			'Connection already exists'
		);
		this.save(c);
		return { id: c.id, version: 1 };
	}
	audit(id, action, outcome) {
		this.db
			.prepare('INSERT INTO audit(connection_id,action,at,outcome) VALUES(?,?,?,?)')
			.run(id, action, Date.now(), outcome);
	}
	run(id, action, actor, authority = internalAuthority) {
		const operation = this.perform(id, action, actor, authority);
		const tracked = operation.finally(() => this.inflight.delete(tracked));
		this.inflight.add(tracked);
		return tracked;
	}
	async perform(id, action, actor, authority = internalAuthority) {
		authority.assert();
		requireValue(!this.closing, 'unavailable', 'Integration service is stopping');
		requireValue(
			['test', 'refresh', 'pause', 'resume', 'disconnect'].includes(action),
			'invalid_command',
			'Unsupported integration action'
		);
		this.db.exec('BEGIN IMMEDIATE');
		let c;
		try {
			c = this.get(id);
			requireValue(
				c.actors.includes(actor),
				'access_denied',
				'Connection access is not authorized'
			);
			if (action === 'disconnect' || action === 'pause') {
				c.version++;
				c.phase = 'idle';
				c.paused = true;
				if (action === 'disconnect') {
					c.disconnected = true;
					c.health = 'reauthorization_required';
					c.next_at = null;
				}
				this.save(c);
				this.audit(id, action, 'committed');
				this.db.exec('COMMIT');
				return { id, paused: true, disconnected: !!c.disconnected };
			}
			requireValue(
				!c.disconnected,
				'disconnected',
				'Reconnect explicitly before using this connection'
			);
			requireValue(
				c.phase === 'idle',
				'maintenance_busy',
				'Previous operation needs completion or recovery'
			);
			if (action === 'pause' || action === 'resume') {
				c.paused = action === 'pause';
				c.version++;
				this.save(c);
				this.audit(id, action, 'committed');
				this.db.exec('COMMIT');
				return { id, paused: c.paused };
			}
			requireValue(
				c.owner === 'falcon',
				'native_owner',
				'Use the upstream credential owner; Falcon does not refresh native credentials'
			);
			requireValue(!c.paused, 'maintenance_paused', 'Resume maintenance first');
			requireValue(
				action !== 'refresh' || this.adapters[c.provider].supports_refresh !== false,
				'unsupported_operation',
				'This provider uses explicit rotation rather than token refresh'
			);
			c.phase = action === 'refresh' ? 'refreshing' : 'testing';
			c.operation_started = Date.now();
			c.operation_pid = process.pid;
			c.operation_start = processStart(process.pid);
			c.version++;
			this.save(c);
			this.db.exec('COMMIT');
		} catch (e) {
			this.db.exec('ROLLBACK');
			throw e;
		}
		const leaseVersion = c.version;
		const assertCurrent = () => {
			authority.assert();
			requireValue(!this.closing, 'authority_changed', 'Integration service is stopping');
			const current = this.get(id);
			requireValue(
				current.version === leaseVersion &&
					current.phase === c.phase &&
					current.actors.includes(actor) &&
					!current.paused &&
					!current.disconnected,
				'authority_changed',
				'Connection authority changed'
			);
		};
		const guard = { assert: assertCurrent, signal: authority.signal };
		let providerStarted = false;
		try {
			const adapter = this.adapters[c.provider];
			const result = await this.vault.resolveForExecution(
				c.vault_handle,
				actor,
				async (record, credentialGuard) => {
					const ioGuard = {
						assert: () => {
							assertCurrent();
							credentialGuard?.assert();
						},
						signal: credentialGuard?.signal ?? guard.signal,
						beforeRequest() {
							assertCurrent();
							credentialGuard?.assert();
							providerStarted = true;
						}
					};
					ioGuard.assert();
					if (adapter.dispatch_guarded !== true) providerStarted = true;
					const output = await adapter[action](record.material, c, ioGuard);
					ioGuard.assert();
					// No automatic lease steal: a refresh might have consumed the old provider token.
					const current = this.get(id);
					requireValue(
						current.version === c.version &&
							current.phase === c.phase &&
							current.actors.includes(actor) &&
							!current.paused,
						'authority_changed',
						'Connection changed while preparing provider operation'
					);
					if (output.material)
						await this.vault.rotate(
							c.vault_handle,
							output.material,
							record.version,
							actor,
							{
								database: this.path,
								id,
								version: c.version,
								phase: c.phase
							},
							ioGuard
						);
					return output;
				},
				{ authority: guard }
			);
			assertCurrent();
			const operationVersion = c.version;
			c.phase = 'idle';
			c.validated_capabilities = action === 'test' ? (result.validated_capabilities ?? []) : [];
			c.health = action === 'refresh' ? 'unavailable' : (result.health ?? 'healthy');
			if (action === 'test') c.last_success = Date.now();
			else c.last_maintenance_success = Date.now();
			c.last_failure = null;
			if (action === 'refresh') {
				c.next_refresh_at = result.next_at ?? null;
				c.next_at = Date.now();
				c.next_action = 'test';
			} else {
				c.next_at =
					c.next_refresh_at && c.next_refresh_at < Date.now() + 3600000
						? c.next_refresh_at
						: Date.now() + 3600000;
				c.next_action = c.next_at === c.next_refresh_at ? 'refresh' : 'test';
			}
			c.version++;
			this.compareAndSave(c, operationVersion);
			this.audit(id, action, 'success');
			return {
				id,
				health: c.health,
				next_at: c.next_at,
				validated_capabilities: c.validated_capabilities
			};
		} catch (e) {
			const current = this.get(id);
			if (current.version !== leaseVersion) {
				this.audit(id, action, 'superseded');
				throw new DomainError(
					'authority_changed',
					'Connection was changed or disconnected during operation'
				);
			}
			const operationVersion = c.version;
			c.phase = 'idle';
			c.last_failure = Date.now();
			c.health =
				action === 'refresh' && providerStarted
					? 'reauthorization_required'
					: e.code === 'scope_failure'
						? 'broken'
						: e.code === 'vault_locked'
							? 'unavailable'
							: 'broken';
			c.failures = (c.failures ?? 0) + 1;
			c.next_at =
				action === 'refresh' && providerStarted
					? null
					: Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(c.failures, 7));
			c.version++;
			this.compareAndSave(c, operationVersion);
			this.audit(id, action, c.health);
			throw new DomainError(
				c.health,
				action === 'refresh' && providerStarted
					? 'Refresh outcome is uncertain. Reauthorize; automatic retry could reuse a consumed token.'
					: 'Validation failed; inspect access and retry'
			);
		}
	}
	recover() {
		for (const row of this.db.prepare('SELECT body FROM connections').all()) {
			const c = JSON.parse(String(row.body));
			if (
				c.phase !== 'idle' &&
				(!c.operation_pid || processStart(c.operation_pid) !== c.operation_start)
			) {
				c.health = c.phase !== 'testing' ? 'reauthorization_required' : 'unavailable';
				c.phase = 'idle';
				c.next_at = null;
				c.version++;
				this.save(c);
				this.audit(c.id, 'restart_recovery', c.health);
			}
		}
	}
	start(actor) {
		this.recover();
		let running = false;
		this.timer = setInterval(async () => {
			if (running) return;
			running = true;
			try {
				const due = this.list(actor)
					.filter((c) => c.owner === 'falcon' && !c.paused && c.next_at && c.next_at <= Date.now())
					.slice(0, 1);
				for (const c of due) {
					try {
						await this.run(c.id, this.get(c.id).next_action ?? 'test', actor);
					} catch {
						/* redacted status persisted */
					}
				}
			} finally {
				running = false;
			}
		}, 30000);
		this.timer.unref();
	}
}
