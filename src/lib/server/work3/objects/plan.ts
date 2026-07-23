import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { allocateEntityId, insertEntity, loadEntity } from '../envelope.js';
import { registerCommand, type ExecuteContext } from '../engine/registry.js';
import { optionalString, requireString } from '../engine/validate.js';
import { ulid } from '../ulid.js';

/**
 * Plan artifact (docs 01–02): versioned, human-reviewable approach. Revision
 * lifecycle: draft (mutable) → submitted (immutable) → superseded | withdrawn.
 * revise_plan creates a linked draft; the prior submitted revision becomes
 * superseded only when the replacement is submitted. Review disposition is
 * derived from Review artifacts, never Plan state. Plan approval NEVER
 * authorizes controlled mutation.
 */

/** Work types a Plan may attach to (doc 01). */
const PLAN_ATTACHABLE = ['project', 'phase', 'task', 'change_request', 'automaton'];

export interface PlanRow {
	entity_id: string;
	work_item_id: string;
	title: string;
}

export interface PlanRevisionRow {
	id: string;
	parent_id: string;
	supersedes: string | null;
	is_current: number;
	created_at: number;
	revision_number: number;
	state: 'draft' | 'submitted' | 'superseded' | 'withdrawn';
	summary: string | null;
	steps: string;
	assumptions: string | null;
	risks: string | null;
	out_of_scope: string | null;
	validation_checks: string | null;
	author_kind: string;
	author_id: string;
	author_label: string;
	submitted_at: number | null;
	withdrawn_reason: string | null;
}

export function loadPlan(db: Database.Database, id: string): PlanRow | null {
	return (db.prepare('SELECT * FROM plans WHERE entity_id = ?').get(id) as PlanRow) ?? null;
}

export function planRevisions(db: Database.Database, planId: string): PlanRevisionRow[] {
	return db
		.prepare('SELECT * FROM plan_revisions WHERE parent_id = ? ORDER BY revision_number ASC')
		.all(planId) as PlanRevisionRow[];
}

/** The current applicable revision (what Work points to). */
export function currentPlanRevision(db: Database.Database, planId: string): PlanRevisionRow | null {
	return (
		(db
			.prepare('SELECT * FROM plan_revisions WHERE parent_id = ? AND is_current = 1')
			.get(planId) as PlanRevisionRow) ?? null
	);
}

export function latestDraftRevision(db: Database.Database, planId: string): PlanRevisionRow | null {
	return (
		(db
			.prepare(
				`SELECT * FROM plan_revisions WHERE parent_id = ? AND state = 'draft'
				 ORDER BY revision_number DESC LIMIT 1`
			)
			.get(planId) as PlanRevisionRow) ?? null
	);
}

function plan(ctx: ExecuteContext): PlanRow {
	const row = loadPlan(ctx.db, ctx.targetId!);
	if (!row)
		throw new Work3Error('invariant_violation', `Plan head row missing for ${ctx.targetId}`);
	return row;
}

function parseSteps(payload: Record<string, unknown>, required: boolean): string | undefined {
	const raw = payload.steps;
	if (raw === undefined) {
		if (required)
			throw new Work3Error('validation_failed', 'steps are required (ordered approach steps)');
		return undefined;
	}
	if (!Array.isArray(raw) || raw.length === 0) {
		throw new Work3Error('validation_failed', 'steps must be a non-empty array');
	}
	const steps = raw.map((entry, index) => {
		if (typeof entry === 'string') return { step: entry };
		if (entry && typeof entry === 'object') {
			const candidate = entry as Record<string, unknown>;
			if (typeof candidate.step !== 'string' || candidate.step.trim().length === 0) {
				throw new Work3Error('validation_failed', `steps[${index}].step is required`);
			}
			return {
				step: candidate.step,
				...(typeof candidate.expected_output === 'string'
					? { expected_output: candidate.expected_output }
					: {})
			};
		}
		throw new Work3Error('validation_failed', `steps[${index}] must be a string or object`);
	});
	return JSON.stringify(steps);
}

export interface CreatePlanInternalParams {
	workItemId: string;
	title: string;
	summary?: string | null;
	steps: string;
	assumptions?: string | null;
	risks?: string | null;
	outOfScope?: string | null;
	validationChecks?: string | null;
}

/** Shared with create_change, which creates its Plan atomically. */
export function createPlanInternal(
	ctx: ExecuteContext,
	params: CreatePlanInternalParams
): {
	planId: string;
	revisionId: string;
} {
	const planId = allocateEntityId(ctx.db, 'plan');
	const attached = loadEntity(ctx.db, params.workItemId);
	insertEntity(ctx.db, {
		id: planId,
		type: 'plan',
		areaId: attached?.area_id ?? null,
		now: ctx.now
	});
	ctx.db
		.prepare('INSERT INTO plans (entity_id, work_item_id, title) VALUES (?, ?, ?)')
		.run(planId, params.workItemId, params.title);
	const revisionId = ulid(ctx.now);
	ctx.db
		.prepare(
			`INSERT INTO plan_revisions (id, parent_id, supersedes, is_current, created_at, revision_number,
			 state, summary, steps, assumptions, risks, out_of_scope, validation_checks,
			 author_kind, author_id, author_label)
			 VALUES (?, ?, NULL, 1, ?, 1, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			revisionId,
			planId,
			ctx.now,
			params.summary ?? null,
			params.steps,
			params.assumptions ?? null,
			params.risks ?? null,
			params.outOfScope ?? null,
			params.validationChecks ?? null,
			ctx.actor.kind,
			ctx.actor.id,
			ctx.actor.label
		);
	return { planId, revisionId };
}

export function registerPlanCommands(): void {
	registerCommand({
		name: 'create_plan',
		targetType: null,
		summary: 'Create a Plan (draft revision 1) attached to a piece of Work',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'work_item_id');
			requireString(payload, 'title', { maxLength: 300 });
			parseSteps(payload, true);
		},
		execute: (ctx) => {
			const workItemId = requireString(ctx.payload, 'work_item_id');
			const attached = loadEntity(ctx.db, workItemId);
			if (!attached) throw new Work3Error('not_found', `No such Work item: ${workItemId}`);
			if (!PLAN_ATTACHABLE.includes(attached.type)) {
				throw new Work3Error(
					'invariant_violation',
					`Plans attach to ${PLAN_ATTACHABLE.join('/')}, not ${attached.type}`
				);
			}
			const { planId, revisionId } = createPlanInternal(ctx, {
				workItemId,
				title: requireString(ctx.payload, 'title', { maxLength: 300 }),
				summary: optionalString(ctx.payload, 'summary'),
				steps: parseSteps(ctx.payload, true)!,
				assumptions: optionalString(ctx.payload, 'assumptions'),
				risks: optionalString(ctx.payload, 'risks'),
				outOfScope: optionalString(ctx.payload, 'out_of_scope'),
				validationChecks: optionalString(ctx.payload, 'validation_checks')
			});
			return {
				result: { id: planId, revision_id: revisionId, revision: 1, state: 'draft' },
				events: [
					{
						event_type: 'plan_created',
						subject_type: 'plan',
						subject_id: planId,
						summary: `Created Plan ${planId} (draft) for ${workItemId}`,
						version_from: null,
						version_to: 1,
						payload: { work_item_id: workItemId, revision_id: revisionId }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'update_plan',
		targetType: 'plan',
		summary: 'Edit the draft revision in place (drafts only — submitted Plans are immutable)',
		requiresTarget: true,
		execute: (ctx) => {
			plan(ctx);
			const draft = latestDraftRevision(ctx.db, ctx.targetId!);
			if (!draft) {
				throw new Work3Error(
					'transition_not_allowed',
					'No draft revision to edit — submitted Plans are immutable',
					{
						alternatives: ['revise_plan']
					}
				);
			}
			const steps = parseSteps(ctx.payload, false);
			const next = {
				summary:
					ctx.payload.summary === undefined
						? draft.summary
						: (optionalString(ctx.payload, 'summary') ?? null),
				steps: steps ?? draft.steps,
				assumptions:
					ctx.payload.assumptions === undefined
						? draft.assumptions
						: (optionalString(ctx.payload, 'assumptions') ?? null),
				risks:
					ctx.payload.risks === undefined
						? draft.risks
						: (optionalString(ctx.payload, 'risks') ?? null),
				out_of_scope:
					ctx.payload.out_of_scope === undefined
						? draft.out_of_scope
						: (optionalString(ctx.payload, 'out_of_scope') ?? null),
				validation_checks:
					ctx.payload.validation_checks === undefined
						? draft.validation_checks
						: (optionalString(ctx.payload, 'validation_checks') ?? null)
			};
			const changed = (Object.keys(next) as Array<keyof typeof next>).filter(
				(key) => next[key] !== draft[key]
			);
			const title = optionalString(ctx.payload, 'title');
			if (changed.length === 0 && !title) {
				return { result: { id: ctx.targetId!, revision_id: draft.id }, events: [], noop: true };
			}
			ctx.db
				.prepare(
					`UPDATE plan_revisions SET summary = ?, steps = ?, assumptions = ?, risks = ?,
					 out_of_scope = ?, validation_checks = ? WHERE id = ?`
				)
				.run(
					next.summary,
					next.steps,
					next.assumptions,
					next.risks,
					next.out_of_scope,
					next.validation_checks,
					draft.id
				);
			if (title) {
				ctx.db.prepare('UPDATE plans SET title = ? WHERE entity_id = ?').run(title, ctx.targetId);
			}
			return {
				result: { id: ctx.targetId!, revision_id: draft.id, changed },
				events: [
					{
						event_type: 'plan_updated',
						subject_type: 'plan',
						subject_id: ctx.targetId!,
						summary: `Updated Plan ${ctx.targetId} draft`,
						payload: { revision_id: draft.id, changed_fields: changed }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'submit_plan',
		targetType: 'plan',
		summary:
			'Submit the draft revision (immutable from now; supersedes the prior submitted revision)',
		requiresTarget: true,
		execute: (ctx) => {
			plan(ctx);
			const draft = latestDraftRevision(ctx.db, ctx.targetId!);
			if (!draft) {
				const current = currentPlanRevision(ctx.db, ctx.targetId!);
				if (current?.state === 'submitted') {
					return {
						result: { id: ctx.targetId!, revision_id: current.id, state: 'submitted' },
						events: [],
						noop: true
					};
				}
				throw new Work3Error('transition_not_allowed', 'No draft revision to submit', {
					alternatives: ['revise_plan']
				});
			}
			// The prior submitted revision becomes superseded only now.
			const prior = currentPlanRevision(ctx.db, ctx.targetId!);
			if (prior && prior.id !== draft.id && prior.state === 'submitted') {
				ctx.db
					.prepare(`UPDATE plan_revisions SET state = 'superseded', is_current = 0 WHERE id = ?`)
					.run(prior.id);
			} else if (prior && prior.id !== draft.id) {
				ctx.db.prepare(`UPDATE plan_revisions SET is_current = 0 WHERE id = ?`).run(prior.id);
			}
			ctx.db
				.prepare(
					`UPDATE plan_revisions SET state = 'submitted', submitted_at = ?, is_current = 1 WHERE id = ?`
				)
				.run(ctx.now, draft.id);
			return {
				result: {
					id: ctx.targetId!,
					revision_id: draft.id,
					revision: draft.revision_number,
					state: 'submitted'
				},
				events: [
					{
						event_type: 'plan_submitted',
						subject_type: 'plan',
						subject_id: ctx.targetId!,
						summary: `Submitted Plan ${ctx.targetId} revision ${draft.revision_number}`,
						payload: {
							revision_id: draft.id,
							revision_number: draft.revision_number,
							supersedes: draft.supersedes
						}
					}
				]
			};
		}
	});

	registerCommand({
		name: 'revise_plan',
		targetType: 'plan',
		summary: 'Create a linked draft replacement for the submitted revision',
		requiresTarget: true,
		execute: (ctx) => {
			plan(ctx);
			const existingDraft = latestDraftRevision(ctx.db, ctx.targetId!);
			if (existingDraft) {
				// Idempotent: there is already an open draft.
				return {
					result: { id: ctx.targetId!, revision_id: existingDraft.id, state: 'draft' },
					events: [],
					noop: true
				};
			}
			const current = currentPlanRevision(ctx.db, ctx.targetId!);
			if (!current || current.state !== 'submitted') {
				throw new Work3Error(
					'transition_not_allowed',
					'revise_plan requires a submitted current revision',
					{
						details: { current_state: current?.state ?? 'none' }
					}
				);
			}
			const steps = parseSteps(ctx.payload, false);
			const revisionId = ulid(ctx.now);
			ctx.db
				.prepare(
					`INSERT INTO plan_revisions (id, parent_id, supersedes, is_current, created_at, revision_number,
					 state, summary, steps, assumptions, risks, out_of_scope, validation_checks,
					 author_kind, author_id, author_label)
					 VALUES (?, ?, ?, 0, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					revisionId,
					ctx.targetId,
					current.id,
					ctx.now,
					current.revision_number + 1,
					optionalString(ctx.payload, 'summary') ?? current.summary,
					steps ?? current.steps,
					optionalString(ctx.payload, 'assumptions') ?? current.assumptions,
					optionalString(ctx.payload, 'risks') ?? current.risks,
					optionalString(ctx.payload, 'out_of_scope') ?? current.out_of_scope,
					optionalString(ctx.payload, 'validation_checks') ?? current.validation_checks,
					ctx.actor.kind,
					ctx.actor.id,
					ctx.actor.label
				);
			return {
				result: {
					id: ctx.targetId!,
					revision_id: revisionId,
					revision: current.revision_number + 1,
					state: 'draft'
				},
				events: [
					{
						event_type: 'plan_revised',
						subject_type: 'plan',
						subject_id: ctx.targetId!,
						summary: `Opened Plan ${ctx.targetId} draft revision ${current.revision_number + 1}`,
						payload: { revision_id: revisionId, supersedes: current.id }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'withdraw_plan',
		targetType: 'plan',
		summary: 'Withdraw the current Plan revision (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			plan(ctx);
			const reason = requireString(ctx.payload, 'reason');
			// Withdraw an open draft first if present, else the current revision.
			const draft = latestDraftRevision(ctx.db, ctx.targetId!);
			const target = draft ?? currentPlanRevision(ctx.db, ctx.targetId!);
			if (!target) {
				throw new Work3Error('transition_not_allowed', 'No revision to withdraw');
			}
			if (target.state === 'withdrawn') {
				return { result: { id: ctx.targetId!, revision_id: target.id }, events: [], noop: true };
			}
			ctx.db
				.prepare(
					`UPDATE plan_revisions SET state = 'withdrawn', is_current = 0, withdrawn_reason = ? WHERE id = ?`
				)
				.run(reason, target.id);
			return {
				result: { id: ctx.targetId!, revision_id: target.id, state: 'withdrawn' },
				events: [
					{
						event_type: 'plan_withdrawn',
						subject_type: 'plan',
						subject_id: ctx.targetId!,
						summary: `Withdrew Plan ${ctx.targetId} revision ${target.revision_number}: ${reason}`,
						payload: { revision_id: target.id, reason }
					}
				]
			};
		}
	});
}
