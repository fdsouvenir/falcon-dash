import { getWork3Db } from '../db.js';
import { listWork3Events } from '../eventlog.js';
import { registerObjectReader } from '../read/registry.js';
import { milestoneScheduleState, projectHealth, projectProgress } from '../read/project-derived.js';
import { activeLinks } from './relationships.js';
import { projectCriteria, satisfiedCriteria, type ProjectRow } from './project.js';
import type { MilestoneRow, PhaseRow } from './phase-milestone.js';

/** AXI projections for Project, Phase, Milestone (doc 04). */

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

function projectProjection(row: ProjectRow & EnvelopeJoin, view: string): Record<string, unknown> {
	const db = getWork3Db();
	const health = projectHealth(db, row);
	const progress = projectProgress(db, row.id);
	const base = {
		id: row.id,
		title: row.title,
		status: row.status,
		health: health.health,
		health_reason: health.reason,
		progress: {
			criteria: `${progress.criteria_satisfied + progress.criteria_waived}/${progress.criteria_total}`,
			milestones: `${progress.milestones_achieved}/${progress.milestones_total}`,
			work_open: progress.work_open,
			work_blocked: progress.work_blocked
		},
		current_next_item_id: row.current_next_item_id,
		archived: row.archived_at !== null,
		version: row.version
	};
	if (view === 'list') return base;
	const satisfied = satisfiedCriteria(db, row.id);
	const detail = {
		...base,
		summary: row.summary,
		desired_outcome: row.desired_outcome,
		why_it_matters: row.why_it_matters,
		scope_included: parseJson<string[]>(row.scope_included, []),
		scope_excluded: parseJson<string[]>(row.scope_excluded, []),
		completion_criteria: projectCriteria(row).map((criterion) => ({
			...criterion,
			satisfied: satisfied.has(criterion.id)
		})),
		owner: row.owner,
		target_at: row.target_at,
		started_at: row.started_at,
		completed_at: row.completed_at,
		outcome_summary: row.outcome_summary,
		cancel_reason: row.cancel_reason,
		plan_id: row.plan_id,
		plan_not_required_reason: row.plan_not_required_reason,
		area_id: row.area_id,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
	if (view === 'full') {
		const phases = db
			.prepare(
				`SELECT p.*, e.version FROM phases p JOIN entities e ON e.id = p.entity_id WHERE p.project_id = ? ORDER BY p.sequence ASC`
			)
			.all(row.id) as Array<PhaseRow & { version: number }>;
		const milestones = db
			.prepare(
				`SELECT m.*, e.version FROM milestones m JOIN entities e ON e.id = m.entity_id WHERE m.project_id = ? ORDER BY m.sequence ASC, m.entity_id ASC`
			)
			.all(row.id) as Array<MilestoneRow & { version: number }>;
		const work = db
			.prepare(
				`SELECT t.entity_id AS id, t.title, t.status, t.phase_id FROM tasks t WHERE t.project_id = ?
				 ORDER BY t.status, t.entity_id`
			)
			.all(row.id);
		return {
			...detail,
			phases: phases.map((phase) => ({
				id: phase.entity_id,
				title: phase.title,
				sequence: phase.sequence,
				status: phase.status,
				version: phase.version
			})),
			milestones: milestones.map((milestone) => ({
				id: milestone.entity_id,
				title: milestone.title,
				status: milestone.status,
				schedule_state: milestoneScheduleState(milestone),
				target_at: milestone.target_at,
				version: milestone.version
			})),
			work,
			relationships: {
				incoming: activeLinks(db, { targetId: row.id }).map((link) => ({
					id: link.id,
					rel_type: link.rel_type,
					source_id: link.source_id,
					criterion_id: link.criterion_id,
					invalidated: link.invalidated_at !== null
				}))
			},
			history: listWork3Events({ subjectId: row.id, limit: 100 })
		};
	}
	return detail;
}

export function registerProjectReaders(): void {
	registerObjectReader({
		type: 'project',
		aliases: ['projects'],
		knownFields: [
			'id',
			'title',
			'status',
			'health',
			'health_reason',
			'progress',
			'current_next_item_id',
			'archived',
			'summary',
			'desired_outcome',
			'why_it_matters',
			'scope_included',
			'scope_excluded',
			'completion_criteria',
			'owner',
			'target_at',
			'started_at',
			'completed_at',
			'outcome_summary',
			'cancel_reason',
			'plan_id',
			'plan_not_required_reason',
			'area_id',
			'version',
			'created_at',
			'updated_at',
			'phases',
			'milestones',
			'work',
			'relationships',
			'history'
		],
		knownFilters: ['status', 'area', 'archived'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.status) {
				clauses.push('p.status = ?');
				params.push(options.filters.status);
			}
			if (options.filters.area) {
				clauses.push('e.area_id = ?');
				params.push(options.filters.area);
			}
			if (options.filters.archived === 'true') clauses.push('p.archived_at IS NOT NULL');
			else if (options.filters.archived !== 'all') clauses.push('p.archived_at IS NULL');
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db
					.prepare(
						`SELECT COUNT(*) AS count FROM projects p JOIN entities e ON e.id = p.entity_id ${where}`
					)
					.get(...params) as { count: number }
			).count;
			const rows = db
				.prepare(
					`SELECT p.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM projects p JOIN entities e ON e.id = p.entity_id ${where}
					 ORDER BY e.updated_at DESC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<ProjectRow & EnvelopeJoin>;
			return { items: rows.map((row) => projectProjection(row, options.view)), total };
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT p.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM projects p JOIN entities e ON e.id = p.entity_id WHERE p.entity_id = ?`
				)
				.get(id) as (ProjectRow & EnvelopeJoin) | undefined;
			if (!row) return null;
			return projectProjection(row, options.view === 'list' ? 'list' : options.view);
		}
	});

	registerObjectReader({
		type: 'phase',
		aliases: ['phases'],
		knownFields: [
			'id',
			'project_id',
			'title',
			'summary',
			'sequence',
			'status',
			'open_work',
			'started_at',
			'target_at',
			'completed_at',
			'skip_reason',
			'version'
		],
		knownFilters: ['project', 'status'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.project) {
				clauses.push('p.project_id = ?');
				params.push(options.filters.project);
			}
			if (options.filters.status) {
				clauses.push('p.status = ?');
				params.push(options.filters.status);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db.prepare(`SELECT COUNT(*) AS count FROM phases p ${where}`).get(...params) as {
					count: number;
				}
			).count;
			const rows = db
				.prepare(
					`SELECT p.*, e.version FROM phases p JOIN entities e ON e.id = p.entity_id ${where}
					 ORDER BY p.sequence ASC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<PhaseRow & { version: number }>;
			return {
				items: rows.map((row) => ({
					id: row.entity_id,
					project_id: row.project_id,
					title: row.title,
					summary: row.summary,
					sequence: row.sequence,
					status: row.status,
					open_work: (
						db
							.prepare(
								`SELECT COUNT(*) AS count FROM tasks WHERE phase_id = ? AND status NOT IN ('completed','cancelled')`
							)
							.get(row.entity_id) as { count: number }
					).count,
					started_at: row.started_at,
					target_at: row.target_at,
					completed_at: row.completed_at,
					skip_reason: row.skip_reason,
					version: row.version
				})),
				total
			};
		},
		get: (id) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT p.*, e.version FROM phases p JOIN entities e ON e.id = p.entity_id WHERE p.entity_id = ?`
				)
				.get(id) as (PhaseRow & { version: number }) | undefined;
			if (!row) return null;
			return {
				id: row.entity_id,
				project_id: row.project_id,
				title: row.title,
				summary: row.summary,
				sequence: row.sequence,
				status: row.status,
				started_at: row.started_at,
				target_at: row.target_at,
				completed_at: row.completed_at,
				skip_reason: row.skip_reason,
				version: row.version
			};
		}
	});

	registerObjectReader({
		type: 'milestone',
		aliases: ['milestones'],
		knownFields: [
			'id',
			'project_id',
			'title',
			'summary',
			'success_condition',
			'status',
			'schedule_state',
			'sequence',
			'target_at',
			'achieved_at',
			'source_refs',
			'waived_sources_reason',
			'contributions',
			'version'
		],
		knownFilters: ['project', 'status'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.project) {
				clauses.push('m.project_id = ?');
				params.push(options.filters.project);
			}
			if (options.filters.status) {
				clauses.push('m.status = ?');
				params.push(options.filters.status);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db.prepare(`SELECT COUNT(*) AS count FROM milestones m ${where}`).get(...params) as {
					count: number;
				}
			).count;
			const rows = db
				.prepare(
					`SELECT m.*, e.version FROM milestones m JOIN entities e ON e.id = m.entity_id ${where}
					 ORDER BY m.sequence ASC, m.entity_id ASC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<MilestoneRow & { version: number }>;
			return {
				items: rows.map((row) => ({
					id: row.entity_id,
					project_id: row.project_id,
					title: row.title,
					status: row.status,
					schedule_state: milestoneScheduleState(row),
					target_at: row.target_at,
					version: row.version
				})),
				total
			};
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT m.*, e.version FROM milestones m JOIN entities e ON e.id = m.entity_id WHERE m.entity_id = ?`
				)
				.get(id) as (MilestoneRow & { version: number }) | undefined;
			if (!row) return null;
			const detail = {
				id: row.entity_id,
				project_id: row.project_id,
				title: row.title,
				summary: row.summary,
				success_condition: row.success_condition,
				status: row.status,
				schedule_state: milestoneScheduleState(row),
				sequence: row.sequence,
				target_at: row.target_at,
				achieved_at: row.achieved_at,
				source_refs: parseJson<unknown[]>(row.source_refs, []),
				waived_sources_reason: row.waived_sources_reason,
				version: row.version
			};
			if (options.view !== 'list') {
				return {
					...detail,
					// Contribution vs satisfaction, clearly distinguished (doc 05).
					contributions: activeLinks(db, { targetId: id }).map((link) => ({
						id: link.id,
						rel_type: link.rel_type,
						source_id: link.source_id,
						invalidated: link.invalidated_at !== null
					}))
				};
			}
			return detail;
		}
	});
}
