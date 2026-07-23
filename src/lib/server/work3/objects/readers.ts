import { getWork3Db } from '../db.js';
import { listWork3Events } from '../eventlog.js';
import { registerObjectReader, type ReadOptions } from '../read/registry.js';
import {
	activeBlockersForMany,
	activeWorkCountForArea,
	taskActionability
} from '../read/derived.js';
import type { TaskRow } from './task.js';
import type { AreaRow } from './area.js';
import type { BlockerRow } from './blocker.js';

/**
 * List/detail/full projections for the Area + Task + Blocker slice (doc 04).
 * List defaults are minimal and content-first; detail adds what is needed to
 * act; full adds history. Derived state (blocked, actionability, counts) is
 * computed on read.
 */

interface EnvelopeJoin {
	id: string;
	area_id: string | null;
	created_at: number;
	updated_at: number;
	version: number;
}

type TaskJoinRow = TaskRow & EnvelopeJoin;

function taskListItem(
	row: TaskJoinRow,
	blockers: ReturnType<typeof activeBlockersForMany>
): Record<string, unknown> {
	const active = blockers.get(row.id) ?? [];
	const blocked = active.length > 0;
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		actionability: taskActionability(row.status, blocked),
		owner: row.owner,
		priority: row.priority,
		area_id: row.area_id,
		project_id: row.project_id,
		due_at: row.due_at,
		version: row.version,
		...(blocked
			? {
					blocker_summary: active.map((blocker) => blocker.reason).join('; '),
					blocked_age_ms: Date.now() - active[0].created_at
				}
			: {}),
		...(row.status === 'waiting' ? { waiting_on: row.waiting_on } : {})
	};
}

function taskDetail(
	row: TaskJoinRow,
	blockers: ReturnType<typeof activeBlockersForMany>,
	view: 'detail' | 'full'
): Record<string, unknown> {
	const base = taskListItem(row, blockers);
	const active = blockers.get(row.id) ?? [];
	const detail = {
		...base,
		summary: row.summary,
		completion_condition: row.completion_condition,
		result_summary: row.result_summary,
		output_revision: row.output_revision,
		completed_at: row.completed_at,
		cancelled_at: row.cancelled_at,
		cancel_reason: row.cancel_reason,
		created_at: row.created_at,
		updated_at: row.updated_at,
		waiting:
			row.status === 'waiting'
				? {
						waiting_on: row.waiting_on,
						reason: row.waiting_reason,
						since: row.waiting_since,
						resume_condition: row.waiting_resume_condition,
						follow_up_at: row.waiting_follow_up_at
					}
				: null,
		active_blockers: active
	};
	if (view === 'full') {
		return {
			...detail,
			history: listWork3Events({ subjectId: row.id, limit: 100 })
		};
	}
	return detail;
}

const TASK_FIELDS = [
	'id',
	'title',
	'status',
	'actionability',
	'owner',
	'priority',
	'area_id',
	'project_id',
	'due_at',
	'version',
	'blocker_summary',
	'blocked_age_ms',
	'waiting_on',
	'summary',
	'completion_condition',
	'result_summary',
	'output_revision',
	'completed_at',
	'cancelled_at',
	'cancel_reason',
	'created_at',
	'updated_at',
	'waiting',
	'active_blockers',
	'history'
];

function queryTasks(options: ReadOptions): { rows: TaskJoinRow[]; total: number } {
	const db = getWork3Db();
	const clauses: string[] = [];
	const params: unknown[] = [];
	if (options.filters.status) {
		clauses.push('t.status = ?');
		params.push(options.filters.status);
	}
	if (options.filters.area) {
		clauses.push('e.area_id = ?');
		params.push(options.filters.area);
	}
	if (options.filters.owner) {
		clauses.push('t.owner = ?');
		params.push(options.filters.owner);
	}
	if (options.filters.priority) {
		clauses.push('t.priority = ?');
		params.push(options.filters.priority);
	}
	if (options.filters.active === 'true') {
		clauses.push(`t.status NOT IN ('completed','cancelled')`);
	}
	if (options.filters.q) {
		clauses.push('(t.title LIKE ? OR t.summary LIKE ?)');
		const like = `%${options.filters.q}%`;
		params.push(like, like);
	}
	const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
	const total = (
		db
			.prepare(
				`SELECT COUNT(*) AS count FROM tasks t JOIN entities e ON e.id = t.entity_id ${where}`
			)
			.get(...params) as { count: number }
	).count;
	const rows = db
		.prepare(
			`SELECT t.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
			 FROM tasks t JOIN entities e ON e.id = t.entity_id ${where}
			 ORDER BY e.updated_at DESC LIMIT ? OFFSET ?`
		)
		.all(...params, options.limit, options.offset) as TaskJoinRow[];
	return { rows, total };
}

export function registerSliceReaders(): void {
	registerObjectReader({
		type: 'task',
		aliases: ['tasks'],
		knownFields: TASK_FIELDS,
		knownFilters: ['status', 'area', 'owner', 'priority', 'active', 'q'],
		list: (options) => {
			const { rows, total } = queryTasks(options);
			const blockers = activeBlockersForMany(
				getWork3Db(),
				rows.map((row) => row.id)
			);
			return {
				items: rows.map((row) =>
					options.view === 'list'
						? taskListItem(row, blockers)
						: taskDetail(row, blockers, options.view)
				),
				total
			};
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT t.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM tasks t JOIN entities e ON e.id = t.entity_id WHERE t.entity_id = ?`
				)
				.get(id) as TaskJoinRow | undefined;
			if (!row) return null;
			const blockers = activeBlockersForMany(db, [row.id]);
			return options.view === 'list'
				? taskListItem(row, blockers)
				: taskDetail(row, blockers, options.view === 'full' ? 'full' : 'detail');
		}
	});

	registerObjectReader({
		type: 'area',
		aliases: ['areas'],
		knownFields: [
			'id',
			'title',
			'state',
			'active_work_count',
			'summary',
			'archived_at',
			'created_at',
			'updated_at',
			'version',
			'history'
		],
		knownFilters: ['state'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.state) {
				clauses.push('a.state = ?');
				params.push(options.filters.state);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db.prepare(`SELECT COUNT(*) AS count FROM areas a ${where}`).get(...params) as {
					count: number;
				}
			).count;
			const rows = db
				.prepare(
					`SELECT a.*, e.id, e.created_at, e.updated_at, e.version
					 FROM areas a JOIN entities e ON e.id = a.entity_id ${where}
					 ORDER BY a.title ASC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<AreaRow & EnvelopeJoin>;
			return {
				items: rows.map((row) => ({
					id: row.id,
					title: row.title,
					state: row.state,
					active_work_count: activeWorkCountForArea(db, row.id),
					version: row.version,
					...(options.view !== 'list'
						? {
								summary: row.summary,
								archived_at: row.archived_at,
								created_at: row.created_at,
								updated_at: row.updated_at
							}
						: {})
				})),
				total
			};
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT a.*, e.id, e.created_at, e.updated_at, e.version
					 FROM areas a JOIN entities e ON e.id = a.entity_id WHERE a.entity_id = ?`
				)
				.get(id) as (AreaRow & EnvelopeJoin) | undefined;
			if (!row) return null;
			return {
				id: row.id,
				title: row.title,
				state: row.state,
				summary: row.summary,
				active_work_count: activeWorkCountForArea(db, row.id),
				archived_at: row.archived_at,
				created_at: row.created_at,
				updated_at: row.updated_at,
				version: row.version,
				...(options.view === 'full'
					? { history: listWork3Events({ subjectId: row.id, limit: 100 }) }
					: {})
			};
		}
	});

	registerObjectReader({
		type: 'blocker',
		aliases: ['blockers'],
		knownFields: [
			'id',
			'blocked_id',
			'state',
			'source_kind',
			'source_work_id',
			'source_label',
			'reason',
			'resolution_condition',
			'unblock_task_id',
			'resolved_at',
			'resolved_summary',
			'invalidated_at',
			'invalidated_reason',
			'created_at',
			'version'
		],
		knownFilters: ['state', 'blocked'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.state) {
				clauses.push('b.state = ?');
				params.push(options.filters.state);
			}
			if (options.filters.blocked) {
				clauses.push('b.blocked_id = ?');
				params.push(options.filters.blocked);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db.prepare(`SELECT COUNT(*) AS count FROM blockers b ${where}`).get(...params) as {
					count: number;
				}
			).count;
			const rows = db
				.prepare(
					`SELECT b.*, e.id, e.created_at, e.updated_at, e.version
					 FROM blockers b JOIN entities e ON e.id = b.entity_id ${where}
					 ORDER BY e.created_at DESC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<BlockerRow & EnvelopeJoin>;
			return {
				items: rows.map((row) => ({
					id: row.id,
					blocked_id: row.blocked_id,
					state: row.state,
					source_kind: row.source_kind,
					source_work_id: row.source_work_id,
					source_label: row.source_label,
					reason: row.reason,
					resolution_condition: row.resolution_condition,
					unblock_task_id: row.unblock_task_id,
					created_at: row.created_at,
					version: row.version,
					...(options.view !== 'list'
						? {
								resolved_at: row.resolved_at,
								resolved_summary: row.resolved_summary,
								invalidated_at: row.invalidated_at,
								invalidated_reason: row.invalidated_reason
							}
						: {})
				})),
				total
			};
		},
		get: (id) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT b.*, e.id, e.created_at, e.updated_at, e.version
					 FROM blockers b JOIN entities e ON e.id = b.entity_id WHERE b.entity_id = ?`
				)
				.get(id) as (BlockerRow & EnvelopeJoin) | undefined;
			if (!row) return null;
			return {
				id: row.id,
				blocked_id: row.blocked_id,
				state: row.state,
				source_kind: row.source_kind,
				source_work_id: row.source_work_id,
				source_label: row.source_label,
				reason: row.reason,
				resolution_condition: row.resolution_condition,
				unblock_task_id: row.unblock_task_id,
				resolved_at: row.resolved_at,
				resolved_summary: row.resolved_summary,
				invalidated_at: row.invalidated_at,
				invalidated_reason: row.invalidated_reason,
				created_at: row.created_at,
				version: row.version
			};
		}
	});
}
