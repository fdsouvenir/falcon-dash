import { getDb } from './database.js';

export interface PMStats {
	projects: {
		total: number;
		byStatus: Record<string, number>;
	};
	tasks: {
		total: number;
		byStatus: Record<string, number>;
	};
	blocked: number;
	overdue: number;
	recentActivity: number;
	dueSoon: number;
}

export function getPMStats(): PMStats {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const today = new Date().toISOString().split('T')[0];
	const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
	const dayAgo = now - 24 * 60 * 60;

	// Project counts by status
	const projectCounts = db
		.prepare(
			`
    SELECT status, COUNT(*) as count FROM projects GROUP BY status
  `
		)
		.all() as { status: string; count: number }[];

	const projectsByStatus: Record<string, number> = {};
	let totalProjects = 0;
	for (const row of projectCounts) {
		projectsByStatus[row.status] = row.count;
		totalProjects += row.count;
	}

	// Task counts by status
	const taskCounts = db
		.prepare(
			`
    SELECT status, COUNT(*) as count FROM tasks GROUP BY status
  `
		)
		.all() as { status: string; count: number }[];

	const tasksByStatus: Record<string, number> = {};
	let totalTasks = 0;
	for (const row of taskCounts) {
		tasksByStatus[row.status] = row.count;
		totalTasks += row.count;
	}

	// Blocked count
	const blockedResult = db
		.prepare(
			`
    SELECT COUNT(DISTINCT blocked_id) as count FROM blocks
    JOIN tasks ON blocks.blocked_id = tasks.id
    WHERE tasks.status NOT IN ('done', 'cancelled')
  `
		)
		.get() as { count: number };

	// Overdue count (projects + tasks with due_date < today and not done)
	const overdueResult = db
		.prepare(
			`
    SELECT (
      SELECT COUNT(*) FROM projects WHERE due_date IS NOT NULL AND due_date < ? AND status NOT IN ('done', 'cancelled', 'archived')
    ) + (
      SELECT COUNT(*) FROM tasks WHERE due_date IS NOT NULL AND due_date < ? AND status NOT IN ('done', 'cancelled', 'archived')
    ) as count
  `
		)
		.get(today, today) as { count: number };

	// Recent activity (24h)
	const recentResult = db
		.prepare(
			`
    SELECT COUNT(*) as count FROM activities WHERE created_at > ?
  `
		)
		.get(dayAgo) as { count: number };

	// Due soon (7 days)
	const dueSoonResult = db
		.prepare(
			`
    SELECT (
      SELECT COUNT(*) FROM projects WHERE due_date IS NOT NULL AND due_date <= ? AND due_date >= ? AND status NOT IN ('done', 'cancelled', 'archived')
    ) + (
      SELECT COUNT(*) FROM tasks WHERE due_date IS NOT NULL AND due_date <= ? AND due_date >= ? AND status NOT IN ('done', 'cancelled', 'archived')
    ) as count
  `
		)
		.get(weekFromNow, today, weekFromNow, today) as { count: number };

	return {
		projects: { total: totalProjects, byStatus: projectsByStatus },
		tasks: { total: totalTasks, byStatus: tasksByStatus },
		blocked: blockedResult.count,
		overdue: overdueResult.count,
		recentActivity: recentResult.count,
		dueSoon: dueSoonResult.count
	};
}
