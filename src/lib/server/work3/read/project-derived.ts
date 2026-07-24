import type Database from 'better-sqlite3';
import { isBlocked } from './derived.js';
import type { ProjectRow, CompletionCriterion } from '../objects/project.js';
import { projectCriteria, satisfiedCriteria } from '../objects/project.js';
import {
	blockedProjectWorkCount,
	isTerminalProjectWork,
	projectWorkProgress,
	type ProjectWorkType
} from '../objects/project-work.js';

/** Derived Project health, progress, and Milestone schedule state (doc 01). */

export type ProjectHealth = 'on_track' | 'at_risk' | 'blocked' | 'unknown';

export function isValidProjectNextItem(
	db: Database.Database,
	projectId: string,
	itemId: string | null
): boolean {
	if (!itemId) return false;
	const row = db
		.prepare(
			`SELECT type, project_id, status, secondary_state, rollback_started_at FROM (
			   SELECT 'task' AS type, entity_id AS id, project_id, status,
			          NULL AS secondary_state, NULL AS rollback_started_at FROM tasks
			   UNION ALL
			   SELECT 'question', entity_id, project_id, status, NULL, NULL FROM questions
			   UNION ALL
			   SELECT 'decision', entity_id, project_id, status, NULL, NULL FROM decisions
			   UNION ALL
			   SELECT 'change_request', entity_id, project_id, execution_state, verification_state,
			          rollback_started_at FROM change_requests
			 ) WHERE id = ?`
		)
		.get(itemId) as
		| {
				type: ProjectWorkType;
				project_id: string | null;
				status: string;
				secondary_state: string | null;
				rollback_started_at: number | null;
		  }
		| undefined;
	return (
		row?.project_id === projectId &&
		!isTerminalProjectWork(row.type, row.status, row.secondary_state, row.rollback_started_at)
	);
}

export function projectHealth(
	db: Database.Database,
	row: ProjectRow,
	now: number = Date.now()
): { health: ProjectHealth; reason: string; overridden: boolean } {
	// An unexpired override wins (it always carries reason + expiry).
	if (row.health_override) {
		try {
			const override = JSON.parse(row.health_override) as {
				health: ProjectHealth;
				reason: string;
				expires_at: number;
			};
			if (override.expires_at > now) {
				return { health: override.health, reason: override.reason, overridden: true };
			}
		} catch {
			/* fall through to derived */
		}
	}
	if (row.status !== 'active') {
		return { health: 'unknown', reason: `Project is ${row.status}`, overridden: false };
	}
	if (!isValidProjectNextItem(db, row.entity_id, row.current_next_item_id)) {
		return {
			health: 'unknown',
			reason: row.current_next_item_id
				? `Current next item ${row.current_next_item_id} is missing, terminal, or outside the Project`
				: 'No current next item',
			overridden: false
		};
	}
	// Health derives from the current next item (doc 02): a blocked next item
	// blocks the Project; later blocked Work is risk, not a blocked Project.
	if (isBlocked(db, row.current_next_item_id!)) {
		return {
			health: 'blocked',
			reason: `Current next item ${row.current_next_item_id} is blocked`,
			overridden: false
		};
	}
	if (row.target_at !== null && now > row.target_at) {
		return { health: 'at_risk', reason: 'Past target date', overridden: false };
	}
	const laterBlocked = blockedProjectWorkCount(db, row.entity_id);
	if (laterBlocked > 0) {
		return {
			health: 'at_risk',
			reason: `${laterBlocked} blocked Work item(s) in the Project`,
			overridden: false
		};
	}
	return { health: 'on_track', reason: 'Current next item is actionable', overridden: false };
}

export interface ProjectProgress {
	criteria_total: number;
	criteria_satisfied: number;
	criteria_waived: number;
	milestones_total: number;
	milestones_achieved: number;
	work_open: number;
	work_blocked: number;
	work_completed: number;
}

export interface ProjectRiskFlag {
	key:
		| 'blocked_next'
		| 'blocked_work'
		| 'past_target'
		| 'overdue_milestones'
		| 'due_soon_milestones'
		| 'no_next_item'
		| 'open_criteria';
	label: string;
	severity: 'danger' | 'warning' | 'muted';
}

export function projectProgress(db: Database.Database, projectId: string): ProjectProgress {
	const row = db.prepare('SELECT * FROM projects WHERE entity_id = ?').get(projectId) as ProjectRow;
	const criteria: CompletionCriterion[] = projectCriteria(row);
	const satisfied = satisfiedCriteria(db, projectId);
	const milestones = db
		.prepare(
			`SELECT status, COUNT(*) AS count FROM milestones WHERE project_id = ? GROUP BY status`
		)
		.all(projectId) as Array<{ status: string; count: number }>;
	const work = projectWorkProgress(db, projectId);
	const blocked = blockedProjectWorkCount(db, projectId);
	return {
		criteria_total: criteria.length,
		criteria_satisfied: criteria.filter((criterion) => satisfied.has(criterion.id)).length,
		criteria_waived: criteria.filter(
			(criterion) => criterion.waived && !satisfied.has(criterion.id)
		).length,
		milestones_total: milestones.reduce((sum, entry) => sum + entry.count, 0),
		milestones_achieved: milestones.find((entry) => entry.status === 'achieved')?.count ?? 0,
		work_open: work.open,
		work_blocked: blocked,
		work_completed: work.terminal
	};
}

export type MilestoneScheduleState = 'none' | 'due_soon' | 'overdue' | 'achieved';

const DUE_SOON_WINDOW_MS = 7 * 86_400_000;

export function milestoneScheduleState(
	milestone: { status: string; target_at: number | null },
	now: number = Date.now()
): MilestoneScheduleState {
	if (milestone.status === 'achieved') return 'achieved';
	if (milestone.status !== 'planned' || milestone.target_at === null) return 'none';
	if (now > milestone.target_at) return 'overdue';
	if (milestone.target_at - now < DUE_SOON_WINDOW_MS) return 'due_soon';
	return 'none';
}

/**
 * Server-derived operator risk flags. The UI renders these statements without
 * re-deriving project health, milestone schedules, or completion state.
 */
export function projectRiskFlags(
	db: Database.Database,
	row: ProjectRow,
	now: number = Date.now()
): ProjectRiskFlag[] {
	const flags: ProjectRiskFlag[] = [];
	const progress = projectProgress(db, row.entity_id);
	const validCurrentNext = isValidProjectNextItem(db, row.entity_id, row.current_next_item_id);
	if (validCurrentNext && row.current_next_item_id && isBlocked(db, row.current_next_item_id)) {
		flags.push({
			key: 'blocked_next',
			label: `Current next item ${row.current_next_item_id} is blocked`,
			severity: 'danger'
		});
	}
	if (progress.work_blocked > 0) {
		flags.push({
			key: 'blocked_work',
			label: `${progress.work_blocked} blocked Work item${progress.work_blocked === 1 ? '' : 's'}`,
			severity: 'danger'
		});
	}
	if (
		row.target_at !== null &&
		now > row.target_at &&
		!['completed', 'cancelled'].includes(row.status)
	) {
		flags.push({
			key: 'past_target',
			label: 'Project is past its target date',
			severity: 'warning'
		});
	}
	const milestoneStates = (
		db
			.prepare('SELECT status, target_at FROM milestones WHERE project_id = ?')
			.all(row.entity_id) as Array<{ status: string; target_at: number | null }>
	).map((milestone) => milestoneScheduleState(milestone, now));
	const overdue = milestoneStates.filter((state) => state === 'overdue').length;
	const dueSoon = milestoneStates.filter((state) => state === 'due_soon').length;
	if (overdue > 0) {
		flags.push({
			key: 'overdue_milestones',
			label: `${overdue} overdue milestone${overdue === 1 ? '' : 's'}`,
			severity: 'danger'
		});
	}
	if (dueSoon > 0) {
		flags.push({
			key: 'due_soon_milestones',
			label: `${dueSoon} milestone${dueSoon === 1 ? '' : 's'} due within seven days`,
			severity: 'warning'
		});
	}
	if (row.status === 'active' && !validCurrentNext) {
		flags.push({
			key: 'no_next_item',
			label: row.current_next_item_id
				? `Configured current next item ${row.current_next_item_id} is no longer actionable in this Project`
				: 'Active Project has no current next item',
			severity: 'warning'
		});
	}
	const satisfied = satisfiedCriteria(db, row.entity_id);
	const openCriteria = projectCriteria(row).filter(
		(criterion) => !criterion.waived && !satisfied.has(criterion.id)
	).length;
	if (openCriteria > 0) {
		flags.push({
			key: 'open_criteria',
			label: `${openCriteria} completion ${openCriteria === 1 ? 'criterion is' : 'criteria are'} still open`,
			severity: 'muted'
		});
	}
	return flags;
}
