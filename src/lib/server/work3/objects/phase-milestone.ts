import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRefs } from '$lib/work3-shared/sources.js';
import { allocateEntityId, insertEntity, loadEntity } from '../envelope.js';
import { registerCommand, type ExecuteContext } from '../engine/registry.js';
import { optionalNumber, optionalString, requireString } from '../engine/validate.js';
import { loadProject } from './project.js';

/**
 * Phase (ordered route structure) and Milestone (independently provable
 * checkpoints), docs 01–02. Phase transitions never automatically change
 * Project lifecycle; Milestone achievement never completes the Project.
 */

export interface PhaseRow {
	entity_id: string;
	project_id: string;
	title: string;
	summary: string | null;
	sequence: number;
	status: 'planned' | 'active' | 'completed' | 'skipped';
	started_at: number | null;
	target_at: number | null;
	completed_at: number | null;
	skip_reason: string | null;
	reopen_reason: string | null;
}

export interface MilestoneRow {
	entity_id: string;
	project_id: string;
	title: string;
	summary: string | null;
	success_condition: string;
	status: 'planned' | 'achieved' | 'cancelled';
	sequence: number;
	target_at: number | null;
	achieved_at: number | null;
	source_refs: string;
	waived_sources_reason: string | null;
	cancel_reason: string | null;
	reopen_reason: string | null;
}

export function loadPhase(db: Database.Database, id: string): PhaseRow | null {
	return (db.prepare('SELECT * FROM phases WHERE entity_id = ?').get(id) as PhaseRow) ?? null;
}

export function loadMilestone(db: Database.Database, id: string): MilestoneRow | null {
	return (
		(db.prepare('SELECT * FROM milestones WHERE entity_id = ?').get(id) as MilestoneRow) ?? null
	);
}

function requireProject(ctx: ExecuteContext, projectId: string) {
	const envelope = loadEntity(ctx.db, projectId);
	if (!envelope || envelope.type !== 'project') {
		throw new Work3Error('validation_failed', `No such Project: ${projectId}`);
	}
	const row = loadProject(ctx.db, projectId)!;
	if (row.archived_at !== null) {
		throw new Work3Error('transition_not_allowed', 'Archived Projects reject ordinary mutations');
	}
	return { envelope, row };
}

/** Nonterminal Work assigned to a Phase (tasks are the assignable slice type). */
function phaseOpenWork(db: Database.Database, phaseId: string): number {
	const row = db
		.prepare(
			`SELECT COUNT(*) AS count FROM tasks WHERE phase_id = ? AND status NOT IN ('completed','cancelled')`
		)
		.get(phaseId) as { count: number };
	return row.count;
}

function phaseAssignedWork(db: Database.Database, phaseId: string): number {
	const row = db.prepare(`SELECT COUNT(*) AS count FROM tasks WHERE phase_id = ?`).get(phaseId) as {
		count: number;
	};
	return row.count;
}

export function registerPhaseCommands(): void {
	registerCommand({
		name: 'create_phase',
		targetType: null,
		summary: 'Create a Phase (ordered project-local planning section)',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'project_id');
			requireString(payload, 'title', { maxLength: 300 });
		},
		execute: (ctx) => {
			const projectId = requireString(ctx.payload, 'project_id');
			const { envelope } = requireProject(ctx, projectId);
			const sequence =
				optionalNumber(ctx.payload, 'sequence') ??
				(
					ctx.db
						.prepare('SELECT COALESCE(MAX(sequence), 0) AS max FROM phases WHERE project_id = ?')
						.get(projectId) as { max: number }
				).max + 1;
			const id = allocateEntityId(ctx.db, 'phase');
			insertEntity(ctx.db, { id, type: 'phase', areaId: envelope.area_id, now: ctx.now });
			ctx.db
				.prepare(
					`INSERT INTO phases (entity_id, project_id, title, summary, sequence, target_at) VALUES (?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					projectId,
					requireString(ctx.payload, 'title', { maxLength: 300 }),
					optionalString(ctx.payload, 'summary') ?? null,
					sequence,
					optionalNumber(ctx.payload, 'target_at') ?? null
				);
			return {
				result: { id, project_id: projectId, sequence, status: 'planned' },
				events: [
					{
						event_type: 'phase_created',
						subject_type: 'phase',
						subject_id: id,
						summary: `Created Phase ${id} (#${sequence}) in ${projectId}`,
						version_from: null,
						version_to: 1,
						payload: { project_id: projectId, sequence }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'activate_phase',
		targetType: 'phase',
		summary:
			'Activate a Phase (completes/parallels the previously active one; empty Phases cannot activate)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = loadPhase(ctx.db, ctx.targetId!)!;
			if (row.status === 'active')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status !== 'planned') {
				throw new Work3Error(
					'transition_not_allowed',
					`activate_phase is not allowed from ${row.status}`
				);
			}
			if (phaseAssignedWork(ctx.db, row.entity_id) === 0) {
				throw new Work3Error(
					'transition_requirements_not_met',
					'Empty Phases cannot become active',
					{
						details: { phase_id: row.entity_id },
						alternatives: ['assign_to_project']
					}
				);
			}
			const project = loadProject(ctx.db, row.project_id)!;
			const active = ctx.db
				.prepare(`SELECT entity_id FROM phases WHERE project_id = ? AND status = 'active'`)
				.all(row.project_id) as Array<{ entity_id: string }>;
			const events = [];
			if (active.length > 0) {
				const parallel = ctx.payload.parallel === true;
				if (parallel || project.parallel_phases_allowed === 1) {
					// Explicit parallel-phase exception (doc 02).
				} else {
					// Activating normally completes the previously active Phase —
					// but only if its required Work is terminal; otherwise reject.
					for (const prior of active) {
						if (phaseOpenWork(ctx.db, prior.entity_id) > 0) {
							throw new Work3Error(
								'transition_requirements_not_met',
								`Phase ${prior.entity_id} is active with open Work; complete/skip it or pass parallel: true`,
								{
									details: { active_phase: prior.entity_id },
									alternatives: ['complete_phase', 'skip_phase']
								}
							);
						}
						ctx.db
							.prepare(
								`UPDATE phases SET status = 'completed', completed_at = ? WHERE entity_id = ?`
							)
							.run(ctx.now, prior.entity_id);
						ctx.db
							.prepare('UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ?')
							.run(ctx.now, prior.entity_id);
						events.push({
							event_type: 'phase_completed',
							subject_type: 'phase',
							subject_id: prior.entity_id,
							summary: `Completed Phase ${prior.entity_id} (next Phase activated)`,
							payload: { completed_by_activation_of: row.entity_id }
						});
					}
				}
			}
			ctx.db
				.prepare(`UPDATE phases SET status = 'active', started_at = ? WHERE entity_id = ?`)
				.run(ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'active' },
				events: [
					{
						event_type: 'phase_activated',
						subject_type: 'phase',
						subject_id: row.entity_id,
						summary: `Activated Phase ${row.entity_id}`,
						payload: {}
					},
					...events
				]
			};
		}
	});

	registerCommand({
		name: 'complete_phase',
		targetType: 'phase',
		summary: 'Complete a Phase (all required Phase Work must be terminal)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = loadPhase(ctx.db, ctx.targetId!)!;
			if (row.status === 'completed')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status !== 'active') {
				throw new Work3Error(
					'transition_not_allowed',
					`complete_phase is not allowed from ${row.status}`
				);
			}
			const open = phaseOpenWork(ctx.db, row.entity_id);
			if (open > 0) {
				throw new Work3Error(
					'transition_requirements_not_met',
					`${open} required Phase Work item(s) are not terminal`,
					{
						details: { open_work: open }
					}
				);
			}
			ctx.db
				.prepare(`UPDATE phases SET status = 'completed', completed_at = ? WHERE entity_id = ?`)
				.run(ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'completed' },
				events: [
					{
						event_type: 'phase_completed',
						subject_type: 'phase',
						subject_id: row.entity_id,
						summary: `Completed Phase ${row.entity_id}`,
						payload: {}
					}
				]
			};
		}
	});

	registerCommand({
		name: 'skip_phase',
		targetType: 'phase',
		summary: 'Skip a Phase (requires reason and disposition of unfinished Work)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = loadPhase(ctx.db, ctx.targetId!)!;
			if (row.status === 'skipped')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (!['planned', 'active'].includes(row.status)) {
				throw new Work3Error(
					'transition_not_allowed',
					`skip_phase is not allowed from ${row.status}`
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			if (
				phaseOpenWork(ctx.db, row.entity_id) > 0 &&
				!optionalString(ctx.payload, 'work_disposition')
			) {
				throw new Work3Error(
					'transition_requirements_not_met',
					'Skipping with unfinished Work requires work_disposition',
					{ details: { missing: ['work_disposition'] } }
				);
			}
			ctx.db
				.prepare(`UPDATE phases SET status = 'skipped', skip_reason = ? WHERE entity_id = ?`)
				.run(reason, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'skipped' },
				events: [
					{
						event_type: 'phase_skipped',
						subject_type: 'phase',
						subject_id: row.entity_id,
						summary: `Skipped Phase ${row.entity_id}: ${reason}`,
						payload: {
							reason,
							work_disposition: optionalString(ctx.payload, 'work_disposition') ?? null
						}
					}
				]
			};
		}
	});

	registerCommand({
		name: 'reopen_phase',
		targetType: 'phase',
		summary: 'Reopen a completed/skipped Phase (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = loadPhase(ctx.db, ctx.targetId!)!;
			if (row.status === 'planned')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (!['completed', 'skipped'].includes(row.status)) {
				throw new Work3Error(
					'transition_not_allowed',
					`reopen_phase is not allowed from ${row.status}`
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE phases SET status = 'planned', completed_at = NULL, skip_reason = NULL, reopen_reason = ? WHERE entity_id = ?`
				)
				.run(reason, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'planned' },
				events: [
					{
						event_type: 'phase_reopened',
						subject_type: 'phase',
						subject_id: row.entity_id,
						summary: `Reopened Phase ${row.entity_id}: ${reason}`,
						payload: { reason, prior_status: row.status }
					}
				]
			};
		}
	});
}

export function registerMilestoneCommands(): void {
	registerCommand({
		name: 'create_milestone',
		targetType: null,
		summary: 'Create a Milestone (zero-duration checkpoint with an observable success condition)',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'project_id');
			requireString(payload, 'title', { maxLength: 300 });
			requireString(payload, 'success_condition');
		},
		execute: (ctx) => {
			const projectId = requireString(ctx.payload, 'project_id');
			const { envelope } = requireProject(ctx, projectId);
			const id = allocateEntityId(ctx.db, 'milestone');
			insertEntity(ctx.db, { id, type: 'milestone', areaId: envelope.area_id, now: ctx.now });
			ctx.db
				.prepare(
					`INSERT INTO milestones (entity_id, project_id, title, summary, success_condition, sequence, target_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					projectId,
					requireString(ctx.payload, 'title', { maxLength: 300 }),
					optionalString(ctx.payload, 'summary') ?? null,
					requireString(ctx.payload, 'success_condition'),
					optionalNumber(ctx.payload, 'sequence') ?? 0,
					optionalNumber(ctx.payload, 'target_at') ?? null
				);
			return {
				result: { id, project_id: projectId, status: 'planned' },
				events: [
					{
						event_type: 'milestone_created',
						subject_type: 'milestone',
						subject_id: id,
						summary: `Created Milestone ${id} in ${projectId}`,
						version_from: null,
						version_to: 1,
						payload: { project_id: projectId }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'achieve_milestone',
		targetType: 'milestone',
		summary: 'Achieve a Milestone (source references required unless explicitly waived)',
		requiresTarget: true,
		execute: (ctx) => {
			const row = loadMilestone(ctx.db, ctx.targetId!)!;
			if (row.status === 'achieved')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status !== 'planned') {
				throw new Work3Error(
					'transition_not_allowed',
					`achieve_milestone is not allowed from ${row.status}`,
					{
						alternatives: ['reopen_milestone']
					}
				);
			}
			const waived = optionalString(ctx.payload, 'waive_sources_reason');
			const sourceRefs = parseSourceRefs(ctx.payload.source_refs, { required: !waived });
			ctx.db
				.prepare(
					`UPDATE milestones SET status = 'achieved', achieved_at = ?, source_refs = ?, waived_sources_reason = ? WHERE entity_id = ?`
				)
				.run(ctx.now, JSON.stringify(sourceRefs), waived ?? null, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'achieved' },
				events: [
					{
						event_type: 'milestone_achieved',
						subject_type: 'milestone',
						subject_id: row.entity_id,
						summary: `Achieved Milestone ${row.entity_id}: ${row.title}`,
						payload: { waived_sources_reason: waived ?? null },
						source_refs: sourceRefs
					}
				]
			};
		}
	});

	registerCommand({
		name: 'cancel_milestone',
		targetType: 'milestone',
		summary: 'Cancel a Milestone (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = loadMilestone(ctx.db, ctx.targetId!)!;
			if (row.status === 'cancelled')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			if (row.status !== 'planned') {
				throw new Work3Error(
					'transition_not_allowed',
					`cancel_milestone is not allowed from ${row.status}`
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE milestones SET status = 'cancelled', cancel_reason = ? WHERE entity_id = ?`
				)
				.run(reason, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'cancelled' },
				events: [
					{
						event_type: 'milestone_cancelled',
						subject_type: 'milestone',
						subject_id: row.entity_id,
						summary: `Cancelled Milestone ${row.entity_id}: ${reason}`,
						payload: { reason }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'reopen_milestone',
		targetType: 'milestone',
		summary: 'Reopen an achieved/cancelled Milestone (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = loadMilestone(ctx.db, ctx.targetId!)!;
			if (row.status === 'planned')
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE milestones SET status = 'planned', achieved_at = NULL, cancel_reason = NULL, reopen_reason = ? WHERE entity_id = ?`
				)
				.run(reason, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'planned' },
				events: [
					{
						event_type: 'milestone_reopened',
						subject_type: 'milestone',
						subject_id: row.entity_id,
						summary: `Reopened Milestone ${row.entity_id}: ${reason}`,
						payload: { reason, prior_status: row.status }
					}
				]
			};
		}
	});
}
