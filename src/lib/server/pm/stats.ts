import { getDb } from './database.js';

export interface PMStats {
	projects: {
		total: number;
		byStatus: Record<string, number>;
	};
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

	// Overdue count (projects with due_date < today and not done)
	const overdueResult = db
		.prepare(
			`
    SELECT COUNT(*) as count FROM projects
    WHERE due_date IS NOT NULL AND due_date < ? AND status NOT IN ('done', 'cancelled', 'archived')
  `
		)
		.get(today) as { count: number };

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
    SELECT COUNT(*) as count FROM projects
    WHERE due_date IS NOT NULL AND due_date <= ? AND due_date >= ? AND status NOT IN ('done', 'cancelled', 'archived')
  `
		)
		.get(weekFromNow, today) as { count: number };

	return {
		projects: { total: totalProjects, byStatus: projectsByStatus },
		overdue: overdueResult.count,
		recentActivity: recentResult.count,
		dueSoon: dueSoonResult.count
	};
}
