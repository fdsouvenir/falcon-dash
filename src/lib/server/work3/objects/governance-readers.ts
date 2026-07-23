import { getWork3Db } from '../db.js';
import { listWork3Events } from '../eventlog.js';
import { registerObjectReader } from '../read/registry.js';
import {
	authorizationsFor,
	authorizationEffectiveness,
	reviewDisposition,
	reviewsFor,
	type AuthorizationRow,
	type ReviewRow
} from '../read/governance-derived.js';
import {
	changeSubjectState,
	currentChangeRevision,
	effectiveAuthorization,
	type ChangeRow
} from './change.js';
import { currentPlanRevision, planRevisions, type PlanRow } from './plan.js';

/** AXI projections for Plan, Review, Authorization, Change Request (doc 04). */

interface EnvelopeJoin {
	id: string;
	area_id: string | null;
	created_at: number;
	updated_at: number;
	version: number;
}

function parseJson<T>(raw: string | null, fallback: T): T {
	if (raw === null) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function reviewProjection(row: ReviewRow & Partial<EnvelopeJoin>): Record<string, unknown> {
	return {
		id: row.entity_id,
		subject_type: row.subject_type,
		subject_id: row.subject_id,
		subject_revision: row.subject_revision,
		outcome: row.outcome,
		summary: row.summary,
		comments: parseJson<unknown[]>(row.comments, []),
		reviewer: row.reviewer_label,
		submitted_at: row.submitted_at,
		source_refs: parseJson<unknown[]>(row.source_refs, [])
	};
}

function authorizationProjection(
	row: AuthorizationRow,
	effectiveness: { state: string; reason?: string }
): Record<string, unknown> {
	return {
		id: row.entity_id,
		subject_type: row.subject_type,
		subject_id: row.subject_id,
		subject_revision: row.subject_revision,
		plan_revision: row.plan_revision,
		scope_fingerprint: row.scope_fingerprint,
		conditions: parseJson<unknown[]>(row.conditions, []),
		one_time: row.one_time === 1,
		authorizer: row.authorizer_label,
		authority_basis: parseJson<unknown>(row.authority_basis, null),
		granted_at: row.granted_at,
		expires_at: row.expires_at,
		effectiveness: effectiveness.state,
		...(effectiveness.reason ? { effectiveness_reason: effectiveness.reason } : {}),
		...(row.revoked_at ? { revoked_at: row.revoked_at, revoke_reason: row.revoke_reason } : {}),
		...(row.consumed_at ? { consumed_at: row.consumed_at } : {})
	};
}

/** Next legal command for a Change, from its derived overall situation. */
function changeNextAction(row: ChangeRow, authorizationState: string): string {
	if (row.execution_state === 'not_started') {
		return authorizationState === 'valid' ? 'start_change' : 'authorize_change';
	}
	if (row.execution_state === 'in_progress')
		return 'succeed_execution | fail_execution | pause_change';
	if (row.execution_state === 'paused') return 'resume_change';
	if (row.execution_state === 'failed')
		return authorizationState === 'valid' ? 'retry_change' : 'revise_change + authorize_change';
	if (row.execution_state === 'succeeded' && row.verification_state === 'not_started')
		return 'start_verification';
	if (row.verification_state === 'in_progress') return 'pass_verification | fail_verification';
	return 'none';
}

export function registerGovernanceReaders(): void {
	registerObjectReader({
		type: 'plan',
		aliases: ['plans'],
		knownFields: [
			'id',
			'title',
			'work_item_id',
			'revision',
			'revision_id',
			'state',
			'review_disposition',
			'summary',
			'steps',
			'assumptions',
			'risks',
			'out_of_scope',
			'validation_checks',
			'author',
			'revisions',
			'reviews',
			'version',
			'created_at',
			'updated_at',
			'history'
		],
		knownFilters: ['work_item'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.work_item) {
				clauses.push('p.work_item_id = ?');
				params.push(options.filters.work_item);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db.prepare(`SELECT COUNT(*) AS count FROM plans p ${where}`).get(...params) as {
					count: number;
				}
			).count;
			const rows = db
				.prepare(
					`SELECT p.*, e.id, e.created_at, e.updated_at, e.version
					 FROM plans p JOIN entities e ON e.id = p.entity_id ${where}
					 ORDER BY e.updated_at DESC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<PlanRow & EnvelopeJoin>;
			return { items: rows.map((row) => planProjection(row, options.view)), total };
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT p.*, e.id, e.created_at, e.updated_at, e.version
					 FROM plans p JOIN entities e ON e.id = p.entity_id WHERE p.entity_id = ?`
				)
				.get(id) as (PlanRow & EnvelopeJoin) | undefined;
			if (!row) return null;
			return planProjection(row, options.view === 'list' ? 'list' : options.view);
		}
	});

	registerObjectReader({
		type: 'review',
		aliases: ['reviews'],
		knownFields: [
			'id',
			'subject_type',
			'subject_id',
			'subject_revision',
			'outcome',
			'summary',
			'comments',
			'reviewer',
			'submitted_at',
			'source_refs'
		],
		knownFilters: ['subject', 'outcome'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.subject) {
				clauses.push('subject_id = ?');
				params.push(options.filters.subject);
			}
			if (options.filters.outcome) {
				clauses.push('outcome = ?');
				params.push(options.filters.outcome);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db.prepare(`SELECT COUNT(*) AS count FROM reviews ${where}`).get(...params) as {
					count: number;
				}
			).count;
			const rows = db
				.prepare(`SELECT * FROM reviews ${where} ORDER BY submitted_at DESC LIMIT ? OFFSET ?`)
				.all(...params, options.limit, options.offset) as ReviewRow[];
			return { items: rows.map((row) => reviewProjection(row)), total };
		},
		get: (id) => {
			const row = getWork3Db().prepare('SELECT * FROM reviews WHERE entity_id = ?').get(id) as
				| ReviewRow
				| undefined;
			return row ? reviewProjection(row) : null;
		}
	});

	registerObjectReader({
		type: 'authorization',
		aliases: ['authorizations'],
		knownFields: [
			'id',
			'subject_type',
			'subject_id',
			'subject_revision',
			'plan_revision',
			'scope_fingerprint',
			'conditions',
			'one_time',
			'authorizer',
			'authority_basis',
			'granted_at',
			'expires_at',
			'effectiveness',
			'effectiveness_reason',
			'revoked_at',
			'revoke_reason',
			'consumed_at'
		],
		knownFilters: ['subject'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.subject) {
				clauses.push('subject_id = ?');
				params.push(options.filters.subject);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db.prepare(`SELECT COUNT(*) AS count FROM authorizations ${where}`).get(...params) as {
					count: number;
				}
			).count;
			const rows = db
				.prepare(`SELECT * FROM authorizations ${where} ORDER BY granted_at DESC LIMIT ? OFFSET ?`)
				.all(...params, options.limit, options.offset) as AuthorizationRow[];
			return {
				items: rows.map((row) =>
					authorizationProjection(
						row,
						row.subject_type === 'change_request'
							? authorizationEffectiveness(row, changeSubjectState(db, row.subject_id))
							: { state: 'valid' }
					)
				),
				total
			};
		},
		get: (id) => {
			const db = getWork3Db();
			const row = db.prepare('SELECT * FROM authorizations WHERE entity_id = ?').get(id) as
				| AuthorizationRow
				| undefined;
			if (!row) return null;
			return authorizationProjection(
				row,
				row.subject_type === 'change_request'
					? authorizationEffectiveness(row, changeSubjectState(db, row.subject_id))
					: { state: 'valid' }
			);
		}
	});

	registerObjectReader({
		type: 'change_request',
		aliases: ['change', 'changes', 'change_requests'],
		knownFields: [
			'id',
			'title',
			'summary',
			'execution_state',
			'verification_state',
			'authorization',
			'next_action',
			'revision_id',
			'scope_allowed',
			'scope_prohibited',
			'targets',
			'risk',
			'safety',
			'acceptance_criteria',
			'criteria_status',
			'plan_id',
			'plan_revision',
			'plan_review_disposition',
			'result_summary',
			'failure_summary',
			'cancel_reason',
			'reviews',
			'authorizations',
			'area_id',
			'version',
			'created_at',
			'updated_at',
			'history'
		],
		knownFilters: ['execution', 'verification', 'area'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.execution) {
				clauses.push('c.execution_state = ?');
				params.push(options.filters.execution);
			}
			if (options.filters.verification) {
				clauses.push('c.verification_state = ?');
				params.push(options.filters.verification);
			}
			if (options.filters.area) {
				clauses.push('e.area_id = ?');
				params.push(options.filters.area);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db
					.prepare(
						`SELECT COUNT(*) AS count FROM change_requests c JOIN entities e ON e.id = c.entity_id ${where}`
					)
					.get(...params) as { count: number }
			).count;
			const rows = db
				.prepare(
					`SELECT c.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM change_requests c JOIN entities e ON e.id = c.entity_id ${where}
					 ORDER BY e.updated_at DESC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<ChangeRow & EnvelopeJoin>;
			return { items: rows.map((row) => changeProjection(row, options.view)), total };
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT c.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM change_requests c JOIN entities e ON e.id = c.entity_id WHERE c.entity_id = ?`
				)
				.get(id) as (ChangeRow & EnvelopeJoin) | undefined;
			if (!row) return null;
			return changeProjection(row, options.view === 'list' ? 'list' : options.view);
		}
	});
}

function planProjection(row: PlanRow & EnvelopeJoin, view: string): Record<string, unknown> {
	const db = getWork3Db();
	const current = currentPlanRevision(db, row.id);
	const disposition =
		current && current.state === 'submitted'
			? reviewDisposition(db, row.id, current.id)
			: 'unreviewed';
	const base = {
		id: row.id,
		title: row.title,
		work_item_id: row.work_item_id,
		revision: current?.revision_number ?? null,
		revision_id: current?.id ?? null,
		state: current?.state ?? 'none',
		review_disposition: disposition,
		version: row.version
	};
	if (view === 'list') return base;
	const detail = {
		...base,
		summary: current?.summary,
		steps: current ? parseJson<unknown[]>(current.steps, []) : [],
		assumptions: current?.assumptions,
		risks: current?.risks,
		out_of_scope: current?.out_of_scope,
		validation_checks: current?.validation_checks,
		author: current?.author_label,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
	if (view === 'full') {
		return {
			...detail,
			revisions: planRevisions(db, row.id).map((revision) => ({
				id: revision.id,
				revision: revision.revision_number,
				state: revision.state,
				created_at: revision.created_at,
				author: revision.author_label,
				review_disposition:
					revision.state === 'submitted' || revision.state === 'superseded'
						? reviewDisposition(db, row.id, revision.id)
						: 'unreviewed'
			})),
			reviews: reviewsFor(db, row.id).map((review) => reviewProjection(review)),
			history: listWork3Events({ subjectId: row.id, limit: 100 })
		};
	}
	return detail;
}

function changeProjection(row: ChangeRow & EnvelopeJoin, view: string): Record<string, unknown> {
	const db = getWork3Db();
	const authorization = effectiveAuthorization(db, row.id, Date.now());
	const base = {
		id: row.id,
		title: row.title,
		execution_state: row.execution_state,
		verification_state: row.verification_state,
		// Compact derived authorization state on every actionable projection —
		// the agent never has to remember to ask (doc 01).
		authorization: {
			state: authorization.state,
			...('reason' in authorization && authorization.reason
				? { reason: authorization.reason }
				: {}),
			...(authorization.row ? { id: authorization.row.entity_id } : {})
		},
		next_action: changeNextAction(row, authorization.state),
		version: row.version
	};
	if (view === 'list') return base;
	const revision = currentChangeRevision(db, row.id);
	const planRevision = row.plan_id ? currentPlanRevision(db, row.plan_id) : null;
	const detail = {
		...base,
		summary: row.summary,
		revision_id: revision?.id,
		scope_allowed: revision ? parseJson<unknown[]>(revision.scope_allowed, []) : [],
		scope_prohibited: revision ? parseJson<unknown[]>(revision.scope_prohibited, []) : [],
		targets: revision ? parseJson<unknown>(revision.targets, {}) : {},
		risk: revision ? parseJson<unknown>(revision.risk, {}) : {},
		safety: revision ? parseJson<unknown>(revision.safety, null) : null,
		acceptance_criteria: revision ? parseJson<unknown[]>(revision.acceptance_criteria, []) : [],
		criteria_status: parseJson<Record<string, unknown>>(row.criteria_status, {}),
		plan_id: row.plan_id,
		plan_revision: planRevision?.id ?? null,
		plan_review_disposition:
			row.plan_id && planRevision?.state === 'submitted'
				? reviewDisposition(db, row.plan_id, planRevision.id)
				: 'unreviewed',
		result_summary: row.result_summary,
		failure_summary: row.failure_summary,
		cancel_reason: row.cancel_reason,
		area_id: row.area_id,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
	if (view === 'full') {
		return {
			...detail,
			reviews: reviewsFor(db, row.id).map((review) => reviewProjection(review)),
			authorizations: authorizationsFor(db, row.id).map((auth) =>
				authorizationProjection(
					auth,
					authorizationEffectiveness(auth, changeSubjectState(db, row.id))
				)
			),
			history: listWork3Events({ subjectId: row.id, limit: 100 })
		};
	}
	return detail;
}
