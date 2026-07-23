/**
 * Shared v3 domain types consumed by the server engine, the HTTP API, and the
 * `falcon` CLI. This module must never import server code (doc 06).
 */

/** Actor identity is credential identity (doc 02 actor model). */
export type ActorKind = 'person' | 'agent' | 'system';

export interface Actor {
	kind: ActorKind;
	/** Authoritative identity: agent id, person identity, or system process name. */
	id: string;
	/** Historical display-label snapshot recorded on every command/event. */
	label: string;
}

/**
 * Compact source reference (doc 03 schema). `kind` is the native record
 * family: message, human_statement, file, url, work_event, run, commit,
 * document, email, external. Secrets never enter source refs.
 */
export interface SourceRef {
	kind: string;
	ref: string;
	label?: string;
	captured_at?: number;
	locator?: string;
	snapshot_ref?: string;
	content_hash?: string;
}

/** Minimal shared entity envelope (doc 01). */
export interface EntityEnvelope {
	id: string;
	type: string;
	area_id: string | null;
	created_at: number;
	updated_at: number;
	version: number;
}

/** Domain event as published to the Event Log, the bus, and SSE. */
export interface Work3Event {
	/** ULID — stable across outbox and Event Log. */
	id: string;
	occurred_at: number;
	command: string;
	event_type: string;
	subject_type: string;
	subject_id: string;
	actor: Actor;
	version_from: number | null;
	version_to: number | null;
	/** Deterministic summary per controlled event type (doc 01 Event Log rules). */
	summary: string;
	payload: Record<string, unknown>;
	source_refs: SourceRef[];
}

/** Body shape of POST /api/v3/commands/[command] and the in-process dispatch. */
export interface CommandRequest {
	target?: string;
	expected_version?: number;
	idempotency_key?: string;
	payload?: Record<string, unknown>;
}

export interface CommandSuccess<TResult = unknown> {
	ok: true;
	command: string;
	result: TResult;
	events: Work3Event[];
	/** True when this call was served from the idempotency record. */
	replayed: boolean;
	/** True when the transition was already achieved and the command no-opped. */
	noop: boolean;
}
