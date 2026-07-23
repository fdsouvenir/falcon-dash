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

export function listWork3Events(
	options: { subjectId?: string; eventType?: string; limit?: number; before?: string } = {}
): Work3Event[] {
	const db = getWork3EventsDb();
	const clauses: string[] = [];
	const params: unknown[] = [];
	if (options.subjectId) {
		clauses.push('subject_id = ?');
		params.push(options.subjectId);
	}
	if (options.eventType) {
		clauses.push('event_type = ?');
		params.push(options.eventType);
	}
	if (options.before) {
		clauses.push('id < ?');
		params.push(options.before);
	}
	const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
	const rows = db
		.prepare(`SELECT * FROM events ${where} ORDER BY id DESC LIMIT ?`)
		.all(...params, Math.min(options.limit ?? 100, 500)) as EventRow[];
	return rows.map(toEvent);
}
