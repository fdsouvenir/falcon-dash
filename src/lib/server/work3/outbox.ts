import { getWork3Db, getWork3EventsDb } from './db.js';

/**
 * Outbox transfer worker (doc 01 Event Log, doc 06): moves outbox rows from
 * work3.db into work3-events.db. Interval fallback plus an immediate kick from
 * the post-commit bus emit. ULID event ids make the transfer an
 * insert-or-ignore upsert (the two files share no transaction); delivered rows
 * are pruned after a safety window. Nothing but this worker reads the outbox.
 */

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_PRUNE_WINDOW_MS = 5 * 60_000;
const TRANSFER_BATCH = 500;

interface OutboxRow {
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

let timer: ReturnType<typeof setInterval> | null = null;
let kickScheduled = false;
let lastSuccessAt: number | null = null;
let lastError: { at: number; message: string } | null = null;
let pruneWindowMs = DEFAULT_PRUNE_WINDOW_MS;

/** Transfer pending outbox rows once. Synchronous; safe to call repeatedly. */
export function transferWork3OutboxOnce(options: { pruneWindowMs?: number } = {}): {
	transferred: number;
	pruned: number;
} {
	const effectivePruneWindowMs = options.pruneWindowMs ?? pruneWindowMs;
	const workDb = getWork3Db();
	const eventsDb = getWork3EventsDb();
	const now = Date.now();

	const pending = workDb
		.prepare(
			`SELECT * FROM event_outbox WHERE transferred_at IS NULL
			 ORDER BY occurred_at ASC, id ASC LIMIT ?`
		)
		.all(TRANSFER_BATCH) as OutboxRow[];

	const insert = eventsDb.prepare(
		`INSERT OR IGNORE INTO events (
			id, occurred_at, command, event_type, subject_type, subject_id,
			actor_kind, actor_id, actor_label, version_from, version_to,
			summary, payload_json, source_refs_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const markTransferred = workDb.prepare('UPDATE event_outbox SET transferred_at = ? WHERE id = ?');

	let transferred = 0;
	for (const row of pending) {
		// Insert into the Event Log first; only mark transferred once the row is
		// durably in the events database. A crash in between leaves the row
		// pending, and the ULID key makes the retried insert a no-op.
		insert.run(
			row.id,
			row.occurred_at,
			row.command,
			row.event_type,
			row.subject_type,
			row.subject_id,
			row.actor_kind,
			row.actor_id,
			row.actor_label,
			row.version_from,
			row.version_to,
			row.summary,
			row.payload_json,
			row.source_refs_json
		);
		markTransferred.run(now, row.id);
		transferred += 1;
	}

	const pruned = workDb
		.prepare('DELETE FROM event_outbox WHERE transferred_at IS NOT NULL AND transferred_at < ?')
		.run(now - effectivePruneWindowMs).changes;

	lastSuccessAt = now;
	lastError = null;
	return { transferred, pruned };
}

function safeTransfer(): void {
	try {
		transferWork3OutboxOnce();
	} catch (error) {
		lastError = { at: Date.now(), message: error instanceof Error ? error.message : String(error) };
		console.error('[work3] outbox transfer failed:', error);
	}
}

/** Immediate transfer request from the post-commit path; coalesced per tick. */
export function kickWork3Outbox(): void {
	if (kickScheduled) return;
	kickScheduled = true;
	setImmediate(() => {
		kickScheduled = false;
		safeTransfer();
	});
}

export function startWork3OutboxWorker(
	options: { intervalMs?: number; pruneWindowMs?: number } = {}
): void {
	if (timer) return;
	pruneWindowMs = options.pruneWindowMs ?? DEFAULT_PRUNE_WINDOW_MS;
	timer = setInterval(safeTransfer, options.intervalMs ?? DEFAULT_INTERVAL_MS);
	timer.unref?.();
	safeTransfer();
}

export function stopWork3OutboxWorker(): void {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
	kickScheduled = false;
	lastSuccessAt = null;
	lastError = null;
	pruneWindowMs = DEFAULT_PRUNE_WINDOW_MS;
}

export interface OutboxDiagnostics {
	pending: number;
	oldest_pending_age_ms: number | null;
	awaiting_prune: number;
	worker_running: boolean;
	last_success_at: number | null;
	last_error: { at: number; message: string } | null;
}

/** Surfaced through /api/health (doc 01: lag and failure are never silent). */
export function getWork3OutboxDiagnostics(): OutboxDiagnostics {
	const workDb = getWork3Db();
	const pendingRow = workDb
		.prepare(
			'SELECT COUNT(*) AS count, MIN(occurred_at) AS oldest FROM event_outbox WHERE transferred_at IS NULL'
		)
		.get() as { count: number; oldest: number | null };
	const awaitingPrune = workDb
		.prepare('SELECT COUNT(*) AS count FROM event_outbox WHERE transferred_at IS NOT NULL')
		.get() as { count: number };
	return {
		pending: pendingRow.count,
		oldest_pending_age_ms: pendingRow.oldest === null ? null : Date.now() - pendingRow.oldest,
		awaiting_prune: awaitingPrune.count,
		worker_running: timer !== null,
		last_success_at: lastSuccessAt,
		last_error: lastError
	};
}
