// Engineering-only conversion. Never registered as a tool, route, or startup migration.
import { DatabaseSync, backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, chmodSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { WorkStore } from './store.mjs';
import { exact, requireValue } from '../errors.mjs';
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
export async function snapshotLegacy(source, destination) {
	requireValue(
		path.isAbsolute(source) &&
			path.isAbsolute(destination) &&
			source !== destination &&
			!existsSync(destination),
		'invalid_path',
		'Use explicit distinct source and new snapshot paths'
	);
	mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
	requireValue(
		(statSync(path.dirname(destination)).mode & 0o077) === 0,
		'unsafe_path',
		'Snapshot directory must be private'
	);
	const db = new DatabaseSync(source, { readOnly: true });
	try {
		requireValue(
			db.prepare('PRAGMA quick_check').get().quick_check === 'ok',
			'integrity_failure',
			'Source integrity check failed'
		);
		const names = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table'")
			.all()
			.map((x) => x.name);
		requireValue(
			names.includes('entities') && names.includes('tasks'),
			'unsupported_schema',
			'Expected a Falcon v3 Work snapshot, not arbitrary application storage'
		);
		await backup(db, destination);
		chmodSync(destination, 0o600);
		return inspectLegacy(destination);
	} finally {
		db.close();
	}
}
export function inspectLegacy(snapshot) {
	requireValue(path.isAbsolute(snapshot), 'invalid_path', 'Snapshot path must be absolute');
	requireValue(
		!existsSync(snapshot + '-wal') || statSync(snapshot + '-wal').size === 0,
		'snapshot_changed',
		'Snapshot has a live write-ahead log; create a new consistent snapshot'
	);
	const before = digest(snapshot);
	const db = new DatabaseSync(snapshot, { readOnly: true });
	try {
		db.exec('BEGIN');
		requireValue(
			db.prepare('PRAGMA quick_check').get().quick_check === 'ok',
			'integrity_failure',
			'Snapshot integrity check failed'
		);
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
			.all()
			.map((x) => String(x.name));
		const entities = db.prepare('SELECT id,type FROM entities ORDER BY id').all();
		const taskColumns = new Set(
			db
				.prepare('PRAGMA table_info(tasks)')
				.all()
				.map((x) => x.name)
		);
		requireValue(
			['entity_id', 'title', 'summary', 'completion_condition', 'status'].every((x) =>
				taskColumns.has(x)
			),
			'unsupported_schema',
			'Legacy Task fields are not the supported v3 contract'
		);
		const candidates = db
			.prepare('SELECT * FROM tasks ORDER BY entity_id')
			.all()
			.map((task) => {
				const missing = [];
				if (!task.summary) missing.push('description');
				if (!task.completion_condition) missing.push('done_when');
				if (task.owner) missing.push('canonical_agent_mapping');
				if (task.project_id) missing.push('project_mapping');
				if (task.status === 'waiting' && (!task.waiting_on || !task.waiting_resume_condition))
					missing.push('waiting_episode');
				if (task.status === 'completed' && !task.result_summary) missing.push('result_checkpoint');
				return {
					source_id: String(task.entity_id),
					type: 'task',
					source_status: String(task.status),
					proposal:
						'map summary to description and completion_condition to done_when; preserve results as reported history',
					missing
				};
			});
		requireValue(
			digest(snapshot) === before &&
				(!existsSync(snapshot + '-wal') || statSync(snapshot + '-wal').size === 0),
			'snapshot_changed',
			'Snapshot changed while being inspected'
		);
		return {
			snapshot,
			sha256: before,
			source_entities: entities.map((x) => ({ id: String(x.id), type: String(x.type) })),
			tables,
			candidates,
			requires_resolution: candidates.some((c) => c.missing.length > 0)
		};
	} finally {
		db.close();
	}
}
function substitute(value, mapping) {
	if (Array.isArray(value)) return value.map((v) => substitute(v, mapping));
	if (value && typeof value === 'object') {
		if (Object.keys(value).length === 1 && typeof value.legacy_ref === 'string') {
			requireValue(
				mapping[value.legacy_ref],
				'unresolved_reference',
				'Conversion order does not resolve a referenced source entity',
				{ source_id: value.legacy_ref }
			);
			return mapping[value.legacy_ref];
		}
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, mapping)]));
	}
	return value;
}
export function convertLegacy({ snapshot, expected_sha256, target, dispositions }) {
	requireValue(
		path.isAbsolute(target) && !existsSync(target),
		'already_exists',
		'Conversion target must be a new directory'
	);
	const inspection = inspectLegacy(snapshot);
	requireValue(
		inspection.sha256 === expected_sha256,
		'snapshot_changed',
		'Reinspect changed source before conversion'
	);
	requireValue(
		Array.isArray(dispositions) && dispositions.length === inspection.source_entities.length,
		'incomplete_mapping',
		'Every source entity needs an explicit conversion or archive disposition'
	);
	const coverage = new Set();
	for (const d of dispositions) {
		exact(d, ['source_id', 'action', 'reason', 'commands']);
		requireValue(
			inspection.source_entities.some((x) => x.id === d.source_id) && !coverage.has(d.source_id),
			'invalid_mapping',
			'Unknown or duplicate source entity'
		);
		coverage.add(d.source_id);
		requireValue(
			['convert', 'archive'].includes(d.action) && typeof d.reason === 'string' && d.reason.trim(),
			'input_required',
			'Each conversion disposition needs its rationale'
		);
		if (d.action === 'convert')
			requireValue(
				Array.isArray(d.commands) && d.commands.length && d.commands[0].command === 'create',
				'input_required',
				'Conversion begins with a validated creation command'
			);
	}
	mkdirSync(target, { mode: 0o700 });
	let store;
	try {
		store = new WorkStore(path.join(target, 'work.db'));
		const mapping = Object.create(null),
			report = [];
		for (const disposition of dispositions) {
			if (disposition.action === 'archive') {
				report.push({
					source_id: disposition.source_id,
					action: 'archive',
					reason: disposition.reason
				});
				continue;
			}
			let sequence = 0;
			for (const planned of disposition.commands) {
				const command = substitute(planned, mapping);
				const id = command.id ?? mapping[disposition.source_id];
				const result = store.execute(
					{
						...command,
						id,
						expected_version: id ? store.get(id).version : undefined,
						idempotency_key: `migration:${inspection.sha256.slice(0, 16)}:${disposition.source_id}:${sequence++}`
					},
					'migration:legacy-v3'
				);
				if (command.command === 'create') mapping[disposition.source_id] = result.target;
			}
			report.push({
				source_id: disposition.source_id,
				target_id: mapping[disposition.source_id],
				action: 'convert',
				reason: disposition.reason
			});
		}
		store.db
			.prepare(
				'CREATE TABLE conversion_provenance(source_hash TEXT PRIMARY KEY,report TEXT NOT NULL) STRICT'
			)
			.run();
		store.db
			.prepare('INSERT INTO conversion_provenance VALUES(?,?)')
			.run(inspection.sha256, JSON.stringify({ mapping, report }));
		requireValue(
			store.db.prepare('PRAGMA quick_check').get().quick_check === 'ok',
			'integrity_failure',
			'Converted database failed integrity verification'
		);
		requireValue(
			inspectLegacy(snapshot).sha256 === inspection.sha256,
			'snapshot_changed',
			'Source archive changed during conversion'
		);
		store.close();
		store = undefined;
		return {
			source_sha256: inspection.sha256,
			mapping,
			report,
			archive: snapshot,
			target: path.join(target, 'work.db')
		};
	} catch (error) {
		store?.close();
		rmSync(target, { recursive: true, force: true });
		throw error;
	}
}
