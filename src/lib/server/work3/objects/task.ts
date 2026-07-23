import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { allocateEntityId, insertEntity, updateEntityArea } from '../envelope.js';
import { registerCommand, type ExecuteContext } from '../engine/registry.js';
import { optionalEnum, optionalNumber, optionalString, requireString } from '../engine/validate.js';
import { activeBlockersFor } from '../read/derived.js';
import { reviewDisposition } from '../read/governance-derived.js';
import { invalidateSatisfiesFrom, reconcileTerminal } from './reconcile.js';
import { requireActiveArea } from './area.js';

/**
 * Task state machine (doc 02): backlog → ready → in_progress → (completed |
 * in_review → completed); ready/in_progress ↔ waiting; any nonterminal →
 * cancelled; terminal → reopened to ready. Blocking is derived and never
 * rewrites Task lifecycle.
 */

export const TASK_STATUSES = [
	'backlog',
	'ready',
	'in_progress',
	'waiting',
	'in_review',
	'completed',
	'cancelled'
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export interface TaskRow {
	entity_id: string;
	project_id: string | null;
	phase_id: string | null;
	title: string;
	summary: string | null;
	completion_condition: string | null;
	status: TaskStatus;
	priority: string | null;
	owner: string | null;
	due_at: number | null;
	waiting_on: string | null;
	waiting_reason: string | null;
	waiting_since: number | null;
	waiting_resume_condition: string | null;
	waiting_follow_up_at: number | null;
	waiting_resume_status: string | null;
	output_revision: number;
	result_summary: string | null;
	completed_at: number | null;
	cancelled_at: number | null;
	cancel_reason: string | null;
}

export function loadTask(db: Database.Database, id: string): TaskRow | null {
	return (db.prepare('SELECT * FROM tasks WHERE entity_id = ?').get(id) as TaskRow) ?? null;
}

const TERMINAL: TaskStatus[] = ['completed', 'cancelled'];

function task(ctx: ExecuteContext): TaskRow {
	const row = loadTask(ctx.db, ctx.targetId!);
	if (!row) {
		throw new Work3Error('invariant_violation', `Task head row missing for ${ctx.targetId}`);
	}
	return row;
}

function setStatus(ctx: ExecuteContext, status: TaskStatus): void {
	ctx.db.prepare('UPDATE tasks SET status = ? WHERE entity_id = ?').run(status, ctx.targetId);
}

function transitionError(row: TaskRow, command: string, allowedFrom: TaskStatus[]): Work3Error {
	return new Work3Error('transition_not_allowed', `${command} is not allowed from ${row.status}`, {
		details: { status: row.status, allowed_from: allowedFrom },
		alternatives: legalCommandsFor(row.status)
	});
}

/** Valid alternatives per current status, surfaced in structured errors. */
export function legalCommandsFor(status: TaskStatus): string[] {
	switch (status) {
		case 'backlog':
			return ['ready_task', 'cancel_task', 'update_task'];
		case 'ready':
			return ['start_task', 'wait_task', 'cancel_task', 'update_task'];
		case 'in_progress':
			return ['complete_task', 'submit_task_for_review', 'wait_task', 'cancel_task', 'update_task'];
		case 'waiting':
			return ['resume_task', 'cancel_task', 'update_task'];
		case 'in_review':
			return ['accept_task', 'cancel_task'];
		case 'completed':
		case 'cancelled':
			return ['reopen_task'];
	}
}

function clearWaiting(ctx: ExecuteContext): void {
	ctx.db
		.prepare(
			`UPDATE tasks SET waiting_on = NULL, waiting_reason = NULL, waiting_since = NULL,
			 waiting_resume_condition = NULL, waiting_follow_up_at = NULL, waiting_resume_status = NULL
			 WHERE entity_id = ?`
		)
		.run(ctx.targetId);
}

/**
 * Terminal transitions must not leave active waiting metadata or active
 * Blockers behind (doc 02 cross-cutting). Active blockers are invalidated —
 * the constraint ceased to apply because the target became terminal.
 */
function invalidateActiveBlockers(
	ctx: ExecuteContext,
	targetBecame: 'completed' | 'cancelled'
): Array<{
	event_type: string;
	subject_type: string;
	subject_id: string;
	summary: string;
	payload: Record<string, unknown>;
}> {
	const blockers = activeBlockersFor(ctx.db, ctx.targetId!);
	const events = [];
	for (const blocker of blockers) {
		ctx.db
			.prepare(
				`UPDATE blockers SET state = 'invalidated', invalidated_at = ?, invalidated_reason = ?
				 WHERE entity_id = ?`
			)
			.run(ctx.now, `Blocked Task became ${targetBecame}`, blocker.id);
		ctx.db
			.prepare('UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ?')
			.run(ctx.now, blocker.id);
		events.push({
			event_type: 'blocker_invalidated',
			subject_type: 'blocker',
			subject_id: blocker.id,
			summary: `Invalidated blocker ${blocker.id}: blocked Task became ${targetBecame}`,
			payload: { blocked_id: ctx.targetId!, reason: `Blocked Task became ${targetBecame}` }
		});
	}
	return events;
}

function taskEvent(
	ctx: ExecuteContext,
	eventType: string,
	summary: string,
	payload: Record<string, unknown> = {}
) {
	return {
		event_type: eventType,
		subject_type: 'task',
		subject_id: ctx.targetId!,
		summary,
		payload
	};
}

export function registerTaskCommands(): void {
	registerCommand({
		name: 'create_task',
		targetType: null,
		summary: 'Create a Task (a concrete action) in an Area',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'title', { maxLength: 300 });
			requireString(payload, 'area_id');
			optionalEnum(payload, 'priority', TASK_PRIORITIES);
			optionalNumber(payload, 'due_at');
		},
		execute: (ctx) => {
			const areaId = requireString(ctx.payload, 'area_id');
			requireActiveArea(ctx.db, areaId);
			const title = requireString(ctx.payload, 'title', { maxLength: 300 });
			const id = allocateEntityId(ctx.db, 'task');
			insertEntity(ctx.db, { id, type: 'task', areaId, now: ctx.now });
			ctx.db
				.prepare(
					`INSERT INTO tasks (entity_id, title, summary, completion_condition, priority, owner, due_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					title,
					optionalString(ctx.payload, 'summary') ?? null,
					optionalString(ctx.payload, 'completion_condition') ?? null,
					optionalEnum(ctx.payload, 'priority', TASK_PRIORITIES) ?? null,
					optionalString(ctx.payload, 'owner') ?? null,
					optionalNumber(ctx.payload, 'due_at') ?? null
				);
			return {
				result: { id, title, status: 'backlog', area_id: areaId },
				events: [
					{
						event_type: 'task_created',
						subject_type: 'task',
						subject_id: id,
						summary: `Created Task "${title}" (${id})`,
						version_from: null,
						version_to: 1,
						payload: { title, area_id: areaId }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'update_task',
		targetType: 'task',
		summary: 'Edit Task definition fields (never lifecycle)',
		requiresTarget: true,
		validate: (payload) => {
			optionalEnum(payload, 'priority', TASK_PRIORITIES);
			optionalNumber(payload, 'due_at');
		},
		guards: [
			(ctx) => {
				const row = task(ctx);
				if (TERMINAL.includes(row.status)) {
					throw transitionError(
						row,
						'update_task',
						TASK_STATUSES.filter((s) => !TERMINAL.includes(s)) as TaskStatus[]
					);
				}
			}
		],
		execute: (ctx) => {
			const row = task(ctx);
			const next = {
				title: optionalString(ctx.payload, 'title') ?? row.title,
				summary:
					ctx.payload.summary === undefined
						? row.summary
						: (optionalString(ctx.payload, 'summary') ?? null),
				completion_condition:
					ctx.payload.completion_condition === undefined
						? row.completion_condition
						: (optionalString(ctx.payload, 'completion_condition') ?? null),
				priority:
					ctx.payload.priority === undefined
						? row.priority
						: (optionalEnum(ctx.payload, 'priority', TASK_PRIORITIES) ?? null),
				owner:
					ctx.payload.owner === undefined
						? row.owner
						: (optionalString(ctx.payload, 'owner') ?? null),
				due_at:
					ctx.payload.due_at === undefined
						? row.due_at
						: (optionalNumber(ctx.payload, 'due_at') ?? null)
			};
			const changed: string[] = (Object.keys(next) as Array<keyof typeof next>).filter(
				(key) => next[key] !== row[key]
			);
			const nextAreaId = optionalString(ctx.payload, 'area_id');
			if (nextAreaId && nextAreaId !== ctx.envelope!.area_id) {
				requireActiveArea(ctx.db, nextAreaId);
				changed.push('area_id');
			}
			if (changed.length === 0) {
				return { result: { id: row.entity_id }, events: [], noop: true };
			}
			ctx.db
				.prepare(
					`UPDATE tasks SET title = ?, summary = ?, completion_condition = ?, priority = ?, owner = ?, due_at = ?
					 WHERE entity_id = ?`
				)
				.run(
					next.title,
					next.summary,
					next.completion_condition,
					next.priority,
					next.owner,
					next.due_at,
					row.entity_id
				);
			if (changed.includes('area_id')) {
				updateEntityArea(ctx.db, row.entity_id, nextAreaId!);
			}
			return {
				result: { id: row.entity_id, changed },
				events: [
					taskEvent(ctx, 'task_updated', `Updated Task ${row.entity_id}`, {
						changed_fields: changed
					})
				]
			};
		}
	});

	registerCommand({
		name: 'ready_task',
		targetType: 'task',
		summary: 'Mark a backlog Task ready to act (requires an owner)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'ready') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'backlog') throw transitionError(row, 'ready_task', ['backlog']);
			const owner = optionalString(ctx.payload, 'owner') ?? row.owner;
			if (!owner) {
				throw new Work3Error(
					'transition_requirements_not_met',
					'ready_task requires an owner (set owner in the payload or via update_task)',
					{ details: { missing: ['owner'] } }
				);
			}
			ctx.db
				.prepare('UPDATE tasks SET status = ?, owner = ? WHERE entity_id = ?')
				.run('ready', owner, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'ready', owner },
				events: [taskEvent(ctx, 'task_ready', `Task ${row.entity_id} is ready`, { owner })]
			};
		}
	});

	registerCommand({
		name: 'start_task',
		targetType: 'task',
		summary: 'Start work on a ready Task (blocked Tasks cannot start)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'in_progress') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'ready') throw transitionError(row, 'start_task', ['ready']);
			const blockers = activeBlockersFor(ctx.db, row.entity_id);
			if (blockers.length > 0) {
				throw new Work3Error(
					'transition_requirements_not_met',
					`Task is blocked by ${blockers.length} active blocker(s)`,
					{
						details: {
							blockers: blockers.map((blocker) => ({
								id: blocker.id,
								reason: blocker.reason,
								resolution_condition: blocker.resolution_condition
							}))
						},
						alternatives: ['resolve_blocker', 'invalidate_blocker']
					}
				);
			}
			setStatus(ctx, 'in_progress');
			return {
				result: { id: row.entity_id, status: 'in_progress' },
				events: [taskEvent(ctx, 'task_started', `Started Task ${row.entity_id}`)]
			};
		}
	});

	registerCommand({
		name: 'wait_task',
		targetType: 'task',
		summary: 'Mark a Task waiting on a named response, event, or time',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'waiting_on');
			requireString(payload, 'reason');
			requireString(payload, 'resume_condition');
			optionalNumber(payload, 'follow_up_at');
		},
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'waiting') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'ready' && row.status !== 'in_progress') {
				throw transitionError(row, 'wait_task', ['ready', 'in_progress']);
			}
			const waitingOn = requireString(ctx.payload, 'waiting_on');
			ctx.db
				.prepare(
					`UPDATE tasks SET status = 'waiting', waiting_on = ?, waiting_reason = ?, waiting_since = ?,
					 waiting_resume_condition = ?, waiting_follow_up_at = ?, waiting_resume_status = ?
					 WHERE entity_id = ?`
				)
				.run(
					waitingOn,
					requireString(ctx.payload, 'reason'),
					ctx.now,
					requireString(ctx.payload, 'resume_condition'),
					optionalNumber(ctx.payload, 'follow_up_at') ?? null,
					row.status,
					row.entity_id
				);
			return {
				result: { id: row.entity_id, status: 'waiting', waiting_on: waitingOn },
				events: [
					taskEvent(ctx, 'task_waiting', `Task ${row.entity_id} waiting on ${waitingOn}`, {
						waiting_on: waitingOn
					})
				]
			};
		}
	});

	registerCommand({
		name: 'resume_task',
		targetType: 'task',
		summary: 'Resume a waiting Task (clears waiting metadata)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'ready' || row.status === 'in_progress') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'waiting') throw transitionError(row, 'resume_task', ['waiting']);
			const requested = optionalEnum(ctx.payload, 'to', ['ready', 'in_progress'] as const);
			const destination =
				requested ?? (row.waiting_resume_status === 'in_progress' ? 'in_progress' : 'ready');
			clearWaiting(ctx);
			setStatus(ctx, destination);
			return {
				result: { id: row.entity_id, status: destination },
				events: [taskEvent(ctx, 'task_resumed', `Resumed Task ${row.entity_id} to ${destination}`)]
			};
		}
	});

	registerCommand({
		name: 'submit_task_for_review',
		targetType: 'task',
		summary: 'Submit Task output for review (requires a result summary)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'result_summary');
		},
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'in_review') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'in_progress') {
				throw transitionError(row, 'submit_task_for_review', ['in_progress']);
			}
			const resultSummary = requireString(ctx.payload, 'result_summary');
			const outputRevision = row.output_revision + 1;
			ctx.db
				.prepare(
					`UPDATE tasks SET status = 'in_review', result_summary = ?, output_revision = ? WHERE entity_id = ?`
				)
				.run(resultSummary, outputRevision, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'in_review', output_revision: outputRevision },
				events: [
					taskEvent(
						ctx,
						'task_submitted_for_review',
						`Task ${row.entity_id} submitted for review (output revision ${outputRevision})`,
						{ output_revision: outputRevision }
					)
				]
			};
		}
	});

	registerCommand({
		name: 'accept_task',
		targetType: 'task',
		summary: 'Accept reviewed Task output and complete the Task',
		requiresTarget: true,
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'completed') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'in_review') throw transitionError(row, 'accept_task', ['in_review']);
			if (!row.result_summary) {
				throw new Work3Error(
					'transition_requirements_not_met',
					'accept_task requires the submitted result_summary',
					{ details: { missing: ['result_summary'] } }
				);
			}
			// An in_review Task requires an approving Review of the current output
			// revision before completion (doc 02).
			const disposition = reviewDisposition(ctx.db, row.entity_id, String(row.output_revision));
			if (disposition !== 'approved') {
				throw new Work3Error(
					'transition_requirements_not_met',
					`accept_task requires an approving Review of output revision ${row.output_revision} (current disposition: ${disposition})`,
					{
						details: { output_revision: row.output_revision, review_disposition: disposition },
						alternatives: ['create_review']
					}
				);
			}
			const blockerEvents = [
				...invalidateActiveBlockers(ctx, 'completed'),
				...reconcileTerminal(ctx, row.entity_id, 'completed')
			];
			clearWaiting(ctx);
			ctx.db
				.prepare(`UPDATE tasks SET status = 'completed', completed_at = ? WHERE entity_id = ?`)
				.run(ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'completed', output_revision: row.output_revision },
				events: [
					taskEvent(
						ctx,
						'task_completed',
						`Accepted and completed Task ${row.entity_id} (output revision ${row.output_revision})`,
						{ accepted_output_revision: row.output_revision }
					),
					...blockerEvents
				]
			};
		}
	});

	registerCommand({
		name: 'complete_task',
		targetType: 'task',
		summary: 'Complete a Task directly (requires result summary)',
		requiresTarget: true,
		validate: (payload) => {
			optionalString(payload, 'result_summary');
		},
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'completed') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'in_progress') {
				throw transitionError(row, 'complete_task', ['in_progress']);
			}
			const resultSummary = optionalString(ctx.payload, 'result_summary') ?? row.result_summary;
			if (!resultSummary) {
				throw new Work3Error(
					'transition_requirements_not_met',
					'Completion requires result_summary',
					{ details: { missing: ['result_summary'] } }
				);
			}
			const blockerEvents = [
				...invalidateActiveBlockers(ctx, 'completed'),
				...reconcileTerminal(ctx, row.entity_id, 'completed')
			];
			clearWaiting(ctx);
			ctx.db
				.prepare(
					`UPDATE tasks SET status = 'completed', result_summary = ?, completed_at = ? WHERE entity_id = ?`
				)
				.run(resultSummary, ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'completed' },
				events: [
					taskEvent(ctx, 'task_completed', `Completed Task ${row.entity_id}`, {
						result_summary: resultSummary
					}),
					...blockerEvents
				]
			};
		}
	});

	registerCommand({
		name: 'cancel_task',
		targetType: 'task',
		summary: 'Cancel a Task (requires a reason; preserves history)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'cancelled') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status === 'completed') {
				throw transitionError(
					row,
					'cancel_task',
					TASK_STATUSES.filter((s) => !TERMINAL.includes(s)) as TaskStatus[]
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			const blockerEvents = [
				...invalidateActiveBlockers(ctx, 'cancelled'),
				...reconcileTerminal(ctx, row.entity_id, 'cancelled')
			];
			clearWaiting(ctx);
			ctx.db
				.prepare(
					`UPDATE tasks SET status = 'cancelled', cancelled_at = ?, cancel_reason = ? WHERE entity_id = ?`
				)
				.run(ctx.now, reason, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'cancelled' },
				events: [
					taskEvent(ctx, 'task_cancelled', `Cancelled Task ${row.entity_id}: ${reason}`, {
						reason
					}),
					...blockerEvents
				]
			};
		}
	});

	registerCommand({
		name: 'reopen_task',
		targetType: 'task',
		summary: 'Reopen a terminal Task to ready (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = task(ctx);
			if (row.status === 'ready') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (!TERMINAL.includes(row.status)) {
				throw transitionError(row, 'reopen_task', TERMINAL);
			}
			const reason = requireString(ctx.payload, 'reason');
			const satisfiesEvents = invalidateSatisfiesFrom(
				ctx,
				row.entity_id,
				`Task ${row.entity_id} reopened — its result no longer stands as proof`
			);
			ctx.db
				.prepare(
					`UPDATE tasks SET status = 'ready', completed_at = NULL, cancelled_at = NULL,
					 cancel_reason = NULL, result_summary = NULL WHERE entity_id = ?`
				)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, status: 'ready' },
				events: [
					taskEvent(ctx, 'task_reopened', `Reopened Task ${row.entity_id}: ${reason}`, {
						reason,
						prior_status: row.status
					}),
					...satisfiesEvents
				]
			};
		}
	});
}
