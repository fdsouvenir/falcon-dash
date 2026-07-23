/**
 * Structured error contract for v3 semantic commands (docs 02, 06).
 *
 * One canonical code set shared by the engine, the HTTP API, and the CLI so
 * the surfaces cannot drift. Doc 02 uses `invalid_transition`/`revision_conflict`
 * as loose class names for what doc 06 pins as `transition_not_allowed`/
 * `version_conflict`; the doc-06 names are canonical here.
 */

export const WORK3_ERROR_CODES = [
	'unknown_command',
	'not_found',
	'validation_failed',
	'transition_not_allowed',
	'transition_requirements_not_met',
	'authority_required',
	'authorization_invalid',
	'version_conflict',
	'idempotency_conflict',
	'invariant_violation',
	'runtime_unavailable',
	'internal_error'
] as const;

export type Work3ErrorCode = (typeof WORK3_ERROR_CODES)[number];

/** HTTP status per error code (used by /api/v3 and the operator-UI adapter). */
export const WORK3_ERROR_HTTP_STATUS: Record<Work3ErrorCode, number> = {
	unknown_command: 404,
	not_found: 404,
	validation_failed: 400,
	transition_not_allowed: 409,
	transition_requirements_not_met: 422,
	authority_required: 403,
	authorization_invalid: 403,
	version_conflict: 409,
	idempotency_conflict: 409,
	invariant_violation: 422,
	runtime_unavailable: 502,
	internal_error: 500
};

/**
 * CLI exit classes (doc 04: stable nonzero exit codes). Grouped, not 1:1,
 * so scripts can branch on failure class without enumerating codes.
 */
export const WORK3_ERROR_EXIT_CLASS: Record<Work3ErrorCode, number> = {
	unknown_command: 2,
	validation_failed: 2,
	not_found: 3,
	transition_not_allowed: 4,
	transition_requirements_not_met: 4,
	invariant_violation: 4,
	version_conflict: 5,
	idempotency_conflict: 5,
	authority_required: 6,
	authorization_invalid: 6,
	runtime_unavailable: 7,
	internal_error: 1
};

export interface Work3ErrorShape {
	code: Work3ErrorCode;
	message: string;
	/** Object/revision/state context relevant to the failure. */
	details?: Record<string, unknown>;
	/** Useful valid commands or next actions (from the command registry). */
	alternatives?: string[];
}

export class Work3Error extends Error {
	readonly code: Work3ErrorCode;
	readonly details: Record<string, unknown>;
	readonly alternatives: string[];

	constructor(
		code: Work3ErrorCode,
		message: string,
		options?: { details?: Record<string, unknown>; alternatives?: string[] }
	) {
		super(message);
		this.name = 'Work3Error';
		this.code = code;
		this.details = options?.details ?? {};
		this.alternatives = options?.alternatives ?? [];
	}

	toShape(): Work3ErrorShape {
		return {
			code: this.code,
			message: this.message,
			...(Object.keys(this.details).length > 0 ? { details: this.details } : {}),
			...(this.alternatives.length > 0 ? { alternatives: this.alternatives } : {})
		};
	}
}

export function isWork3Error(value: unknown): value is Work3Error {
	return value instanceof Work3Error;
}
