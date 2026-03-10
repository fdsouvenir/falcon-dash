import { getDb } from './database.js';
import type { Project, Activity } from './database.js';

export interface ContextResponse {
	markdown: string;
	generated_at: number;
	stats: Record<string, number>;
}

export interface DashboardContextResponse extends ContextResponse {
	dueSoon: { type: string; id: number; title: string; due_date: string }[];
	recentActivity: (Activity & { project_title: string })[];
}

// Dashboard context: overview of all active work
export function generateDashboardContext(): DashboardContextResponse {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const weekFromNow = now + 7 * 24 * 60 * 60;
	const dayAgo = now - 24 * 60 * 60;

	// Get active projects
	const activeProjects = db
		.prepare(
			`
		SELECT p.*, c.name as category_name, s.name as subcategory_name
		FROM projects p
		JOIN categories c ON p.category_id = c.id
		LEFT JOIN subcategories s ON p.subcategory_id = s.id
		WHERE p.status IN ('todo', 'in_progress', 'review')
		ORDER BY p.last_activity_at DESC
		LIMIT 20
	`
		)
		.all() as (Project & { category_name: string; subcategory_name: string | null })[];

	// Due soon (next 7 days) — projects only
	const dueSoon = db
		.prepare(
			`
		SELECT 'project' as type, id, title, due_date FROM projects
		WHERE due_date IS NOT NULL AND due_date <= ? AND status NOT IN ('done', 'cancelled', 'archived')
		ORDER BY due_date
	`
		)
		.all(new Date(weekFromNow * 1000).toISOString().split('T')[0]) as {
		type: string;
		id: number;
		title: string;
		due_date: string;
	}[];

	// Active plans (planning, assigned, in_progress, needs_review)
	const activePlans = db
		.prepare(
			`
		SELECT pl.id, pl.title, pl.status, pl.project_id, p.title as project_title
		FROM plans pl
		JOIN projects p ON pl.project_id = p.id
		WHERE pl.status IN ('planning', 'assigned', 'in_progress', 'needs_review')
		ORDER BY pl.project_id ASC, pl.sort_order ASC
	`
		)
		.all() as { id: number; title: string; status: string; project_id: number; project_title: string }[];

	// Recent activity
	const recentActivity = db
		.prepare(
			`
		SELECT a.*, p.title as project_title
		FROM activities a
		JOIN projects p ON a.project_id = p.id
		WHERE a.created_at > ?
		ORDER BY a.created_at DESC
		LIMIT 10
	`
		)
		.all(dayAgo) as (Activity & { project_title: string })[];

	// Build markdown
	let md = '# Dashboard Overview\n\n';

	md += `## Active Projects (${activeProjects.length})\n`;
	for (const p of activeProjects) {
		const categoryPath = p.subcategory_name 
			? `${p.category_name}/${p.subcategory_name}` 
			: p.category_name;
		md += `- **${p.title}** [${p.status}] — ${categoryPath}\n`;
	}

	if (activePlans.length > 0) {
		md += `\n## Active Plans (${activePlans.length})\n`;
		for (const plan of activePlans) {
			md += `- [${plan.status}] "${plan.title}" — P-${plan.project_id}: ${plan.project_title}\n`;
		}
	}

	if (dueSoon.length > 0) {
		md += `\n## Due Soon (${dueSoon.length})\n`;
		for (const d of dueSoon) {
			md += `- P-${d.id}: ${d.title} (due ${d.due_date})\n`;
		}
	}

	if (recentActivity.length > 0) {
		md += `\n## Recent Activity\n`;
		for (const a of recentActivity) {
			md += `- ${a.actor} ${a.action} ${a.target_type} in ${a.project_title}\n`;
		}
	}

	return {
		markdown: md,
		generated_at: now,
		stats: {
			activeProjects: activeProjects.length,
			activePlans: activePlans.length,
			dueSoon: dueSoon.length,
			recentActivity: recentActivity.length
		},
		dueSoon,
		recentActivity
	};
}

// Category context: deep dive into a category
export function generateCategoryContext(categoryId: string): ContextResponse {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId) as
		| { id: string; name: string; description: string | null; color: string | null }
		| undefined;
	if (!category) throw new Error('Category not found');

	const subcategories = db
		.prepare('SELECT * FROM subcategories WHERE category_id = ? ORDER BY sort_order')
		.all(categoryId) as { id: string; name: string; description: string | null }[];

	// Count projects for stats
	const projectCountResult = db
		.prepare('SELECT COUNT(*) as c FROM projects WHERE category_id = ?')
		.get(categoryId) as { c: number } | undefined;
	const projectCount = projectCountResult?.c ?? 0;

	let md = `# Category: ${category.name}\n`;
	if (category.description) md += `${category.description}\n`;
	md += '\n';

	for (const subcategory of subcategories) {
		md += `## Subcategory: ${subcategory.name}\n`;
		if (subcategory.description) md += `${subcategory.description}\n`;

		const projects = db
			.prepare(
				`
			SELECT p.*
			FROM projects p WHERE p.subcategory_id = ? ORDER BY p.last_activity_at DESC
		`
			)
			.all(subcategory.id) as Project[];

		for (const p of projects) {
			md += `\n### P-${p.id}: ${p.title} [${p.status}]\n`;
			if (p.description) md += `${p.description}\n`;
			if (p.due_date) md += `Due: ${p.due_date}\n`;
		}
		md += '\n';
	}

	// Projects without subcategory
	const directProjects = db
		.prepare(
			`
		SELECT p.*
		FROM projects p WHERE p.category_id = ? AND p.subcategory_id IS NULL 
		ORDER BY p.last_activity_at DESC
	`
		)
		.all(categoryId) as Project[];

	if (directProjects.length > 0) {
		md += `## Direct Projects\n`;
		for (const p of directProjects) {
			md += `\n### P-${p.id}: ${p.title} [${p.status}]\n`;
			if (p.description) md += `${p.description}\n`;
			if (p.due_date) md += `Due: ${p.due_date}\n`;
		}
		md += '\n';
	}

	return {
		markdown: md,
		generated_at: now,
		stats: {
			subcategories: subcategories.length,
			projects: projectCount
		}
	};
}

// Project context: full detail of a project
export function generateProjectContext(projectId: number): ContextResponse {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const project = db
		.prepare(
			`
		SELECT p.*, c.name as category_name, s.name as subcategory_name
		FROM projects p
		JOIN categories c ON p.category_id = c.id
		LEFT JOIN subcategories s ON p.subcategory_id = s.id
		WHERE p.id = ?
	`
		)
		.get(projectId) as (Project & { category_name: string; subcategory_name: string | null }) | undefined;

	if (!project) throw new Error('Project not found');

	const activities = db
		.prepare('SELECT * FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT 20')
		.all(projectId) as Activity[];

	// Get plans for this project
	const plans = db
		.prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY sort_order')
		.all(projectId) as Array<{
		id: number;
		title: string;
		description: string | null;
		result: string | null;
		status: string;
	}>;

	// Build markdown
	const categoryPath = project.subcategory_name 
		? `${project.category_name}/${project.subcategory_name}` 
		: project.category_name;
	
	let md = `# P-${project.id}: ${project.title}\n`;
	md += `**Status:** ${project.status} | **Priority:** ${project.priority ?? 'normal'} | **Category:** ${categoryPath}\n`;
	if (project.description) md += `\n${project.description}\n`;
	if (project.due_date) md += `**Due:** ${project.due_date}\n`;
	md += '\n';

	// Body
	if (project.body) {
		md += `## Status\n\n${project.body}\n\n`;
	}

	// Plans
	if (plans.length > 0) {
		md += `## Plans (${plans.length})\n`;
		for (const plan of plans) {
			md += `\n### ${plan.title} [${plan.status}]\n`;
			if (plan.description) md += `${plan.description}\n`;
			if (plan.result) md += `\n**Result:** ${plan.result}\n`;
		}
		md += '\n';
	}

	// Activity
	if (activities.length > 0) {
		md += `## Recent Activity (${activities.length})\n`;
		for (const a of activities) {
			md += `- ${a.actor} ${a.action} ${a.target_type}${a.target_title ? ' "' + a.target_title + '"' : ''}\n`;
		}
	}

	return {
		markdown: md,
		generated_at: now,
		stats: {
			activities: activities.length,
			plans: plans.length
		}
	};
}

// Compatibility alias for existing domain routes
export const generateDomainContext = generateCategoryContext;
