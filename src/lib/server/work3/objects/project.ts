import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { allocateEntityId, insertEntity, loadEntity } from '../envelope.js';
import { humanAuthorityPreGuard } from '../engine/authority.js';
import { registerCommand, type ExecuteContext } from '../engine/registry.js';
import { optionalNumber, optionalString, requireString } from '../engine/validate.js';
import { requireActiveArea } from './area.js';
import { currentPlanRevision } from './plan.js';

/**
 * Project (docs 01–02): a bounded outcome with an explicit finish line.
 * draft → planned → active ↔ paused → completed | cancelled, explicit
 * reopening; archival is orthogonal visibility metadata. No free-text next
 * action — the current-next-item pointer is authoritative. Health/progress
 * are derived on read.
 */

export interface CompletionCriterion {
	id: string;
	text: string;
	waived?: { reason: string; by: string; at: number };
}

export interface ProjectRow {
	entity_id: string;
	title: string;
	summary: string | null;
	desired_outcome: string | null;
	why_it_matters: string | null;
	scope_included: string;
	scope_excluded: string;
	completion_criteria: string;
	status: 'draft' | 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
	health_override: string | null;
	owner: string | null;
	current_next_item_id: string | null;
	plan_id: string | null;
	plan_not_required_reason: string | null;
	parallel_phases_allowed: number;
	target_at: number | null;
	started_at: number | null;
	completed_at: number | null;
	outcome_summary: string | null;
	cancelled_at: number | null;
	cancel_reason: string | null;
	child_disposition: string | null;
	reopen_reason: string | null;
	archived_at: number | null;
}

export function loadProject(db: Database.Database, id: string): ProjectRow | null {
	return (db.prepare('SELECT * FROM projects WHERE entity_id = ?').get(id) as ProjectRow) ?? null;
}

export function projectCriteria(row: ProjectRow): CompletionCriterion[] {
	try {
		return JSON.parse(row.completion_criteria) as CompletionCriterion[];
	} catch {
		return [];
	}
}

/** Criterion ids proven by active revision-pinned satisfies assertions. */
export function satisfiedCriteria(db: Database.Database, projectId: string): Set<string> {
	const rows = db
		.prepare(
			`SELECT criterion_id FROM relationships
			 WHERE target_id = ? AND rel_type = 'satisfies' AND criterion_id IS NOT NULL
			   AND removed_at IS NULL AND invalidated_at IS NULL`
		)
		.all(projectId) as Array<{ criterion_id: string }>;
	return new Set(rows.map((row) => row.criterion_id));
}

function project(ctx: ExecuteContext): ProjectRow {
	const row = loadProject(ctx.db, ctx.targetId!);
	if (!row)
		throw new Work3Error('invariant_violation', `Project head row missing for ${ctx.targetId}`);
	return row;
}

function guardNotArchived(row: ProjectRow): void {
	if (row.archived_at !== null) {
		throw new Work3Error('transition_not_allowed', 'Archived Projects reject ordinary mutations', {
			alternatives: ['restore_project']
		});
	}
}

function parseCriteria(payload: Record<string, unknown>): CompletionCriterion[] | undefined {
	const raw = payload.completion_criteria;
	if (raw === undefined) return undefined;
	if (!Array.isArray(raw)) {
		throw new Work3Error('validation_failed', 'completion_criteria must be an array');
	}
	const criteria = raw.map((entry, index) => {
		if (typeof entry === 'string') return { id: `cc${index + 1}`, text: entry };
		if (entry && typeof entry === 'object') {
			const candidate = entry as Record<string, unknown>;
			if (typeof candidate.text !== 'string' || candidate.text.trim().length === 0) {
				throw new Work3Error('validation_failed', `completion_criteria[${index}].text is required`);
			}
			return {
				id: typeof candidate.id === 'string' ? candidate.id : `cc${index + 1}`,
				text: candidate.text
			};
		}
		throw new Work3Error(
			'validation_failed',
			`completion_criteria[${index}] must be a string or object`
		);
	});
	if (new Set(criteria.map((criterion) => criterion.id)).size !== criteria.length) {
		throw new Work3Error('validation_failed', 'completion criteria ids must be unique');
	}
	return criteria;
}

function parseStringArray(payload: Record<string, unknown>, field: string): string[] | undefined {
	const raw = payload[field];
	if (raw === undefined) return undefined;
	if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== 'string')) {
		throw new Work3Error('validation_failed', `${field} must be an array of strings`);
	}
	return raw as string[];
}

const NEXT_ITEM_TYPES = ['task', 'question', 'decision', 'change_request'];

/** Validate a current-next candidate: active actionable Work in this Project. */
function validateNextItem(ctx: ExecuteContext, projectId: string, itemId: string): void {
	const item = loadEntity(ctx.db, itemId);
	if (!item) throw new Work3Error('not_found', `No such Work item: ${itemId}`);
	if (!NEXT_ITEM_TYPES.includes(item.type)) {
		throw new Work3Error(
			'invariant_violation',
			`current next item must be a Task, Question, Decision, or Change Request (got ${item.type})`
		);
	}
	const membership = ctx.db
		.prepare(
			`SELECT project_id FROM ${item.type === 'task' ? 'tasks' : item.type === 'question' ? 'questions' : item.type === 'decision' ? 'decisions' : 'change_requests'} WHERE entity_id = ?`
		)
		.get(itemId) as { project_id: string | null } | undefined;
	if (membership?.project_id !== projectId) {
		throw new Work3Error(
			'invariant_violation',
			`${itemId} does not belong to Project ${projectId}`
		);
	}
	const terminal =
		item.type === 'task'
			? (
					ctx.db.prepare('SELECT status FROM tasks WHERE entity_id = ?').get(itemId) as {
						status: string;
					}
				).status
			: item.type === 'question'
				? (
						ctx.db.prepare('SELECT status FROM questions WHERE entity_id = ?').get(itemId) as {
							status: string;
						}
					).status
				: item.type === 'decision'
					? (
							ctx.db.prepare('SELECT status FROM decisions WHERE entity_id = ?').get(itemId) as {
								status: string;
							}
						).status
					: (
							ctx.db
								.prepare('SELECT execution_state FROM change_requests WHERE entity_id = ?')
								.get(itemId) as { execution_state: string }
						).execution_state;
	if (
		[
			'completed',
			'cancelled',
			'answered',
			'withdrawn',
			'decided',
			'succeeded',
			'rolled_back'
		].includes(terminal)
	) {
		throw new Work3Error(
			'invariant_violation',
			`current next item cannot be terminal (${itemId} is ${terminal})`
		);
	}
}

function projectEvent(
	ctx: ExecuteContext,
	eventType: string,
	summary: string,
	payload: Record<string, unknown> = {}
) {
	return {
		event_type: eventType,
		subject_type: 'project',
		subject_id: ctx.targetId!,
		summary,
		payload
	};
}

export function registerProjectCommands(): void {
	registerCommand({
		name: 'create_project',
		targetType: null,
		summary: 'Create a Project (bounded outcome with an explicit finish line) as draft',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'title', { maxLength: 300 });
			requireString(payload, 'area_id');
			parseCriteria(payload);
		},
		execute: (ctx) => {
			const areaId = requireString(ctx.payload, 'area_id');
			requireActiveArea(ctx.db, areaId);
			const title = requireString(ctx.payload, 'title', { maxLength: 300 });
			const id = allocateEntityId(ctx.db, 'project');
			insertEntity(ctx.db, { id, type: 'project', areaId, now: ctx.now });
			ctx.db
				.prepare(
					`INSERT INTO projects (entity_id, title, summary, desired_outcome, why_it_matters,
					 scope_included, scope_excluded, completion_criteria, owner, target_at, parallel_phases_allowed)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					title,
					optionalString(ctx.payload, 'summary') ?? null,
					optionalString(ctx.payload, 'desired_outcome') ?? null,
					optionalString(ctx.payload, 'why_it_matters') ?? null,
					JSON.stringify(parseStringArray(ctx.payload, 'scope_included') ?? []),
					JSON.stringify(parseStringArray(ctx.payload, 'scope_excluded') ?? []),
					JSON.stringify(parseCriteria(ctx.payload) ?? []),
					optionalString(ctx.payload, 'owner') ?? null,
					optionalNumber(ctx.payload, 'target_at') ?? null,
					ctx.payload.parallel_phases_allowed === true ? 1 : 0
				);
			return {
				result: { id, title, status: 'draft' },
				events: [
					{
						event_type: 'project_created',
						subject_type: 'project',
						subject_id: id,
						summary: `Created Project "${title}" (${id})`,
						version_from: null,
						version_to: 1,
						payload: { title, area_id: areaId }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'update_project',
		targetType: 'project',
		summary: 'Edit Project definition fields (never lifecycle)',
		requiresTarget: true,
		guards: [
			(ctx) => {
				const row = project(ctx);
				guardNotArchived(row);
				if (['completed', 'cancelled'].includes(row.status)) {
					throw new Work3Error('transition_not_allowed', 'Terminal Projects reject edits', {
						alternatives: ['reopen_project']
					});
				}
			}
		],
		execute: (ctx) => {
			const row = project(ctx);
			const criteria = parseCriteria(ctx.payload);
			const included = parseStringArray(ctx.payload, 'scope_included');
			const excluded = parseStringArray(ctx.payload, 'scope_excluded');
			const next = {
				title: optionalString(ctx.payload, 'title') ?? row.title,
				summary:
					ctx.payload.summary === undefined
						? row.summary
						: (optionalString(ctx.payload, 'summary') ?? null),
				desired_outcome:
					ctx.payload.desired_outcome === undefined
						? row.desired_outcome
						: (optionalString(ctx.payload, 'desired_outcome') ?? null),
				why_it_matters:
					ctx.payload.why_it_matters === undefined
						? row.why_it_matters
						: (optionalString(ctx.payload, 'why_it_matters') ?? null),
				scope_included: included !== undefined ? JSON.stringify(included) : row.scope_included,
				scope_excluded: excluded !== undefined ? JSON.stringify(excluded) : row.scope_excluded,
				completion_criteria:
					criteria !== undefined ? JSON.stringify(criteria) : row.completion_criteria,
				owner:
					ctx.payload.owner === undefined
						? row.owner
						: (optionalString(ctx.payload, 'owner') ?? null),
				target_at:
					ctx.payload.target_at === undefined
						? row.target_at
						: (optionalNumber(ctx.payload, 'target_at') ?? null)
			};
			// Criteria may be edited only while the finish line is negotiable.
			if (criteria !== undefined && !['draft', 'planned'].includes(row.status)) {
				// Waivers go through waive_completion_criterion; adding criteria to an
				// active project is allowed, removing satisfied ones is not checked
				// here beyond keeping waived entries intact.
				const prior = projectCriteria(row);
				for (const criterion of prior) {
					if (criterion.waived && !criteria.some((candidate) => candidate.id === criterion.id)) {
						throw new Work3Error(
							'invariant_violation',
							`Cannot drop waived criterion ${criterion.id}`
						);
					}
				}
			}
			const changed = (Object.keys(next) as Array<keyof typeof next>).filter(
				(key) => next[key] !== row[key]
			);
			if (changed.length === 0) return { result: { id: row.entity_id }, events: [], noop: true };
			ctx.db
				.prepare(
					`UPDATE projects SET title = ?, summary = ?, desired_outcome = ?, why_it_matters = ?,
					 scope_included = ?, scope_excluded = ?, completion_criteria = ?, owner = ?, target_at = ?
					 WHERE entity_id = ?`
				)
				.run(
					next.title,
					next.summary,
					next.desired_outcome,
					next.why_it_matters,
					next.scope_included,
					next.scope_excluded,
					next.completion_criteria,
					next.owner,
					next.target_at,
					row.entity_id
				);
			return {
				result: { id: row.entity_id, changed },
				events: [
					projectEvent(ctx, 'project_updated', `Updated Project ${row.entity_id}`, {
						changed_fields: changed
					})
				]
			};
		}
	});

	registerCommand({
		name: 'plan_project',
		targetType: 'project',
		summary: 'Move a draft Project to planned (outcome, scope, owner, criteria required)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			if (row.status === 'planned')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status !== 'draft') {
				throw new Work3Error(
					'transition_not_allowed',
					`plan_project is not allowed from ${row.status}`
				);
			}
			const missing: string[] = [];
			if (!row.desired_outcome) missing.push('desired_outcome');
			if ((JSON.parse(row.scope_included) as string[]).length === 0) missing.push('scope_included');
			if (!row.owner) missing.push('owner');
			if (projectCriteria(row).length === 0) missing.push('completion_criteria');
			if (missing.length > 0) {
				throw new Work3Error(
					'transition_requirements_not_met',
					`Planning requires: ${missing.join(', ')}`,
					{
						details: { missing },
						alternatives: ['update_project']
					}
				);
			}
			ctx.db
				.prepare(`UPDATE projects SET status = 'planned' WHERE entity_id = ?`)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, status: 'planned' },
				events: [projectEvent(ctx, 'project_planned', `Project ${row.entity_id} is planned`)]
			};
		}
	});

	registerCommand({
		name: 'activate_project',
		targetType: 'project',
		summary:
			'Activate a planned/paused Project (needs a submitted Plan or plan_not_required reason)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			if (row.status === 'active')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status !== 'planned' && row.status !== 'paused') {
				throw new Work3Error(
					'transition_not_allowed',
					`activate_project is not allowed from ${row.status}`
				);
			}
			const planNotRequired =
				optionalString(ctx.payload, 'plan_not_required_reason') ?? row.plan_not_required_reason;
			const attachedPlan = ctx.db
				.prepare(`SELECT entity_id FROM plans WHERE work_item_id = ?`)
				.get(row.entity_id) as { entity_id: string } | undefined;
			const planRevision = attachedPlan
				? currentPlanRevision(ctx.db, attachedPlan.entity_id)
				: null;
			if (!(planRevision?.state === 'submitted') && !planNotRequired) {
				throw new Work3Error(
					'transition_requirements_not_met',
					'Activation requires a submitted current Plan or an explicit plan_not_required_reason',
					{
						details: { missing: ['plan or plan_not_required_reason'] },
						alternatives: ['create_plan', 'submit_plan']
					}
				);
			}
			ctx.db
				.prepare(
					`UPDATE projects SET status = 'active', started_at = COALESCE(started_at, ?),
					 plan_id = ?, plan_not_required_reason = ? WHERE entity_id = ?`
				)
				.run(ctx.now, attachedPlan?.entity_id ?? null, planNotRequired ?? null, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'active' },
				events: [projectEvent(ctx, 'project_activated', `Activated Project ${row.entity_id}`)]
			};
		}
	});

	registerCommand({
		name: 'pause_project',
		targetType: 'project',
		summary: 'Pause an active Project deliberately',
		requiresTarget: true,
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			if (row.status === 'paused')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status !== 'active') {
				throw new Work3Error(
					'transition_not_allowed',
					`pause_project is not allowed from ${row.status}`
				);
			}
			ctx.db
				.prepare(`UPDATE projects SET status = 'paused' WHERE entity_id = ?`)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, status: 'paused' },
				events: [projectEvent(ctx, 'project_paused', `Paused Project ${row.entity_id}`)]
			};
		}
	});

	registerCommand({
		name: 'complete_project',
		targetType: 'project',
		summary:
			'Complete a Project (all criteria satisfied/waived, next item cleared, outcome summary)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'outcome_summary');
		},
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			if (row.status === 'completed')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status !== 'active') {
				throw new Work3Error(
					'transition_not_allowed',
					`complete_project is not allowed from ${row.status}`
				);
			}
			const criteria = projectCriteria(row);
			const satisfied = satisfiedCriteria(ctx.db, row.entity_id);
			const unmet = criteria.filter(
				(criterion) => !criterion.waived && !satisfied.has(criterion.id)
			);
			if (unmet.length > 0) {
				throw new Work3Error(
					'transition_requirements_not_met',
					`${unmet.length} completion criteria are neither satisfied nor waived`,
					{
						details: {
							unmet: unmet.map((criterion) => ({ id: criterion.id, text: criterion.text }))
						},
						alternatives: ['link_work', 'waive_completion_criterion']
					}
				);
			}
			if (row.current_next_item_id !== null) {
				throw new Work3Error(
					'transition_requirements_not_met',
					`Completion requires no current next item (still points at ${row.current_next_item_id})`,
					{ alternatives: ['set_current_next_item'] }
				);
			}
			const outcomeSummary = requireString(ctx.payload, 'outcome_summary');
			ctx.db
				.prepare(
					`UPDATE projects SET status = 'completed', completed_at = ?, outcome_summary = ? WHERE entity_id = ?`
				)
				.run(ctx.now, outcomeSummary, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'completed' },
				events: [
					projectEvent(
						ctx,
						'project_completed',
						`Completed Project ${row.entity_id}: ${outcomeSummary}`,
						{
							outcome_summary: outcomeSummary
						}
					)
				]
			};
		}
	});

	registerCommand({
		name: 'cancel_project',
		targetType: 'project',
		summary: 'Cancel a Project (requires reason and disposition of active child Work)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
			requireString(payload, 'child_disposition');
		},
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			if (row.status === 'cancelled')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status === 'completed') {
				throw new Work3Error('transition_not_allowed', 'Completed Projects cannot be cancelled', {
					alternatives: ['reopen_project']
				});
			}
			const reason = requireString(ctx.payload, 'reason');
			const disposition = requireString(ctx.payload, 'child_disposition');
			ctx.db
				.prepare(
					`UPDATE projects SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?,
					 child_disposition = ?, current_next_item_id = NULL WHERE entity_id = ?`
				)
				.run(ctx.now, reason, disposition, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'cancelled' },
				events: [
					projectEvent(ctx, 'project_cancelled', `Cancelled Project ${row.entity_id}: ${reason}`, {
						reason,
						child_disposition: disposition
					})
				]
			};
		}
	});

	registerCommand({
		name: 'reopen_project',
		targetType: 'project',
		summary: 'Reopen a terminal Project to active (reason + new current next item)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
			requireString(payload, 'current_next_item_id');
		},
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			if (row.status === 'active')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (!['completed', 'cancelled'].includes(row.status)) {
				throw new Work3Error(
					'transition_not_allowed',
					`reopen_project is not allowed from ${row.status}`
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			const nextItem = requireString(ctx.payload, 'current_next_item_id');
			validateNextItem(ctx, row.entity_id, nextItem);
			ctx.db
				.prepare(
					`UPDATE projects SET status = 'active', reopen_reason = ?, current_next_item_id = ?,
					 completed_at = NULL, outcome_summary = NULL, cancelled_at = NULL, cancel_reason = NULL
					 WHERE entity_id = ?`
				)
				.run(reason, nextItem, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'active' },
				events: [
					projectEvent(ctx, 'project_reopened', `Reopened Project ${row.entity_id}: ${reason}`, {
						reason,
						prior_status: row.status
					})
				]
			};
		}
	});

	registerCommand({
		name: 'archive_project',
		targetType: 'project',
		summary: 'Archive a Project (visibility only; lifecycle outcome preserved)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = project(ctx);
			if (row.archived_at !== null) {
				return {
					result: { id: row.entity_id, archived_at: row.archived_at },
					events: [],
					noop: true
				};
			}
			ctx.db
				.prepare(`UPDATE projects SET archived_at = ? WHERE entity_id = ?`)
				.run(ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, archived_at: ctx.now, status: row.status },
				events: [
					projectEvent(
						ctx,
						'project_archived',
						`Archived Project ${row.entity_id} (status stays ${row.status})`
					)
				]
			};
		}
	});

	registerCommand({
		name: 'restore_project',
		targetType: 'project',
		summary: 'Clear a Project archive flag',
		requiresTarget: true,
		execute: (ctx) => {
			const row = project(ctx);
			if (row.archived_at === null) {
				return { result: { id: row.entity_id, archived_at: null }, events: [], noop: true };
			}
			ctx.db
				.prepare(`UPDATE projects SET archived_at = NULL WHERE entity_id = ?`)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, archived_at: null },
				events: [
					projectEvent(ctx, 'project_restored', `Restored Project ${row.entity_id} from archive`)
				]
			};
		}
	});

	registerCommand({
		name: 'set_current_next_item',
		targetType: 'project',
		summary: 'Point the Project at its authoritative current next item (or clear it)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			if (['completed', 'cancelled'].includes(row.status)) {
				throw new Work3Error('transition_not_allowed', 'Terminal Projects have no next item');
			}
			const itemId = optionalString(ctx.payload, 'item_id') ?? null;
			if (itemId === row.current_next_item_id) {
				return {
					result: { id: row.entity_id, current_next_item_id: itemId },
					events: [],
					noop: true
				};
			}
			if (itemId !== null) validateNextItem(ctx, row.entity_id, itemId);
			ctx.db
				.prepare(`UPDATE projects SET current_next_item_id = ? WHERE entity_id = ?`)
				.run(itemId, row.entity_id);
			return {
				result: { id: row.entity_id, current_next_item_id: itemId },
				events: [
					projectEvent(
						ctx,
						'project_next_item_set',
						itemId
							? `Project ${row.entity_id} next item is ${itemId}`
							: `Cleared Project ${row.entity_id} next item`,
						{ item_id: itemId, prior_item_id: row.current_next_item_id }
					)
				]
			};
		}
	});

	registerCommand({
		name: 'waive_completion_criterion',
		targetType: 'project',
		summary: 'Waive a completion criterion (authority-creating; requires reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'criterion_id');
			requireString(payload, 'reason');
		},
		preGuards: [humanAuthorityPreGuard],
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			const criterionId = requireString(ctx.payload, 'criterion_id');
			const reason = requireString(ctx.payload, 'reason');
			const criteria = projectCriteria(row);
			const criterion = criteria.find((candidate) => candidate.id === criterionId);
			if (!criterion) {
				throw new Work3Error('not_found', `No such completion criterion: ${criterionId}`, {
					details: { criterion_ids: criteria.map((candidate) => candidate.id) }
				});
			}
			if (criterion.waived) {
				return {
					result: { id: row.entity_id, criterion_id: criterionId, waived: true },
					events: [],
					noop: true
				};
			}
			criterion.waived = { reason, by: `${ctx.actor.kind}:${ctx.actor.id}`, at: ctx.now };
			ctx.db
				.prepare(`UPDATE projects SET completion_criteria = ? WHERE entity_id = ?`)
				.run(JSON.stringify(criteria), row.entity_id);
			return {
				result: { id: row.entity_id, criterion_id: criterionId, waived: true },
				events: [
					projectEvent(
						ctx,
						'criterion_waived',
						`Waived criterion ${criterionId} on ${row.entity_id}: ${reason}`,
						{
							criterion_id: criterionId,
							reason
						}
					)
				]
			};
		}
	});

	registerCommand({
		name: 'set_project_health_override',
		targetType: 'project',
		summary: 'Override derived health (requires reason and expiry) or clear the override',
		requiresTarget: true,
		execute: (ctx) => {
			const row = project(ctx);
			guardNotArchived(row);
			if (ctx.payload.clear === true) {
				if (row.health_override === null) {
					return { result: { id: row.entity_id, health_override: null }, events: [], noop: true };
				}
				ctx.db
					.prepare(`UPDATE projects SET health_override = NULL WHERE entity_id = ?`)
					.run(row.entity_id);
				return {
					result: { id: row.entity_id, health_override: null },
					events: [
						projectEvent(
							ctx,
							'project_health_override_cleared',
							`Cleared health override on ${row.entity_id}`
						)
					]
				};
			}
			const health = requireString(ctx.payload, 'health');
			if (!['on_track', 'at_risk', 'blocked', 'unknown'].includes(health)) {
				throw new Work3Error(
					'validation_failed',
					'health must be on_track|at_risk|blocked|unknown'
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			const expiresAt = optionalNumber(ctx.payload, 'expires_at');
			if (!expiresAt) {
				throw new Work3Error(
					'validation_failed',
					'health overrides require expires_at (they never become permanent)'
				);
			}
			const override = {
				health,
				reason,
				expires_at: expiresAt,
				by: `${ctx.actor.kind}:${ctx.actor.id}`
			};
			ctx.db
				.prepare(`UPDATE projects SET health_override = ? WHERE entity_id = ?`)
				.run(JSON.stringify(override), row.entity_id);
			return {
				result: { id: row.entity_id, health_override: override },
				events: [
					projectEvent(
						ctx,
						'project_health_overridden',
						`Health override on ${row.entity_id}: ${health} (${reason})`,
						override
					)
				]
			};
		}
	});
}
