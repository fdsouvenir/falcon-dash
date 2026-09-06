import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { DomainError, requireValue, text, exact } from '../work/store.mjs';

export class Integrations {
	constructor(path, vault, adapters) {
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
		this.db = new DatabaseSync(path);
		chmodSync(path, 0o600);
		this.vault = vault;
		this.adapters = adapters;
		this.db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,version INTEGER NOT NULL,body TEXT NOT NULL) STRICT;
  CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,connection_id TEXT NOT NULL,action TEXT NOT NULL,at INTEGER NOT NULL,outcome TEXT NOT NULL) STRICT;`);
	}
	close() {
		if (this.timer) clearInterval(this.timer);
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
					phase
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
	async run(id, action, actor) {
		requireValue(
			['test', 'refresh', 'pause', 'resume'].includes(action),
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
			c.phase = action === 'refresh' ? 'refreshing' : 'testing';
			c.operation_started = Date.now();
			c.version++;
			this.save(c);
			this.db.exec('COMMIT');
		} catch (e) {
			this.db.exec('ROLLBACK');
			throw e;
		}
		try {
			const adapter = this.adapters[c.provider];
			const result = await this.vault.resolveForExecution(c.vault_handle, actor, async (record) => {
				const output = await adapter[action](record.material, c);
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
					await this.vault.rotate(c.vault_handle, output.material, record.version, actor);
				return output;
			});
			c.phase = 'idle';
			c.health = result.health ?? 'healthy';
			c.last_success = Date.now();
			c.last_failure = null;
			c.next_at = result.next_at ?? Date.now() + 3600000;
			c.version++;
			this.save(c);
			this.audit(id, action, 'success');
			return { id, health: c.health, next_at: c.next_at };
		} catch (e) {
			c.phase = 'idle';
			c.last_failure = Date.now();
			c.health =
				action === 'refresh'
					? 'reauthorization_required'
					: e.code === 'scope_failure'
						? 'broken'
						: e.code === 'vault_locked'
							? 'unavailable'
							: 'broken';
			c.next_at = action === 'refresh' ? null : Date.now() + 300000;
			c.version++;
			this.save(c);
			this.audit(id, action, c.health);
			throw new DomainError(
				c.health,
				action === 'refresh'
					? 'Refresh outcome is uncertain. Reauthorize; automatic retry could reuse a consumed token.'
					: 'Validation failed; inspect access and retry'
			);
		}
	}
	recover() {
		for (const row of this.db.prepare('SELECT body FROM connections').all()) {
			const c = JSON.parse(String(row.body));
			if (c.phase !== 'idle') {
				c.health = c.phase === 'refreshing' ? 'reauthorization_required' : 'unavailable';
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
						await this.run(c.id, 'test', actor);
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
