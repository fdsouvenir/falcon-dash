import type Database from 'better-sqlite3';
import { isBlocked } from './derived.js';
import type { ProjectRow, CompletionCriterion } from '../objects/project.js';
import { projectCriteria, satisfiedCriteria } from '../objects/project.js';

/** Derived Project health, progress, and Milestone schedule state (doc 01). */

export type ProjectHealth = 'on_track' | 'at_risk' | 'blocked' | 'unknown';

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
	if (!row.current_next_item_id) {
		return { health: 'unknown', reason: 'No current next item', overridden: false };
	}
	// Health derives from the current next item (doc 02): a blocked next item
	// blocks the Project; later blocked Work is risk, not a blocked Project.
	if (isBlocked(db, row.current_next_item_id)) {
		return {
			health: 'blocked',
			reason: `Current next item ${row.current_next_item_id} is blocked`,
			overridden: false
		};
	}
	if (row.target_at !== null && now > row.target_at) {
		return { health: 'at_risk', reason: 'Past target date', overridden: false };
	}
	const laterBlocked = db
		.prepare(
			`SELECT COUNT(*) AS count FROM blockers b
			 JOIN tasks t ON t.entity_id = b.blocked_id
			 WHERE b.state = 'active' AND t.project_id = ?`
		)
		.get(row.entity_id) as { count: number };
	if (laterBlocked.count > 0) {
		return {
			health: 'at_risk',
			reason: `${laterBlocked.count} blocked Work item(s) in the Project`,
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

export function projectProgress(db: Database.Database, projectId: string): ProjectProgress {
	const row = db.prepare('SELECT * FROM projects WHERE entity_id = ?').get(projectId) as ProjectRow;
	const criteria: CompletionCriterion[] = projectCriteria(row);
	const satisfied = satisfiedCriteria(db, projectId);
	const milestones = db
		.prepare(
			`SELECT status, COUNT(*) AS count FROM milestones WHERE project_id = ? GROUP BY status`
		)
		.all(projectId) as Array<{ status: string; count: number }>;
	const tasks = db
		.prepare(`SELECT status, COUNT(*) AS count FROM tasks WHERE project_id = ? GROUP BY status`)
		.all(projectId) as Array<{ status: string; count: number }>;
	const blocked = db
		.prepare(
			`SELECT COUNT(DISTINCT b.blocked_id) AS count FROM blockers b
			 JOIN tasks t ON t.entity_id = b.blocked_id
			 WHERE b.state = 'active' AND t.project_id = ?`
		)
		.get(projectId) as { count: number };
	const taskCount = (statuses: string[]) =>
		tasks
			.filter((entry) => statuses.includes(entry.status))
			.reduce((sum, entry) => sum + entry.count, 0);
	return {
		criteria_total: criteria.length,
		criteria_satisfied: criteria.filter((criterion) => satisfied.has(criterion.id)).length,
		criteria_waived: criteria.filter((criterion) => criterion.waived).length,
		milestones_total: milestones.reduce((sum, entry) => sum + entry.count, 0),
		milestones_achieved: milestones.find((entry) => entry.status === 'achieved')?.count ?? 0,
		work_open: taskCount(['backlog', 'ready', 'in_progress', 'waiting', 'in_review']),
		work_blocked: blocked.count,
		work_completed: taskCount(['completed'])
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
