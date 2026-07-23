import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

/**
 * Derived governance state (doc 06, gate 2): Review disposition, Authorization
 * effectiveness, and scope fingerprints — computed on read, consumed by
 * projections AND guards so they cannot diverge. Nothing here is stored as
 * lifecycle state.
 */

export interface ReviewRow {
	entity_id: string;
	subject_type: string;
	subject_id: string;
	subject_revision: string;
	outcome: 'approved' | 'changes_requested' | 'rejected' | 'commented';
	summary: string;
	comments: string;
	source_refs: string;
	reviewer_kind: string;
	reviewer_id: string;
	reviewer_label: string;
	submitted_at: number;
}

export type ReviewDisposition = 'unreviewed' | 'approved' | 'changes_requested' | 'rejected';

export function reviewsFor(
	db: Database.Database,
	subjectId: string,
	subjectRevision?: string
): ReviewRow[] {
	if (subjectRevision !== undefined) {
		return db
			.prepare(
				`SELECT * FROM reviews WHERE subject_id = ? AND subject_revision = ? ORDER BY submitted_at ASC, entity_id ASC`
			)
			.all(subjectId, subjectRevision) as ReviewRow[];
	}
	return db
		.prepare(`SELECT * FROM reviews WHERE subject_id = ? ORDER BY submitted_at ASC, entity_id ASC`)
		.all(subjectId) as ReviewRow[];
}

/**
 * Disposition of an exact subject revision: the latest decisive Review wins;
 * `commented` reviews never change disposition (doc 02).
 */
export function reviewDisposition(
	db: Database.Database,
	subjectId: string,
	subjectRevision: string
): ReviewDisposition {
	const rows = reviewsFor(db, subjectId, subjectRevision);
	for (let i = rows.length - 1; i >= 0; i--) {
		if (rows[i].outcome !== 'commented') return rows[i].outcome as ReviewDisposition;
	}
	return 'unreviewed';
}

/** True when any Review of this revision carries unresolved required comments. */
export function hasRequiredComments(
	db: Database.Database,
	subjectId: string,
	subjectRevision: string
): boolean {
	const rows = reviewsFor(db, subjectId, subjectRevision);
	return rows.some((row) => {
		try {
			const comments = JSON.parse(row.comments) as Array<{ severity?: string }>;
			return comments.some((comment) => comment.severity === 'required');
		} catch {
			return false;
		}
	});
}

export interface AuthorizationRow {
	entity_id: string;
	subject_type: string;
	subject_id: string;
	subject_revision: string;
	plan_id: string | null;
	plan_revision: string | null;
	scope_fingerprint: string;
	conditions: string;
	one_time: number;
	authorizer_kind: string;
	authorizer_id: string;
	authorizer_label: string;
	authority_basis: string;
	granted_at: number;
	expires_at: number | null;
	revoked_at: number | null;
	revoke_reason: string | null;
	revoked_by: string | null;
	consumed_at: number | null;
	consumed_reason: string | null;
	source_refs: string;
}

export type AuthorizationEffectiveness =
	| 'valid'
	| 'expired'
	| 'revoked'
	| 'consumed'
	| 'invalidated';

export interface CurrentSubjectState {
	/** The subject's current revision id (change revision / plan revision …). */
	currentRevision: string;
	/** Current applicable Plan revision id, when a Plan governs the subject. */
	currentPlanRevision?: string | null;
	/** Current scope fingerprint of the subject. */
	currentScopeFingerprint?: string;
}

/**
 * Effectiveness is checked immediately before each governed action, not only
 * when work begins (doc 01). Terminal states never become valid again.
 */
export function authorizationEffectiveness(
	row: AuthorizationRow,
	subject: CurrentSubjectState,
	now: number = Date.now()
): { state: AuthorizationEffectiveness; reason?: string } {
	if (row.revoked_at !== null) return { state: 'revoked', reason: row.revoke_reason ?? undefined };
	if (row.consumed_at !== null) return { state: 'consumed' };
	if (row.expires_at !== null && now > row.expires_at) return { state: 'expired' };
	if (row.subject_revision !== subject.currentRevision) {
		return { state: 'invalidated', reason: 'subject revision changed since grant' };
	}
	if (
		subject.currentScopeFingerprint !== undefined &&
		row.scope_fingerprint !== subject.currentScopeFingerprint
	) {
		return { state: 'invalidated', reason: 'scope changed since grant' };
	}
	if (
		row.plan_revision !== null &&
		subject.currentPlanRevision !== undefined &&
		row.plan_revision !== subject.currentPlanRevision
	) {
		return { state: 'invalidated', reason: 'Plan revision changed since grant' };
	}
	return { state: 'valid' };
}

export function authorizationsFor(db: Database.Database, subjectId: string): AuthorizationRow[] {
	return db
		.prepare(`SELECT * FROM authorizations WHERE subject_id = ? ORDER BY granted_at DESC`)
		.all(subjectId) as AuthorizationRow[];
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
	return `{${entries.join(',')}}`;
}

/** Scope fingerprint over the authority-relevant fields of a change revision. */
export function scopeFingerprint(revision: {
	scope_allowed: string;
	scope_prohibited: string | null;
	targets: string;
	risk: string;
}): string {
	return createHash('sha256')
		.update(
			stableStringify({
				scope_allowed: revision.scope_allowed,
				scope_prohibited: revision.scope_prohibited,
				targets: revision.targets,
				risk: revision.risk
			})
		)
		.digest('hex');
}
