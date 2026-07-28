import type { Work3Event } from '$lib/work3-shared/types.js';
import { getWork3EventsDb } from './db.js';

/**
 * Read side of the Event Log. UI timelines, the agent `history` command, and
 * derived meaningful-update timestamps read from here through the server API;
 * nothing reads the outbox except the transfer worker (doc 01).
 */

interface EventRow {
	id: string;
	occurred_at: number;
	command: string;
	event_type: string;
	subject_type: string;
	subject_id: string;
	actor_kind: string;
	actor_id: string;
	actor_label: string;
	version_from: number | null;
	version_to: number | null;
	summary: string;
	payload_json: string;
	source_refs_json: string;
}

function toEvent(row: EventRow): Work3Event {
	return {
		id: row.id,
		occurred_at: row.occurred_at,
		command: row.command,
		event_type: row.event_type,
		subject_type: row.subject_type,
		subject_id: row.subject_id,
		actor: {
			kind: row.actor_kind as Work3Event['actor']['kind'],
			id: row.actor_id,
			label: row.actor_label
		},
		version_from: row.version_from,
		version_to: row.version_to,
		summary: row.summary,
		payload: JSON.parse(row.payload_json) as Record<string, unknown>,
		source_refs: JSON.parse(row.source_refs_json) as Work3Event['source_refs']
	};
}

export interface EventSubjectInterval {
	subjectId: string;
	startId: string | null;
	endId: string | null;
}

const SCOPED_EVENT_BATCH_SIZE = 200;

/** Assignment events that establish Work membership intervals for one Project ledger. */
export function listProjectAssignmentEvents(projectId: string): Work3Event[] {
	const rows = getWork3EventsDb()
		.prepare(
			`SELECT * FROM events
			  WHERE event_type = 'work_assigned'
			    AND (
			      json_extract(payload_json, '$.project_id') = ?
			      OR json_extract(payload_json, '$.prior_project_id') = ?
			    )
			  ORDER BY id ASC`
		)
		.all(projectId, projectId) as EventRow[];
	return rows.map(toEvent);
}

/**
 * Read a bounded timeline whose dynamic subjects are valid only inside
 * explicit ULID intervals. Assignment boundary events are included at both
 * ends, so a reassignment is visible in the ledger it leaves and the ledger
 * it joins.
 */
export function listScopedWork3Events(options: {
	staticSubjectIds: string[];
	subjectIntervals: EventSubjectInterval[];
	limit?: number;
}): Work3Event[] {
	const scopeRows = [
		...[...new Set(options.staticSubjectIds)].map((subjectId) => ({
			kind: 'static' as const,
			subjectId
		})),
		...options.subjectIntervals.map((interval) => ({
			kind: 'interval' as const,
			...interval
		}))
	];
	if (scopeRows.length === 0) return [];
	const limit = Math.min(options.limit ?? 100, 500);
	const events = new Map<string, Work3Event>();
	const db = getWork3EventsDb();
	for (let offset = 0; offset < scopeRows.length; offset += SCOPED_EVENT_BATCH_SIZE) {
		const batch = scopeRows.slice(offset, offset + SCOPED_EVENT_BATCH_SIZE);
		const staticRows = batch.filter((row) => row.kind === 'static');
		const intervalRows = batch.filter((row) => row.kind === 'interval');
		const staticRelation =
			staticRows.length > 0
				? `VALUES ${staticRows.map(() => '(?)').join(', ')}`
				: 'SELECT NULL WHERE 0';
		const intervalRelation =
			intervalRows.length > 0
				? `VALUES ${intervalRows.map(() => '(?, ?, ?)').join(', ')}`
				: 'SELECT NULL, NULL, NULL WHERE 0';
		const params = [
			...staticRows.map((row) => row.subjectId),
			...intervalRows.flatMap((row) => [row.subjectId, row.startId, row.endId]),
			limit
		];
		const rows = db
			.prepare(
				`WITH static_scope(subject_id) AS (${staticRelation}),
				      interval_scope(subject_id, start_id, end_id) AS (${intervalRelation}),
				      scoped_events AS (
				        SELECT e.*
				          FROM static_scope s
				          JOIN events e ON e.subject_id = s.subject_id
				        UNION
				        SELECT e.*
				          FROM interval_scope i
				          JOIN events e
				            ON e.subject_id = i.subject_id
				           AND (i.start_id IS NULL OR e.id >= i.start_id)
				           AND (i.end_id IS NULL OR e.id <= i.end_id)
				      )
				 SELECT *
				   FROM scoped_events
				  ORDER BY id DESC
				  LIMIT ?`
			)
			.all(...params) as EventRow[];
		for (const row of rows) events.set(row.id, toEvent(row));
	}
	return [...events.values()]
		.sort((left, right) => right.id.localeCompare(left.id))
		.slice(0, limit);
}

export function listWork3Events(
	options: {
		subjectId?: string;
		subjectIds?: string[];
		eventType?: string;
		limit?: number;
		before?: string;
		/** Only events with occurred_at >= since (ms epoch). */
		since?: number;
	} = {}
): Work3Event[] {
	const db = getWork3EventsDb();
	const clauses: string[] = [];
	const params: unknown[] = [];
	if (options.subjectIds?.length === 0) return [];
	if (options.subjectId) {
		clauses.push('subject_id = ?');
		params.push(options.subjectId);
	}
	if (options.subjectIds && options.subjectIds.length > 0) {
		clauses.push(`subject_id IN (${options.subjectIds.map(() => '?').join(', ')})`);
		params.push(...options.subjectIds);
	}
	if (options.eventType) {
		clauses.push('event_type = ?');
		params.push(options.eventType);
	}
	if (options.before) {
		clauses.push('id < ?');
		params.push(options.before);
	}
	if (options.since !== undefined) {
		clauses.push('occurred_at >= ?');
		params.push(options.since);
	}
	const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
	const rows = db
		.prepare(`SELECT * FROM events ${where} ORDER BY id DESC LIMIT ?`)
		.all(...params, Math.min(options.limit ?? 100, 500)) as EventRow[];
	return rows.map(toEvent);
}
