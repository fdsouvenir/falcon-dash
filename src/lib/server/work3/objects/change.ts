import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRefs } from '$lib/work3-shared/sources.js';
import { allocateEntityId, insertEntity } from '../envelope.js';
import { humanAuthorityPreGuard, extractAuthoritySource } from '../engine/authority.js';
import { registerCommand, type ExecuteContext } from '../engine/registry.js';
import { optionalNumber, optionalString, requireString } from '../engine/validate.js';
import { activeBlockersFor } from '../read/derived.js';
import {
	authorizationEffectiveness,
	authorizationsFor,
	scopeFingerprint,
	type AuthorizationRow
} from '../read/governance-derived.js';
import { ulid } from '../ulid.js';
import { requireActiveArea } from './area.js';
import { createPlanInternal, currentPlanRevision } from './plan.js';

/**
 * Change Request (docs 01–02): the authority envelope for controlled mutation.
 * Two canonical state machines (execution + verification); Authorization state
 * is derived from Authorization artifacts and rechecked before EVERY governed
 * action. Plan approval never authorizes execution.
 */

export const EXECUTION_STATES = [
	'not_started',
	'in_progress',
	'paused',
	'succeeded',
	'failed',
	'cancelled',
	'rolled_back'
] as const;

export const VERIFICATION_STATES = [
	'not_started',
	'in_progress',
	'passed',
	'failed',
	'waived'
] as const;

export interface ChangeRow {
	entity_id: string;
	project_id: string | null;
	phase_id: string | null;
	title: string;
	summary: string | null;
	execution_state: (typeof EXECUTION_STATES)[number];
	verification_state: (typeof VERIFICATION_STATES)[number];
	plan_id: string | null;
	criteria_status: string;
	result_summary: string | null;
	failure_summary: string | null;
	cancel_reason: string | null;
	execution_started_at: number | null;
	execution_finished_at: number | null;
	verification_finished_at: number | null;
	verification_waived_reason: string | null;
	rollback_started_at: number | null;
	rolled_back_at: number | null;
}

export interface ChangeRevisionRow {
	id: string;
	parent_id: string;
	supersedes: string | null;
	is_current: number;
	created_at: number;
	scope_allowed: string;
	scope_prohibited: string | null;
	targets: string;
	risk: string;
	safety: string | null;
	acceptance_criteria: string;
}

export function loadChange(db: Database.Database, id: string): ChangeRow | null {
	return (
		(db.prepare('SELECT * FROM change_requests WHERE entity_id = ?').get(id) as ChangeRow) ?? null
	);
}

export function currentChangeRevision(
	db: Database.Database,
	changeId: string
): ChangeRevisionRow | null {
	return (
		(db
			.prepare('SELECT * FROM change_revisions WHERE parent_id = ? AND is_current = 1')
			.get(changeId) as ChangeRevisionRow) ?? null
	);
}

function change(ctx: ExecuteContext): ChangeRow {
	const row = loadChange(ctx.db, ctx.targetId!);
	if (!row)
		throw new Work3Error('invariant_violation', `Change head row missing for ${ctx.targetId}`);
	return row;
}

/** Current subject state for authorization-effectiveness checks. */
export function changeSubjectState(db: Database.Database, changeId: string) {
	const revision = currentChangeRevision(db, changeId);
	if (!revision) throw new Work3Error('invariant_violation', `Change ${changeId} has no revision`);
	const changeRow = loadChange(db, changeId)!;
	const planRevision = changeRow.plan_id ? currentPlanRevision(db, changeRow.plan_id) : null;
	return {
		currentRevision: revision.id,
		currentPlanRevision: planRevision?.id ?? null,
		currentScopeFingerprint: scopeFingerprint(revision)
	};
}

/** The currently effective (valid) Authorization for a change, if any. */
export function effectiveAuthorization(
	db: Database.Database,
	changeId: string,
	now: number
):
	| { row: AuthorizationRow; state: 'valid' }
	| { row: AuthorizationRow | null; state: string; reason?: string } {
	const rows = authorizationsFor(db, changeId);
	if (rows.length === 0) return { row: null, state: 'missing' };
	const subject = changeSubjectState(db, changeId);
	// Most recent grant determines the effective state; earlier terminal grants
	// stay historical.
	const latest = rows[0];
	const effectiveness = authorizationEffectiveness(latest, subject, now);
	return { row: latest, state: effectiveness.state, reason: effectiveness.reason };
}

/** Guard: valid Authorization, rechecked immediately before the action. */
function requireValidAuthorization(ctx: ExecuteContext, action: string): AuthorizationRow {
	const result = effectiveAuthorization(ctx.db, ctx.targetId!, ctx.now);
	if (result.state !== 'valid' || !result.row) {
		throw new Work3Error(
			'authorization_invalid',
			`${action} requires valid Authorization (current state: ${result.state}${'reason' in result && result.reason ? ` — ${result.reason}` : ''})`,
			{
				details: {
					authorization_state: result.state,
					authorization_id: result.row?.entity_id ?? null
				},
				alternatives: ['authorize_change']
			}
		);
	}
	return result.row;
}

interface ParsedChangePackage {
	scope_allowed: string;
	scope_prohibited: string | null;
	targets: string;
	risk: string;
	safety: string | null;
	acceptance_criteria: string;
}

interface AcceptanceCriterion {
	id: string;
	text: string;
}

function parseChangePackage(payload: Record<string, unknown>): ParsedChangePackage {
	const scopeAllowed = payload.scope_allowed;
	if (!Array.isArray(scopeAllowed) || scopeAllowed.length === 0) {
		throw new Work3Error(
			'validation_failed',
			'scope_allowed must be a non-empty array of allowed scope items'
		);
	}
	const targets = payload.targets;
	if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
		throw new Work3Error(
			'validation_failed',
			'targets must be an object ({systems, resources, operations})'
		);
	}
	const risk = payload.risk;
	if (
		!risk ||
		typeof risk !== 'object' ||
		typeof (risk as Record<string, unknown>).level !== 'string'
	) {
		throw new Work3Error('validation_failed', 'risk must be an object with at least a level');
	}
	const rawCriteria = payload.acceptance_criteria;
	if (!Array.isArray(rawCriteria) || rawCriteria.length === 0) {
		throw new Work3Error('validation_failed', 'acceptance_criteria must be a non-empty array');
	}
	const criteria: AcceptanceCriterion[] = rawCriteria.map((entry, index) => {
		if (typeof entry === 'string') return { id: `c${index + 1}`, text: entry };
		if (entry && typeof entry === 'object') {
			const candidate = entry as Record<string, unknown>;
			if (typeof candidate.text !== 'string' || candidate.text.trim().length === 0) {
				throw new Work3Error('validation_failed', `acceptance_criteria[${index}].text is required`);
			}
			return {
				id: typeof candidate.id === 'string' ? candidate.id : `c${index + 1}`,
				text: candidate.text
			};
		}
		throw new Work3Error(
			'validation_failed',
			`acceptance_criteria[${index}] must be a string or object`
		);
	});
	const ids = new Set(criteria.map((criterion) => criterion.id));
	if (ids.size !== criteria.length) {
		throw new Work3Error('validation_failed', 'acceptance criteria ids must be unique');
	}
	const scopeProhibited = payload.scope_prohibited;
	if (scopeProhibited !== undefined && !Array.isArray(scopeProhibited)) {
		throw new Work3Error('validation_failed', 'scope_prohibited must be an array');
	}
	return {
		scope_allowed: JSON.stringify(scopeAllowed),
		scope_prohibited: scopeProhibited !== undefined ? JSON.stringify(scopeProhibited) : null,
		targets: JSON.stringify(targets),
		risk: JSON.stringify(risk),
		safety: payload.safety !== undefined ? JSON.stringify(payload.safety) : null,
		acceptance_criteria: JSON.stringify(criteria)
	};
}

function changeEvent(
	ctx: ExecuteContext,
	eventType: string,
	summary: string,
	payload: Record<string, unknown> = {}
) {
	return {
		event_type: eventType,
		subject_type: 'change_request',
		subject_id: ctx.targetId!,
		summary,
		payload
	};
}

export function registerChangeCommands(): void {
	registerCommand({
		name: 'create_change',
		targetType: null,
		summary: 'Create a Change Request with its complete authority-ready package and Plan',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'area_id');
			requireString(payload, 'title', { maxLength: 300 });
			parseChangePackage(payload);
			const plan = payload.plan;
			if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
				throw new Work3Error(
					'validation_failed',
					'plan is required ({title, steps, ...}) — the package includes the current Plan'
				);
			}
		},
		execute: (ctx) => {
			const areaId = requireString(ctx.payload, 'area_id');
			requireActiveArea(ctx.db, areaId);
			const title = requireString(ctx.payload, 'title', { maxLength: 300 });
			const parsed = parseChangePackage(ctx.payload);

			const id = allocateEntityId(ctx.db, 'change_request');
			insertEntity(ctx.db, { id, type: 'change_request', areaId, now: ctx.now });

			// The Change's Plan is created atomically as draft revision 1.
			const planPayload = ctx.payload.plan as Record<string, unknown>;
			const planTitle =
				typeof planPayload.title === 'string' && planPayload.title.trim().length > 0
					? planPayload.title
					: `Plan: ${title}`;
			const rawSteps = Array.isArray(planPayload.steps) ? planPayload.steps : null;
			if (!rawSteps || rawSteps.length === 0) {
				throw new Work3Error('validation_failed', 'plan.steps must be a non-empty array');
			}
			const steps = rawSteps.map((step) =>
				typeof step === 'string' ? { step } : (step as Record<string, unknown>)
			);
			const { planId, revisionId } = createPlanInternal(ctx, {
				workItemId: id,
				title: planTitle,
				summary: typeof planPayload.summary === 'string' ? planPayload.summary : null,
				steps: JSON.stringify(steps)
			});

			ctx.db
				.prepare(
					`INSERT INTO change_requests (entity_id, title, summary, plan_id) VALUES (?, ?, ?, ?)`
				)
				.run(id, title, optionalString(ctx.payload, 'summary') ?? null, planId);
			const revision = ulid(ctx.now);
			ctx.db
				.prepare(
					`INSERT INTO change_revisions (id, parent_id, supersedes, is_current, created_at,
					 scope_allowed, scope_prohibited, targets, risk, safety, acceptance_criteria)
					 VALUES (?, ?, NULL, 1, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					revision,
					id,
					ctx.now,
					parsed.scope_allowed,
					parsed.scope_prohibited,
					parsed.targets,
					parsed.risk,
					parsed.safety,
					parsed.acceptance_criteria
				);
			return {
				result: { id, revision_id: revision, plan_id: planId, plan_revision_id: revisionId },
				events: [
					{
						event_type: 'change_created',
						subject_type: 'change_request',
						subject_id: id,
						summary: `Created Change Request ${id}: ${title}`,
						version_from: null,
						version_to: 1,
						payload: { title, revision_id: revision, plan_id: planId }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'revise_change',
		targetType: 'change_request',
		summary: 'Replace the authority-ready package (invalidates pinned Authorization)',
		requiresTarget: true,
		validate: (payload) => {
			parseChangePackage(payload);
		},
		guards: [
			(ctx) => {
				const row = change(ctx);
				if (['succeeded', 'cancelled', 'rolled_back'].includes(row.execution_state)) {
					throw new Work3Error(
						'transition_not_allowed',
						`Cannot revise a ${row.execution_state} Change`
					);
				}
			}
		],
		execute: (ctx) => {
			const parsed = parseChangePackage(ctx.payload);
			const prior = currentChangeRevision(ctx.db, ctx.targetId!)!;
			ctx.db.prepare(`UPDATE change_revisions SET is_current = 0 WHERE id = ?`).run(prior.id);
			const revision = ulid(ctx.now);
			ctx.db
				.prepare(
					`INSERT INTO change_revisions (id, parent_id, supersedes, is_current, created_at,
					 scope_allowed, scope_prohibited, targets, risk, safety, acceptance_criteria)
					 VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					revision,
					ctx.targetId,
					prior.id,
					ctx.now,
					parsed.scope_allowed,
					parsed.scope_prohibited,
					parsed.targets,
					parsed.risk,
					parsed.safety,
					parsed.acceptance_criteria
				);
			return {
				result: { id: ctx.targetId!, revision_id: revision },
				events: [
					changeEvent(
						ctx,
						'change_revised',
						`Revised Change ${ctx.targetId} package (authorization invalidated)`,
						{
							revision_id: revision,
							supersedes: prior.id
						}
					)
				]
			};
		}
	});

	registerCommand({
		name: 'authorize_change',
		targetType: 'change_request',
		summary: 'Grant Authorization pinned to the exact Change + Plan revisions and scope',
		requiresTarget: true,
		validate: (payload) => {
			optionalNumber(payload, 'expires_at');
		},
		preGuards: [humanAuthorityPreGuard],
		execute: (ctx) => {
			const row = change(ctx);
			const revision = currentChangeRevision(ctx.db, ctx.targetId!);
			if (!revision) throw new Work3Error('invariant_violation', 'Change has no revision');
			const planRevision = row.plan_id ? currentPlanRevision(ctx.db, row.plan_id) : null;
			if (!planRevision || planRevision.state !== 'submitted') {
				throw new Work3Error(
					'transition_requirements_not_met',
					'Authorization pins a submitted Plan revision; submit the Plan first',
					{
						details: { plan_id: row.plan_id, plan_state: planRevision?.state ?? 'none' },
						alternatives: ['submit_plan']
					}
				);
			}
			// Idempotent: an existing valid grant over the same pins is returned.
			const existing = effectiveAuthorization(ctx.db, ctx.targetId!, ctx.now);
			if (existing.state === 'valid' && existing.row) {
				return {
					result: { id: existing.row.entity_id, change_id: ctx.targetId!, state: 'valid' },
					events: [],
					noop: true
				};
			}
			const conditions = ctx.payload.conditions;
			if (conditions !== undefined && !Array.isArray(conditions)) {
				throw new Work3Error(
					'validation_failed',
					'conditions must be an array of enforceable boundaries'
				);
			}
			const authoritySource = extractAuthoritySource(ctx.payload);
			const sourceRefs = parseSourceRefs(ctx.payload.source_refs);
			const id = allocateEntityId(ctx.db, 'authorization');
			insertEntity(ctx.db, {
				id,
				type: 'authorization',
				areaId: ctx.envelope!.area_id,
				now: ctx.now
			});
			ctx.db
				.prepare(
					`INSERT INTO authorizations (entity_id, subject_type, subject_id, subject_revision,
					 plan_id, plan_revision, scope_fingerprint, conditions, one_time,
					 authorizer_kind, authorizer_id, authorizer_label, authority_basis, granted_at, expires_at, source_refs)
					 VALUES (?, 'change_request', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					ctx.targetId,
					revision.id,
					row.plan_id,
					planRevision.id,
					scopeFingerprint(revision),
					JSON.stringify(conditions ?? []),
					ctx.payload.one_time === true ? 1 : 0,
					ctx.actor.kind,
					ctx.actor.id,
					ctx.actor.label,
					JSON.stringify(
						ctx.actor.kind === 'person'
							? { kind: 'person_session', label: ctx.actor.label }
							: { kind: 'asserted_instruction', source_ref: authoritySource }
					),
					ctx.now,
					optionalNumber(ctx.payload, 'expires_at') ?? null,
					JSON.stringify(sourceRefs)
				);
			return {
				result: {
					id,
					change_id: ctx.targetId!,
					change_revision: revision.id,
					plan_revision: planRevision.id
				},
				events: [
					{
						event_type: 'authorization_granted',
						subject_type: 'authorization',
						subject_id: id,
						summary: `Granted Authorization ${id} for Change ${ctx.targetId} (revision-pinned)`,
						version_from: null,
						version_to: 1,
						payload: {
							change_id: ctx.targetId!,
							change_revision: revision.id,
							plan_revision: planRevision.id,
							one_time: ctx.payload.one_time === true
						},
						source_refs: authoritySource ? [authoritySource, ...sourceRefs] : sourceRefs
					}
				]
			};
		}
	});

	registerCommand({
		name: 'revoke_authorization',
		targetType: 'authorization',
		summary: 'Revoke an Authorization (requires reason and human authority basis)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		preGuards: [humanAuthorityPreGuard],
		execute: (ctx) => {
			const row = ctx.db
				.prepare('SELECT * FROM authorizations WHERE entity_id = ?')
				.get(ctx.targetId) as AuthorizationRow | undefined;
			if (!row)
				throw new Work3Error(
					'invariant_violation',
					`Authorization head row missing for ${ctx.targetId}`
				);
			if (row.revoked_at !== null) {
				return { result: { id: row.entity_id, state: 'revoked' }, events: [], noop: true };
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE authorizations SET revoked_at = ?, revoke_reason = ?, revoked_by = ? WHERE entity_id = ?`
				)
				.run(ctx.now, reason, `${ctx.actor.kind}:${ctx.actor.id}`, ctx.targetId);
			return {
				result: { id: row.entity_id, state: 'revoked' },
				events: [
					{
						event_type: 'authorization_revoked',
						subject_type: 'authorization',
						subject_id: row.entity_id,
						summary: `Revoked Authorization ${row.entity_id}: ${reason}`,
						payload: { change_id: row.subject_id, reason }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'start_change',
		targetType: 'change_request',
		summary: 'Begin controlled execution (requires valid Authorization, unblocked)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = change(ctx);
			if (row.execution_state === 'in_progress') {
				return {
					result: { id: row.entity_id, execution_state: row.execution_state },
					events: [],
					noop: true
				};
			}
			if (row.execution_state !== 'not_started') {
				throw new Work3Error(
					'transition_not_allowed',
					`start_change is not allowed from ${row.execution_state}`,
					{
						details: { execution_state: row.execution_state },
						alternatives: row.execution_state === 'failed' ? ['retry_change'] : []
					}
				);
			}
			const blockers = activeBlockersFor(ctx.db, row.entity_id);
			if (blockers.length > 0) {
				throw new Work3Error(
					'transition_requirements_not_met',
					`Change is blocked by ${blockers.length} active blocker(s)`,
					{
						details: { blockers: blockers.map((blocker) => blocker.reason) },
						alternatives: ['resolve_blocker', 'invalidate_blocker']
					}
				);
			}
			const authorization = requireValidAuthorization(ctx, 'start_change');
			ctx.db
				.prepare(
					`UPDATE change_requests SET execution_state = 'in_progress', execution_started_at = ? WHERE entity_id = ?`
				)
				.run(ctx.now, row.entity_id);
			return {
				result: {
					id: row.entity_id,
					execution_state: 'in_progress',
					authorization_id: authorization.entity_id
				},
				events: [
					changeEvent(
						ctx,
						'change_started',
						`Started Change ${row.entity_id} under ${authorization.entity_id}`
					)
				]
			};
		}
	});

	registerCommand({
		name: 'pause_change',
		targetType: 'change_request',
		summary: 'Pause execution deliberately',
		requiresTarget: true,
		execute: (ctx) => {
			const row = change(ctx);
			if (row.execution_state === 'paused') {
				return {
					result: { id: row.entity_id, execution_state: row.execution_state },
					events: [],
					noop: true
				};
			}
			if (row.execution_state !== 'in_progress') {
				throw new Work3Error(
					'transition_not_allowed',
					`pause_change is not allowed from ${row.execution_state}`
				);
			}
			ctx.db
				.prepare(`UPDATE change_requests SET execution_state = 'paused' WHERE entity_id = ?`)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, execution_state: 'paused' },
				events: [changeEvent(ctx, 'change_paused', `Paused Change ${row.entity_id}`)]
			};
		}
	});

	registerCommand({
		name: 'resume_change',
		targetType: 'change_request',
		summary: 'Resume paused execution (authorization rechecked)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = change(ctx);
			if (row.execution_state === 'in_progress') {
				return {
					result: { id: row.entity_id, execution_state: row.execution_state },
					events: [],
					noop: true
				};
			}
			if (row.execution_state !== 'paused') {
				throw new Work3Error(
					'transition_not_allowed',
					`resume_change is not allowed from ${row.execution_state}`
				);
			}
			requireValidAuthorization(ctx, 'resume_change');
			ctx.db
				.prepare(`UPDATE change_requests SET execution_state = 'in_progress' WHERE entity_id = ?`)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, execution_state: 'in_progress' },
				events: [changeEvent(ctx, 'change_resumed', `Resumed Change ${row.entity_id}`)]
			};
		}
	});

	registerCommand({
		name: 'succeed_execution',
		targetType: 'change_request',
		summary: 'Record successful execution (requires result summary; consumes one-time authority)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'result_summary');
		},
		execute: (ctx) => {
			const row = change(ctx);
			if (row.execution_state === 'succeeded') {
				return {
					result: { id: row.entity_id, execution_state: row.execution_state },
					events: [],
					noop: true
				};
			}
			if (row.execution_state !== 'in_progress') {
				throw new Work3Error(
					'transition_not_allowed',
					`succeed_execution is not allowed from ${row.execution_state}`
				);
			}
			const authorization = requireValidAuthorization(ctx, 'succeed_execution');
			const resultSummary = requireString(ctx.payload, 'result_summary');
			ctx.db
				.prepare(
					`UPDATE change_requests SET execution_state = 'succeeded', result_summary = ?, execution_finished_at = ? WHERE entity_id = ?`
				)
				.run(resultSummary, ctx.now, row.entity_id);
			const events = [
				changeEvent(
					ctx,
					'change_execution_succeeded',
					`Change ${row.entity_id} execution succeeded`,
					{
						result_summary: resultSummary
					}
				)
			];
			// consumed represents one-time authority (doc 01).
			if (authorization.one_time === 1) {
				ctx.db
					.prepare(
						`UPDATE authorizations SET consumed_at = ?, consumed_reason = ? WHERE entity_id = ?`
					)
					.run(
						ctx.now,
						'one-time authority exercised by succeed_execution',
						authorization.entity_id
					);
				ctx.db
					.prepare('UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ?')
					.run(ctx.now, authorization.entity_id);
				events.push({
					event_type: 'authorization_consumed',
					subject_type: 'authorization',
					subject_id: authorization.entity_id,
					summary: `Authorization ${authorization.entity_id} consumed (one-time)`,
					payload: { change_id: row.entity_id }
				});
			}
			return { result: { id: row.entity_id, execution_state: 'succeeded' }, events };
		}
	});

	registerCommand({
		name: 'fail_execution',
		targetType: 'change_request',
		summary: 'Record execution failure (requires failure summary)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'failure_summary');
		},
		execute: (ctx) => {
			const row = change(ctx);
			if (row.execution_state === 'failed') {
				return {
					result: { id: row.entity_id, execution_state: row.execution_state },
					events: [],
					noop: true
				};
			}
			if (row.execution_state !== 'in_progress') {
				throw new Work3Error(
					'transition_not_allowed',
					`fail_execution is not allowed from ${row.execution_state}`
				);
			}
			const failureSummary = requireString(ctx.payload, 'failure_summary');
			ctx.db
				.prepare(
					`UPDATE change_requests SET execution_state = 'failed', failure_summary = ?, execution_finished_at = ? WHERE entity_id = ?`
				)
				.run(failureSummary, ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, execution_state: 'failed' },
				events: [
					changeEvent(
						ctx,
						'change_execution_failed',
						`Change ${row.entity_id} execution failed: ${failureSummary}`,
						{
							failure_summary: failureSummary
						}
					)
				]
			};
		}
	});

	registerCommand({
		name: 'retry_change',
		targetType: 'change_request',
		summary: 'Retry failed execution (legal only inside current Authorization)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = change(ctx);
			if (row.execution_state === 'in_progress') {
				return {
					result: { id: row.entity_id, execution_state: row.execution_state },
					events: [],
					noop: true
				};
			}
			if (row.execution_state !== 'failed') {
				throw new Work3Error(
					'transition_not_allowed',
					`retry_change is not allowed from ${row.execution_state}`
				);
			}
			requireValidAuthorization(ctx, 'retry_change');
			ctx.db
				.prepare(
					`UPDATE change_requests SET execution_state = 'in_progress', failure_summary = NULL WHERE entity_id = ?`
				)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, execution_state: 'in_progress' },
				events: [
					changeEvent(
						ctx,
						'change_retried',
						`Retrying Change ${row.entity_id} inside current Authorization`
					)
				]
			};
		}
	});

	registerCommand({
		name: 'cancel_change',
		targetType: 'change_request',
		summary: 'Cancel the Change (requires a reason; preserves history)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = change(ctx);
			if (row.execution_state === 'cancelled') {
				return {
					result: { id: row.entity_id, execution_state: row.execution_state },
					events: [],
					noop: true
				};
			}
			if (['succeeded', 'rolled_back'].includes(row.execution_state)) {
				throw new Work3Error(
					'transition_not_allowed',
					`cancel_change is not allowed from ${row.execution_state}`,
					{
						alternatives: ['start_rollback']
					}
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE change_requests SET execution_state = 'cancelled', cancel_reason = ? WHERE entity_id = ?`
				)
				.run(reason, row.entity_id);
			return {
				result: { id: row.entity_id, execution_state: 'cancelled' },
				events: [
					changeEvent(ctx, 'change_cancelled', `Cancelled Change ${row.entity_id}: ${reason}`, {
						reason
					})
				]
			};
		}
	});

	registerCommand({
		name: 'start_verification',
		targetType: 'change_request',
		summary: 'Begin verifying acceptance criteria (execution must have succeeded)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = change(ctx);
			if (row.verification_state === 'in_progress') {
				return {
					result: { id: row.entity_id, verification_state: row.verification_state },
					events: [],
					noop: true
				};
			}
			if (row.execution_state !== 'succeeded') {
				throw new Work3Error(
					'transition_requirements_not_met',
					'Verification starts after successful execution (execution and verification remain distinct facts)',
					{ details: { execution_state: row.execution_state } }
				);
			}
			if (!['not_started', 'failed'].includes(row.verification_state)) {
				throw new Work3Error(
					'transition_not_allowed',
					`start_verification is not allowed from ${row.verification_state}`
				);
			}
			ctx.db
				.prepare(
					`UPDATE change_requests SET verification_state = 'in_progress' WHERE entity_id = ?`
				)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, verification_state: 'in_progress' },
				events: [
					changeEvent(ctx, 'change_verification_started', `Verifying Change ${row.entity_id}`)
				]
			};
		}
	});

	registerCommand({
		name: 'pass_verification',
		targetType: 'change_request',
		summary: 'Pass verification (every criterion satisfied with sources, or waived)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = change(ctx);
			if (row.verification_state === 'passed') {
				return {
					result: { id: row.entity_id, verification_state: row.verification_state },
					events: [],
					noop: true
				};
			}
			if (row.verification_state !== 'in_progress') {
				throw new Work3Error(
					'transition_not_allowed',
					`pass_verification is not allowed from ${row.verification_state}`
				);
			}
			const revision = currentChangeRevision(ctx.db, row.entity_id)!;
			const criteria = JSON.parse(revision.acceptance_criteria) as AcceptanceCriterion[];
			const status = JSON.parse(row.criteria_status) as Record<string, unknown>;

			const evidence = ctx.payload.criteria_evidence;
			if (evidence !== undefined) {
				if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
					throw new Work3Error(
						'validation_failed',
						'criteria_evidence must be an object (criterion id → source_refs)'
					);
				}
				for (const [criterionId, refs] of Object.entries(evidence as Record<string, unknown>)) {
					if (!criteria.some((criterion) => criterion.id === criterionId)) {
						throw new Work3Error('validation_failed', `Unknown criterion: ${criterionId}`, {
							details: { criterion_ids: criteria.map((criterion) => criterion.id) }
						});
					}
					const parsedRefs = parseSourceRefs(refs, { required: true });
					status[criterionId] = { state: 'satisfied', source_refs: parsedRefs, at: ctx.now };
				}
			}

			const unsatisfied = criteria.filter((criterion) => {
				const entry = status[criterion.id] as { state?: string } | undefined;
				return !entry || (entry.state !== 'satisfied' && entry.state !== 'waived');
			});
			if (unsatisfied.length > 0) {
				throw new Work3Error(
					'transition_requirements_not_met',
					`Verification cannot pass: ${unsatisfied.length} criteria lack satisfaction evidence or a waiver`,
					{
						details: {
							unsatisfied: unsatisfied.map((criterion) => ({
								id: criterion.id,
								text: criterion.text
							}))
						},
						alternatives: ['waive_verification']
					}
				);
			}
			ctx.db
				.prepare(
					`UPDATE change_requests SET verification_state = 'passed', criteria_status = ?, verification_finished_at = ? WHERE entity_id = ?`
				)
				.run(JSON.stringify(status), ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, verification_state: 'passed' },
				events: [
					changeEvent(
						ctx,
						'change_verification_passed',
						`Change ${row.entity_id} verification passed`,
						{ criteria_status: status }
					)
				]
			};
		}
	});

	registerCommand({
		name: 'fail_verification',
		targetType: 'change_request',
		summary: 'Fail verification (requires summary of what failed)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'summary');
		},
		execute: (ctx) => {
			const row = change(ctx);
			if (row.verification_state === 'failed') {
				return {
					result: { id: row.entity_id, verification_state: row.verification_state },
					events: [],
					noop: true
				};
			}
			if (row.verification_state !== 'in_progress') {
				throw new Work3Error(
					'transition_not_allowed',
					`fail_verification is not allowed from ${row.verification_state}`
				);
			}
			const summary = requireString(ctx.payload, 'summary');
			ctx.db
				.prepare(
					`UPDATE change_requests SET verification_state = 'failed', verification_finished_at = ? WHERE entity_id = ?`
				)
				.run(ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, verification_state: 'failed' },
				events: [
					changeEvent(
						ctx,
						'change_verification_failed',
						`Change ${row.entity_id} verification failed: ${summary}`,
						{ summary }
					)
				]
			};
		}
	});

	registerCommand({
		name: 'waive_verification',
		targetType: 'change_request',
		summary: 'Waive verification with authority and rationale (authority-creating)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		preGuards: [humanAuthorityPreGuard],
		execute: (ctx) => {
			const row = change(ctx);
			if (row.verification_state === 'waived') {
				return {
					result: { id: row.entity_id, verification_state: row.verification_state },
					events: [],
					noop: true
				};
			}
			if (row.verification_state === 'passed') {
				throw new Work3Error(
					'transition_not_allowed',
					'Verification already passed; nothing to waive'
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			const authoritySource = extractAuthoritySource(ctx.payload);
			const revision = currentChangeRevision(ctx.db, row.entity_id)!;
			const criteria = JSON.parse(revision.acceptance_criteria) as AcceptanceCriterion[];
			const status = JSON.parse(row.criteria_status) as Record<string, unknown>;
			for (const criterion of criteria) {
				const entry = status[criterion.id] as { state?: string } | undefined;
				if (!entry || entry.state !== 'satisfied') {
					status[criterion.id] = { state: 'waived', reason, at: ctx.now };
				}
			}
			ctx.db
				.prepare(
					`UPDATE change_requests SET verification_state = 'waived', verification_waived_reason = ?,
					 criteria_status = ?, verification_finished_at = ? WHERE entity_id = ?`
				)
				.run(reason, JSON.stringify(status), ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, verification_state: 'waived' },
				events: [
					changeEvent(
						ctx,
						'change_verification_waived',
						`Change ${row.entity_id} verification waived: ${reason}`,
						{
							reason,
							authority_basis:
								ctx.actor.kind === 'person'
									? { kind: 'person_session' }
									: { kind: 'asserted_instruction', source_ref: authoritySource }
						}
					)
				]
			};
		}
	});

	registerCommand({
		name: 'start_rollback',
		targetType: 'change_request',
		summary: 'Begin rolling back an executed Change (history preserved)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = change(ctx);
			if (row.rollback_started_at !== null && row.execution_state !== 'rolled_back') {
				return {
					result: { id: row.entity_id, rollback_started_at: row.rollback_started_at },
					events: [],
					noop: true
				};
			}
			if (!['succeeded', 'failed'].includes(row.execution_state)) {
				throw new Work3Error(
					'transition_not_allowed',
					`start_rollback is not allowed from ${row.execution_state}`
				);
			}
			ctx.db
				.prepare(`UPDATE change_requests SET rollback_started_at = ? WHERE entity_id = ?`)
				.run(ctx.now, row.entity_id);
			return {
				result: {
					id: row.entity_id,
					execution_state: row.execution_state,
					rollback_started_at: ctx.now
				},
				events: [
					changeEvent(ctx, 'change_rollback_started', `Rolling back Change ${row.entity_id}`)
				]
			};
		}
	});

	registerCommand({
		name: 'complete_rollback',
		targetType: 'change_request',
		summary: 'Record completed rollback (execution becomes rolled_back)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'summary');
		},
		execute: (ctx) => {
			const row = change(ctx);
			if (row.execution_state === 'rolled_back') {
				return {
					result: { id: row.entity_id, execution_state: row.execution_state },
					events: [],
					noop: true
				};
			}
			if (row.rollback_started_at === null) {
				throw new Work3Error('transition_requirements_not_met', 'start_rollback first', {
					alternatives: ['start_rollback']
				});
			}
			const summary = requireString(ctx.payload, 'summary');
			ctx.db
				.prepare(
					`UPDATE change_requests SET execution_state = 'rolled_back', rolled_back_at = ? WHERE entity_id = ?`
				)
				.run(ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, execution_state: 'rolled_back' },
				events: [
					changeEvent(
						ctx,
						'change_rolled_back',
						`Change ${row.entity_id} rolled back: ${summary}`,
						{ summary }
					)
				]
			};
		}
	});
}
