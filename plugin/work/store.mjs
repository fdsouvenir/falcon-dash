/**
 * @typedef {object} WorkRecord
 * @property {string} id
 * @property {string} type
 * @property {string} title
 * @property {string} status
 * @property {number} version
 * @property {string} [project_id]
 * @property {string} [area_id]
 * @property {string} [success_condition]
 * @property {number} [order]
 * @property {string[]} [options]
 * @property {string} [prompt]
 * @property {string} [description]
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export class DomainError extends Error {
	constructor(code, message, details = {}) {
		super(message);
		this.code = code;
		this.details = details;
	}
}
export function requireValue(test, code, message, details) {
	if (!test) throw new DomainError(code, message, details);
}
export function exact(value, keys) {
	requireValue(
		value && typeof value === 'object' && !Array.isArray(value),
		'invalid_input',
		'Expected an object'
	);
	requireValue(
		Object.keys(value).every((k) => keys.includes(k)),
		'unknown_field',
		'Unsupported field'
	);
}
export function text(value, max = 12000) {
	requireValue(
		typeof value === 'string' && value.trim().length > 0 && value.length <= max,
		'invalid_input',
		'Text is required and must fit its limit',
		{ max }
	);
	return value.trim();
}
export const TYPES = ['project', 'milestone', 'task', 'question', 'decision', 'finding', 'area'];
export const TASK_STATES = ['open', 'ready', 'in_progress', 'waiting', 'completed', 'abandoned'];
const terminal = (x) =>
	['completed', 'abandoned', 'answered', 'recorded', 'achieved', 'retired'].includes(x.status);
const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

export class WorkStore {
	constructor(path) {
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
		this.db = new DatabaseSync(path);
		chmodSync(path, 0o600);
		this.db.exec(
			`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;`
		);
		const version = Number(this.db.prepare('PRAGMA user_version').get().user_version);
		requireValue(version <= 1, 'unsupported_schema', 'Database is newer than this plugin');
		requireValue(
			version !== 0 ||
				this.db
					.prepare(
						"SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
					)
					.get().n === 0,
			'migration_required',
			'Existing data requires explicit offline conversion; it is never adopted implicitly'
		);
		this.db.exec(`
   CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY, type TEXT NOT NULL, version INTEGER NOT NULL, body TEXT NOT NULL) STRICT;
   CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES objects(id), kind TEXT NOT NULL, revision INTEGER NOT NULL, definition_id TEXT, body TEXT NOT NULL, UNIQUE(task_id,kind,revision)) STRICT;
   CREATE TABLE IF NOT EXISTS events(revision INTEGER PRIMARY KEY AUTOINCREMENT, object_id TEXT NOT NULL, actor TEXT NOT NULL, command TEXT NOT NULL, at TEXT NOT NULL, body TEXT NOT NULL) STRICT;
   CREATE TABLE IF NOT EXISTS receipts(key TEXT PRIMARY KEY, actor TEXT NOT NULL, digest TEXT NOT NULL, response TEXT NOT NULL) STRICT;
   CREATE TABLE IF NOT EXISTS links(source TEXT NOT NULL REFERENCES objects(id), target TEXT NOT NULL REFERENCES objects(id), kind TEXT NOT NULL, PRIMARY KEY(source,target,kind)) STRICT;
   PRAGMA user_version=1;
  `);
		for (const suffix of ['-wal', '-shm']) {
			try {
				chmodSync(path + suffix, 0o600);
			} catch (e) {
				if (e.code !== 'ENOENT') throw e;
			}
		}
		this.epoch = randomUUID();
	}
	close() {
		this.db.close();
	}
	stamp() {
		return {
			epoch: this.epoch,
			revision: this.db.prepare('SELECT coalesce(max(revision),0) AS n FROM events').get().n
		};
	}
	get(id) {
		const row = this.db.prepare('SELECT body FROM objects WHERE id=?').get(id);
		requireValue(row, 'not_found', 'Work does not exist', { id });
		return JSON.parse(String(row.body));
	}
	all() {
		return this.db
			.prepare('SELECT body FROM objects ORDER BY rowid')
			.all()
			.map((r) => JSON.parse(String(r.body)));
	}
	save(x) {
		this.db
			.prepare(
				'INSERT INTO objects VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,body=excluded.body'
			)
			.run(x.id, x.type, x.version, JSON.stringify(x));
	}
	artifact(id) {
		const row = this.db.prepare('SELECT body FROM artifacts WHERE id=?').get(id);
		requireValue(row, 'not_found', 'Artifact does not exist');
		return JSON.parse(String(row.body));
	}
	addArtifact(task, kind, body, actor, reason) {
		const revision = this.db
			.prepare('SELECT coalesce(max(revision),0)+1 AS n FROM artifacts WHERE task_id=? AND kind=?')
			.get(task.id, kind).n;
		const artifact = {
			id: randomUUID(),
			task_id: task.id,
			kind,
			revision,
			definition_id: kind === 'definition' ? null : task.definition_id,
			supersedes: task[`${kind}_id`] ?? null,
			actor,
			at: new Date().toISOString(),
			reason,
			...body
		};
		this.db
			.prepare('INSERT INTO artifacts VALUES(?,?,?,?,?,?)')
			.run(artifact.id, task.id, kind, revision, artifact.definition_id, JSON.stringify(artifact));
		task[`${kind}_id`] = artifact.id;
		return artifact;
	}
	warnings(x) {
		/** @type {Array<{code: string, target?: string, kind?: string}>} */
		const warnings = this.db
			.prepare("SELECT target FROM links WHERE source=? AND kind='depends_on'")
			.all(x.id)
			.map((r) => this.get(r.target))
			.filter((y) => !terminal(y))
			.map((y) => ({ code: 'dependency_unresolved', target: y.id }));
		for (const kind of ['plan', 'result', 'change'])
			if (x[`${kind}_id`] && this.artifact(x[`${kind}_id`]).definition_id !== x.definition_id)
				warnings.push({ code: 'stale_artifact', kind, target: x[`${kind}_id`] });
		if (x.status === 'waiting') warnings.push({ code: 'waiting', ...x.wait });
		return warnings;
	}
	projectState(project) {
		if (project.status === 'abandoned') return 'abandoned';
		const milestones = this.all().filter(
			(x) => x.type === 'milestone' && x.project_id === project.id
		);
		return milestones.length && milestones.every((x) => x.status === 'achieved')
			? 'completed'
			: 'open';
	}
	detail(id, full = false) {
		const x = this.get(id);
		const out = {
			...x,
			status: x.type === 'project' ? this.projectState(x) : x.status,
			attention: this.warnings(x)
		};
		for (const kind of ['definition', 'plan', 'result', 'change'])
			if (x[`${kind}_id`]) {
				const a = this.artifact(x[`${kind}_id`]);
				if (kind === 'definition' || a.definition_id === x.definition_id || full) out[kind] = a;
			}
		if (full) {
			out.artifacts = this.db
				.prepare('SELECT body FROM artifacts WHERE task_id=? ORDER BY kind,revision')
				.all(id)
				.map((r) => JSON.parse(String(r.body)));
			out.history = this.db
				.prepare('SELECT * FROM events WHERE object_id=? ORDER BY revision')
				.all(id)
				.map((r) => ({ ...r, body: JSON.parse(String(r.body)) }));
		}
		return out;
	}
	/** @param {{type?: string, limit?: number, offset?: number, agent_id?: string, search?: string}} [query] */
	list({ type, limit = 50, offset = 0, agent_id, search = '' } = {}) {
		requireValue(
			type === undefined || TYPES.includes(type),
			'invalid_filter',
			'Unsupported Work type'
		);
		requireValue(
			Number.isInteger(limit) &&
				limit > 0 &&
				limit <= 100 &&
				Number.isInteger(offset) &&
				offset >= 0 &&
				typeof search === 'string',
			'invalid_filter',
			'Invalid pagination or search'
		);
		const rows = this.all().filter(
			(x) =>
				(!type || x.type === type) &&
				(!agent_id || x.agent_id === agent_id) &&
				x.title.toLowerCase().includes(search.toLowerCase())
		);
		return {
			...this.stamp(),
			total: rows.length,
			items: rows.slice(offset, offset + limit).map((x) => ({
				id: x.id,
				type: x.type,
				title: x.title,
				status: x.type === 'project' ? this.projectState(x) : x.status,
				version: x.version,
				agent_id: x.agent_id ?? null,
				project_id: x.project_id ?? null,
				attention: this.warnings(x)
			}))
		};
	}
	execute(request, actor) {
		exact(request, ['command', 'id', 'expected_version', 'idempotency_key', 'input']);
		text(actor, 256);
		text(request.idempotency_key, 128);
		const input = request.input ?? {};
		this.db.exec('BEGIN IMMEDIATE');
		try {
			const hash = digest(request);
			const old = this.db
				.prepare('SELECT * FROM receipts WHERE key=?')
				.get(request.idempotency_key);
			if (old) {
				requireValue(
					old.actor === actor && old.digest === hash,
					'idempotency_conflict',
					'Key was used for a different request'
				);
				this.db.exec('COMMIT');
				return { ...JSON.parse(String(old.response)), noop: true };
			}
			/** @type {WorkRecord} */
			let x;
			let prior = null;
			if (request.command === 'create') {
				exact(input, [
					'type',
					'title',
					'description',
					'done_when',
					'project_id',
					'area_id',
					'success_condition',
					'order',
					'prompt',
					'options'
				]);
				requireValue(TYPES.includes(input.type), 'invalid_input', 'Unsupported Work type');
				x = {
					id: randomUUID(),
					type: input.type,
					title: text(input.title, 240),
					status: 'open',
					version: 1
				};
				if (input.project_id) {
					requireValue(
						this.get(input.project_id).type === 'project' &&
							this.get(input.project_id).status !== 'abandoned',
						'invalid_parent',
						'Expected active Project'
					);
					x.project_id = input.project_id;
				}
				if (input.area_id) {
					requireValue(this.get(input.area_id).type === 'area', 'invalid_parent', 'Expected Area');
					x.area_id = input.area_id;
				}
				if (x.type === 'milestone') {
					requireValue(x.project_id, 'input_required', 'Milestones require a Project');
					x.success_condition = text(input.success_condition);
					x.order = input.order ?? 0;
					requireValue(Number.isInteger(x.order), 'invalid_input', 'Order must be an integer');
				}
				if (x.type === 'decision') {
					requireValue(
						Array.isArray(input.options) &&
							input.options.length >= 2 &&
							new Set(input.options).size === input.options.length,
						'input_required',
						'A Decision needs distinct options'
					);
					x.options = input.options.map((v) => text(v, 2000));
				}
				if (input.prompt) x.prompt = text(input.prompt);
				this.save(x);
				if (x.type === 'task') {
					const definition = {
						title: x.title,
						description: text(input.description),
						done_when: text(input.done_when)
					};
					requireValue(
						new Set(Object.values(definition).map((v) => v.toLowerCase())).size === 3,
						'invalid_definition',
						'Title, context, and finish line must be distinct'
					);
					this.addArtifact(x, 'definition', definition, actor, 'Created');
				} else if (input.description) x.description = text(input.description);
			} else {
				x = this.get(request.id);
				prior = x.version;
				requireValue(
					request.expected_version === x.version,
					'version_conflict',
					'Work changed; reread and reapply without discarding your input',
					{ expected: request.expected_version, current: x.version }
				);
				const before = JSON.stringify(x);
				this.transition(x, request.command, input, actor);
				if (
					JSON.stringify(x) === before &&
					!['depends_on', 'associate'].includes(request.command)
				) {
					const response = {
						command: request.command,
						target: x.id,
						prior_version: prior,
						version: x.version,
						outcome: 'noop',
						noop: true,
						warnings: this.warnings(x)
					};
					this.db
						.prepare('INSERT INTO receipts VALUES(?,?,?,?)')
						.run(request.idempotency_key, actor, hash, JSON.stringify(response));
					this.db.exec('COMMIT');
					return { ...response, ...this.stamp() };
				}
				x.version++;
			}
			this.save(x);
			const warnings = this.warnings(x);
			const response = {
				command: request.command,
				target: x.id,
				prior_version: prior,
				version: x.version,
				outcome: warnings.length ? 'committed_with_warnings' : 'committed',
				noop: false,
				warnings
			};
			this.db
				.prepare('INSERT INTO events(object_id,actor,command,at,body) VALUES(?,?,?,?,?)')
				.run(
					x.id,
					actor,
					request.command,
					new Date().toISOString(),
					JSON.stringify({ before_version: prior, after: x, warnings })
				);
			this.db
				.prepare('INSERT INTO receipts VALUES(?,?,?,?)')
				.run(request.idempotency_key, actor, hash, JSON.stringify(response));
			this.db.exec('COMMIT');
			return { ...response, ...this.stamp() };
		} catch (error) {
			this.db.exec('ROLLBACK');
			throw error;
		}
	}
	transition(x, command, input, actor) {
		if (command === 'depends_on') {
			exact(input, ['target']);
			this.get(input.target);
			requireValue(input.target !== x.id, 'cycle', 'Self dependency is invalid');
			const reaches = (id, seen = new Set()) => {
				if (id === x.id) return true;
				if (seen.has(id)) return false;
				seen.add(id);
				return this.db
					.prepare("SELECT target FROM links WHERE source=? AND kind='depends_on'")
					.all(id)
					.some((r) => reaches(r.target, seen));
			};
			requireValue(!reaches(input.target), 'cycle', 'Dependency would form a cycle');
			this.db
				.prepare("INSERT OR IGNORE INTO links VALUES(?,?,'depends_on')")
				.run(x.id, input.target);
			return;
		}
		if (command === 'associate') {
			exact(input, ['milestone_id']);
			const milestone = this.get(input.milestone_id);
			requireValue(
				milestone.type === 'milestone' &&
					milestone.status !== 'achieved' &&
					milestone.project_id === x.project_id,
				'invalid_association',
				'Associate only within the same Project to an open Milestone'
			);
			this.db
				.prepare("INSERT OR IGNORE INTO links VALUES(?,?,'milestone')")
				.run(x.id, milestone.id);
			return;
		}
		if (x.type === 'milestone') {
			if (command === 'achieve') {
				exact(input, ['basis', 'sources']);
				const unresolved = this.db
					.prepare("SELECT source FROM links WHERE target=? AND kind='milestone'")
					.all(x.id)
					.map((r) => this.get(r.source))
					.filter((y) => !terminal(y));
				requireValue(
					!unresolved.length,
					'unresolved_work',
					'Resolve or explicitly detach associated Work',
					{ objects: unresolved.map((y) => ({ id: y.id, title: y.title })) }
				);
				x.achievement = {
					basis: text(input.basis, 4000),
					sources: input.sources ?? [],
					actor,
					at: new Date().toISOString()
				};
				x.status = 'achieved';
				return;
			}
			if (command === 'reopen') {
				exact(input, []);
				x.status = 'open';
				return;
			}
		}
		if (x.type === 'project' && command === 'abandon') {
			exact(input, ['dispositions']);
			const children = this.all().filter(
				(y) => y.project_id === x.id && !terminal(y) && y.type !== 'milestone'
			);
			requireValue(
				input.dispositions &&
					Object.keys(input.dispositions).length === children.length &&
					children.every((y) => ['abandon', 'detach'].includes(input.dispositions[y.id])),
				'input_required',
				'Resolve each unfinished item separately',
				{ requirements: children.map((y) => ({ subject: y.id, choices: ['abandon', 'detach'] })) }
			);
			for (const child of children) {
				if (input.dispositions[child.id] === 'abandon') child.status = 'abandoned';
				else {
					delete child.project_id;
					this.db.prepare("DELETE FROM links WHERE source=? AND kind='milestone'").run(child.id);
				}
				child.version++;
				this.save(child);
				this.db
					.prepare('INSERT INTO events(object_id,actor,command,at,body) VALUES(?,?,?,?,?)')
					.run(
						child.id,
						actor,
						'project_disposition',
						new Date().toISOString(),
						JSON.stringify({ disposition: input.dispositions[child.id], after: child })
					);
			}
			x.status = 'abandoned';
			return;
		}
		if (x.type === 'project' && command === 'resume') {
			exact(input, []);
			requireValue(x.status === 'abandoned', 'invalid_transition', 'Project is not abandoned');
			x.status = 'open';
			return;
		}
		requireValue(x.type === 'task', 'invalid_command', 'Unsupported operation for this object');
		if (['revise_definition', 'revise_plan', 'checkpoint', 'revise_change'].includes(command)) {
			requireValue(
				!terminal(x),
				'invalid_transition',
				'Reopen or resume before revising a terminal Task'
			);
			if (command === 'revise_definition') {
				exact(input, ['title', 'description', 'done_when', 'reason']);
				const body = {
					title: text(input.title, 240),
					description: text(input.description),
					done_when: text(input.done_when)
				};
				requireValue(
					new Set(Object.values(body).map((v) => v.toLowerCase())).size === 3,
					'invalid_definition',
					'Definition fields must be distinct'
				);
				this.addArtifact(x, 'definition', body, actor, text(input.reason, 1000));
				x.title = body.title;
			} else {
				exact(input, ['content', 'reason']);
				this.addArtifact(
					x,
					command === 'revise_plan' ? 'plan' : command === 'checkpoint' ? 'result' : 'change',
					{ content: text(input.content) },
					actor,
					text(input.reason, 1000)
				);
			}
			return;
		}
		if (command === 'assign') {
			exact(input, ['agent_id']);
			x.agent_id = input.agent_id === null ? null : text(input.agent_id, 128);
			return;
		}
		if (command === 'ready' || command === 'unready') {
			exact(input, []);
			requireValue(
				['open', 'ready'].includes(x.status),
				'invalid_transition',
				'Only open or ready Tasks can be groomed'
			);
			x.status = command === 'ready' ? 'ready' : 'open';
			return;
		}
		if (command === 'start') {
			exact(input, ['claim']);
			requireValue(
				['open', 'ready'].includes(x.status),
				'invalid_transition',
				'Task is not ready to start'
			);
			if (!x.agent_id) {
				requireValue(
					input.claim === true && actor.startsWith('agent:'),
					'input_required',
					'Explicitly accept accountable assignment before starting',
					{ requirement: 'claim', subject: x.id, offered_agent: actor }
				);
				x.agent_id = actor.slice(6);
			}
			x.status = 'in_progress';
			return;
		}
		if (command === 'wait') {
			exact(input, ['waiting_for', 'resume_when', 'follow_up_at']);
			requireValue(
				['ready', 'in_progress'].includes(x.status),
				'invalid_transition',
				'Only ready or running Tasks can wait'
			);
			if (input.follow_up_at)
				requireValue(
					Number.isFinite(Date.parse(input.follow_up_at)),
					'invalid_input',
					'Expected a valid date'
				);
			x.wait = {
				waiting_for: text(input.waiting_for, 2000),
				resume_when: text(input.resume_when, 2000),
				follow_up_at: input.follow_up_at ?? null,
				since: new Date().toISOString(),
				prior: x.status
			};
			x.status = 'waiting';
			return;
		}
		if (command === 'resume') {
			exact(input, []);
			requireValue(
				['waiting', 'abandoned'].includes(x.status),
				'invalid_transition',
				'Task is not waiting or abandoned'
			);
			x.status = x.wait?.prior ?? 'open';
			delete x.wait;
			return;
		}
		if (command === 'complete') {
			exact(input, ['result_id', 'content']);
			requireValue(x.status !== 'abandoned', 'invalid_transition', 'Resume before completion');
			if (x.status === 'completed') return;
			if (input.result_id) {
				const a = this.artifact(input.result_id);
				requireValue(
					a.task_id === x.id && a.kind === 'result' && a.definition_id === x.definition_id,
					'stale_artifact',
					'Result must pin current Definition'
				);
				x.result_id = a.id;
			} else this.addArtifact(x, 'result', { content: text(input.content) }, actor, 'Completion');
			x.accepted_result_id = x.result_id;
			x.status = 'completed';
			delete x.wait;
			return;
		}
		if (command === 'reopen') {
			exact(input, []);
			requireValue(x.status === 'completed', 'invalid_transition', 'Task is not completed');
			x.status = 'open';
			return;
		}
		if (command === 'abandon') {
			exact(input, []);
			x.status = 'abandoned';
			return;
		}
		throw new DomainError('invalid_command', 'Unsupported Task operation');
	}
}
