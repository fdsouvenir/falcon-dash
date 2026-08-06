import type Database from 'better-sqlite3';
import { getWork3Db } from '../db.js';
import {
	listProjectAssignmentEvents,
	listScopedWork3Events,
	type EventSubjectInterval
} from '../eventlog.js';
import { listProjectAssignmentOutboxEvents } from '../outbox.js';
import { registerObjectReader } from '../read/registry.js';
import { isAuthorityEventType } from '../read/aggregates.js';
import {
	isValidProjectNextItem,
	milestoneScheduleState,
	projectHealth,
	projectProgress,
	projectRiskFlags
} from '../read/project-derived.js';
import { activeLinks } from './relationships.js';
import { projectCriteria, satisfiedCriteria, type ProjectRow } from './project.js';
import type { MilestoneRow, PhaseRow } from './phase-milestone.js';
import { isTerminalProjectWork, phaseWorkProgress, type ProjectWorkType } from './project-work.js';

/** AXI projections for Project, Phase, Milestone (doc 04). */

interface EnvelopeJoin {
	id: string;
	area_id: string | null;
	created_at: number;
	updated_at: number;
	version: number;
}

const PROJECT_HISTORY_LOOKUP_BATCH_SIZE = 200;

function queryInBatches<T>(
	db: Database.Database,
	values: string[],
	statement: (placeholders: string) => string
): T[] {
	const rows: T[] = [];
	for (let offset = 0; offset < values.length; offset += PROJECT_HISTORY_LOOKUP_BATCH_SIZE) {
		const batch = values.slice(offset, offset + PROJECT_HISTORY_LOOKUP_BATCH_SIZE);
		rows.push(...(db.prepare(statement(batch.map(() => '?').join(', '))).all(...batch) as T[]));
	}
	return rows;
}

function parseJson<T>(raw: string | null, fallback: T): T {
	if (raw === null) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function projectWorkMembership(
	projectId: string,
	currentWorkIds: string[]
): Map<string, EventSubjectInterval[]> {
	const byWork = new Map<string, ReturnType<typeof listProjectAssignmentEvents>>();
	const assignmentEvents = new Map(
		[
			...listProjectAssignmentEvents(projectId),
			...listProjectAssignmentOutboxEvents(projectId)
		].map((event) => [event.id, event])
	);
	for (const event of [...assignmentEvents.values()].sort((left, right) =>
		left.id.localeCompare(right.id)
	)) {
		const events = byWork.get(event.subject_id) ?? [];
		events.push(event);
		byWork.set(event.subject_id, events);
	}
	const membership = new Map<string, EventSubjectInterval[]>();
	for (const [workId, events] of byWork) {
		const intervals: EventSubjectInterval[] = [];
		let active = false;
		let startId: string | null = null;
		for (const event of events) {
			const priorProjectId = event.payload.prior_project_id;
			const nextProjectId = event.payload.project_id;
			if (nextProjectId === projectId && priorProjectId !== projectId) {
				if (!active) {
					active = true;
					startId = event.id;
				}
			} else if (priorProjectId === projectId && nextProjectId !== projectId) {
				intervals.push({ subjectId: workId, startId: active ? startId : null, endId: event.id });
				active = false;
				startId = null;
			} else if (priorProjectId === projectId && nextProjectId === projectId && !active) {
				// A first observed same-Project Phase move proves membership
				// existed before the retained assignment history.
				active = true;
				startId = null;
			}
		}
		if (active) intervals.push({ subjectId: workId, startId, endId: null });
		membership.set(workId, intervals);
	}
	for (const workId of currentWorkIds) {
		if (!membership.has(workId)) {
			// Legacy/current rows without retained assignment events are
			// Project-scoped for their available history.
			membership.set(workId, [{ subjectId: workId, startId: null, endId: null }]);
		}
	}
	return membership;
}

function projectProjection(row: ProjectRow & EnvelopeJoin, view: string): Record<string, unknown> {
	const db = getWork3Db();
	const health = projectHealth(db, row);
	const progress = projectProgress(db, row.id);
	const currentNext = row.current_next_item_id
		? (db
				.prepare(
					`SELECT id, title, type, status FROM (
					   SELECT entity_id AS id, title, 'task' AS type, status FROM tasks
					   UNION ALL
					   SELECT entity_id, question, 'question', status FROM questions
					   UNION ALL
					   SELECT d.entity_id, COALESCE(dp.title, d.entity_id), 'decision', d.status
					     FROM decisions d
					     LEFT JOIN decision_packages dp ON dp.parent_id = d.entity_id AND dp.is_current = 1
					   UNION ALL
					   SELECT entity_id, title, 'change_request', execution_state FROM change_requests
					 ) WHERE id = ?`
				)
				.get(row.current_next_item_id) as
				{ id: string; title: string; type: ProjectWorkType; status: string } | undefined)
		: undefined;
	const base = {
		id: row.id,
		title: row.title,
		summary: row.summary,
		portfolio_summary: row.desired_outcome ?? row.summary,
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
		current_next_valid: isValidProjectNextItem(db, row.id, row.current_next_item_id),
		current_next: currentNext ?? null,
		target_at: row.target_at,
		updated_at: row.updated_at,
		archived: row.archived_at !== null,
		version: row.version
	};
	if (view === 'list') return base;
	const satisfied = satisfiedCriteria(db, row.id);
	const detail = {
		...base,
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
				`SELECT id, title, status, type, phase_id, due_at, waiting_on, secondary_state,
				        rollback_started_at, updated_at
				 FROM (
				   SELECT t.entity_id AS id, t.title, t.status, 'task' AS type, t.phase_id, t.due_at,
				          t.waiting_on, NULL AS secondary_state, NULL AS rollback_started_at,
				          e.updated_at
				     FROM tasks t JOIN entities e ON e.id = t.entity_id WHERE t.project_id = ?
				   UNION ALL
				   SELECT q.entity_id, q.question, q.status, 'question', q.phase_id, q.target_at,
				          NULL, NULL, NULL, e.updated_at
				     FROM questions q JOIN entities e ON e.id = q.entity_id WHERE q.project_id = ?
				   UNION ALL
				   SELECT d.entity_id, COALESCE(dp.title, d.entity_id), d.status, 'decision', d.phase_id,
				          d.needed_by, NULL, NULL, NULL, e.updated_at
				     FROM decisions d JOIN entities e ON e.id = d.entity_id
				     LEFT JOIN decision_packages dp ON dp.parent_id = d.entity_id AND dp.is_current = 1
				    WHERE d.project_id = ?
				   UNION ALL
				   SELECT c.entity_id, c.title, c.execution_state, 'change_request', c.phase_id, NULL,
				          NULL, c.verification_state, c.rollback_started_at, e.updated_at
				     FROM change_requests c JOIN entities e ON e.id = c.entity_id WHERE c.project_id = ?
				 )
				 ORDER BY updated_at DESC, id ASC`
			)
			.all(row.id, row.id, row.id, row.id) as Array<{
			id: string;
			title: string;
			status: string;
			type: 'task' | 'question' | 'decision' | 'change_request';
			phase_id: string | null;
			due_at: number | null;
			waiting_on: string | null;
			secondary_state: string | null;
			rollback_started_at: number | null;
			updated_at: number;
		}>;
		const links = [
			...activeLinks(db, { targetId: row.id }),
			...milestones.flatMap((milestone) => activeLinks(db, { targetId: milestone.entity_id }))
		];
		const linkProjection = links.map((link) => ({
			id: link.id,
			rel_type: link.rel_type,
			source_id: link.source_id,
			target_id: link.target_id,
			source_type:
				(
					db.prepare('SELECT type FROM entities WHERE id = ?').get(link.source_id) as
						{ type: string } | undefined
				)?.type ?? 'unknown',
			criterion_id: link.criterion_id,
			source_revision: link.source_revision,
			source_refs: parseJson<unknown[]>(link.source_refs, []),
			invalidated: link.invalidated_at !== null,
			invalidated_reason: link.invalidated_reason
		}));
		const completionCriteria = (
			detail.completion_criteria as Array<{
				id: string;
				text: string;
				satisfied: boolean;
				waived?: { reason: string; by: string; at: number };
			}>
		).map((criterion) => ({
			...criterion,
			contributions: linkProjection.filter(
				(link) =>
					link.rel_type === 'contributes_to' &&
					link.target_id === row.id &&
					link.criterion_id === criterion.id &&
					!link.invalidated
			),
			satisfactions: linkProjection.filter(
				(link) =>
					link.rel_type === 'satisfies' &&
					link.target_id === row.id &&
					link.criterion_id === criterion.id &&
					!link.invalidated
			)
		}));
		const unscopedContributions = linkProjection.filter(
			(link) =>
				link.rel_type === 'contributes_to' &&
				link.target_id === row.id &&
				link.criterion_id === null &&
				!link.invalidated
		);
		const workMembership = projectWorkMembership(
			row.id,
			work.map((item) => item.id)
		);
		const historyWorkIds = [...workMembership.keys()];
		const staticPlanOwnerIds = new Set([row.id, ...phases.map((phase) => phase.entity_id)]);
		const planOwners = [...new Set([...staticPlanOwnerIds, ...historyWorkIds])];
		const historyPlans = queryInBatches<{ id: string; work_item_id: string }>(
			db,
			planOwners,
			(placeholders) =>
				`SELECT entity_id AS id, work_item_id FROM plans
				  WHERE work_item_id IN (${placeholders})`
		);
		const reviewableSubjectIds = [...historyWorkIds, ...historyPlans.map((plan) => plan.id)];
		const historyReviews = queryInBatches<{ id: string; subject_id: string }>(
			db,
			reviewableSubjectIds,
			(placeholders) =>
				`SELECT entity_id AS id, subject_id FROM reviews
				  WHERE subject_id IN (${placeholders})`
		);
		const historyAuthorizations = queryInBatches<{ id: string; subject_id: string }>(
			db,
			historyWorkIds,
			(placeholders) =>
				`SELECT entity_id AS id, subject_id FROM authorizations
				  WHERE subject_id IN (${placeholders})`
		);
		const historyRelationships = queryInBatches<{ id: string }>(
			db,
			[row.id, ...milestones.map((milestone) => milestone.entity_id)],
			(placeholders) =>
				`SELECT id FROM relationships
				  WHERE target_id IN (${placeholders})`
		);
		const staticHistorySubjectIds = [
			row.id,
			...phases.map((phase) => phase.entity_id),
			...milestones.map((milestone) => milestone.entity_id),
			...historyRelationships.map((relationship) => relationship.id),
			...historyPlans
				.filter((plan) => staticPlanOwnerIds.has(plan.work_item_id))
				.map((plan) => plan.id)
		];
		const timedHistorySubjects = new Map<string, string>();
		for (const workId of historyWorkIds) timedHistorySubjects.set(workId, workId);
		for (const plan of historyPlans) {
			if (!staticPlanOwnerIds.has(plan.work_item_id)) {
				timedHistorySubjects.set(plan.id, plan.work_item_id);
			}
		}
		for (const review of historyReviews) {
			const plan = historyPlans.find((candidate) => candidate.id === review.subject_id);
			const workId = plan?.work_item_id ?? review.subject_id;
			if (staticPlanOwnerIds.has(workId)) staticHistorySubjectIds.push(review.id);
			else timedHistorySubjects.set(review.id, workId);
		}
		for (const authorization of historyAuthorizations) {
			timedHistorySubjects.set(authorization.id, authorization.subject_id);
		}
		const subjectIntervals = [...timedHistorySubjects].flatMap(([subjectId, workId]) =>
			(workMembership.get(workId) ?? []).map((interval) => ({ ...interval, subjectId }))
		);
		return {
			...detail,
			completion_criteria: completionCriteria,
			unscoped_contributions: unscopedContributions,
			risk_flags: projectRiskFlags(db, row),
			phases: phases.map((phase) => {
				const phaseProgress = phaseWorkProgress(db, phase.entity_id);
				return {
					id: phase.entity_id,
					title: phase.title,
					sequence: phase.sequence,
					status: phase.status,
					summary: phase.summary,
					target_at: phase.target_at,
					open_work: phaseProgress.open,
					work_total: phaseProgress.total,
					work_completed: phaseProgress.terminal,
					version: phase.version
				};
			}),
			milestones: milestones.map((milestone) => {
				const milestoneLinks = linkProjection.filter(
					(link) => link.target_id === milestone.entity_id
				);
				const sourceRefs = parseJson<unknown[]>(milestone.source_refs, []);
				return {
					id: milestone.entity_id,
					title: milestone.title,
					summary: milestone.summary,
					success_condition: milestone.success_condition,
					sequence: milestone.sequence,
					status: milestone.status,
					schedule_state: milestoneScheduleState(milestone),
					target_at: milestone.target_at,
					source_refs: sourceRefs,
					waived_sources_reason: milestone.waived_sources_reason,
					proof_historical:
						milestone.status !== 'achieved' &&
						(sourceRefs.length > 0 || milestone.waived_sources_reason !== null),
					contributions: milestoneLinks.filter(
						(link) => link.rel_type === 'contributes_to' && !link.invalidated
					),
					satisfactions: milestoneLinks.filter(
						(link) => link.rel_type === 'satisfies' && !link.invalidated
					),
					historical_satisfactions: milestoneLinks.filter(
						(link) => link.rel_type === 'satisfies' && link.invalidated
					),
					version: milestone.version
				};
			}),
			work: work.map((item) => {
				const milestone = milestones.find((candidate) =>
					linkProjection.some(
						(link) =>
							link.source_id === item.id &&
							link.target_id === candidate.entity_id &&
							!link.invalidated
					)
				);
				return {
					...item,
					milestone_id: milestone?.entity_id ?? null,
					terminal: isTerminalProjectWork(
						item.type as ProjectWorkType,
						item.status,
						item.secondary_state,
						item.rollback_started_at
					)
				};
			}),
			relationships: {
				incoming: linkProjection.filter((link) => link.target_id === row.id)
			},
			history: listScopedWork3Events({
				staticSubjectIds: staticHistorySubjectIds,
				subjectIntervals,
				limit: 100
			}).map((event) => ({
				...event,
				authority_act: isAuthorityEventType(event.event_type)
			}))
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
			'current_next_valid',
			'current_next',
			'archived',
			'summary',
			'portfolio_summary',
			'desired_outcome',
			'why_it_matters',
			'scope_included',
			'scope_excluded',
			'completion_criteria',
			'unscoped_contributions',
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
			'risk_flags',
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
			'work_total',
			'work_completed',
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
				items: rows.map((row) => {
					const progress = phaseWorkProgress(db, row.entity_id);
					return {
						id: row.entity_id,
						project_id: row.project_id,
						title: row.title,
						summary: row.summary,
						sequence: row.sequence,
						status: row.status,
						open_work: progress.open,
						work_total: progress.total,
						work_completed: progress.terminal,
						started_at: row.started_at,
						target_at: row.target_at,
						completed_at: row.completed_at,
						skip_reason: row.skip_reason,
						version: row.version
					};
				}),
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
			const progress = phaseWorkProgress(db, row.entity_id);
			return {
				id: row.entity_id,
				project_id: row.project_id,
				title: row.title,
				summary: row.summary,
				sequence: row.sequence,
				status: row.status,
				open_work: progress.open,
				work_total: progress.total,
				work_completed: progress.terminal,
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
