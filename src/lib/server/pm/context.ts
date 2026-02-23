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
		SELECT p.*, f.name as focus_name, d.name as domain_name
		FROM projects p
		JOIN focuses f ON p.focus_id = f.id
		JOIN domains d ON f.domain_id = d.id
		WHERE p.status IN ('todo', 'in_progress', 'review')
		ORDER BY p.last_activity_at DESC
		LIMIT 20
	`
		)
		.all() as (Project & { focus_name: string; domain_name: string })[];

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
		md += `- **${p.title}** [${p.status}] — ${p.domain_name}/${p.focus_name}\n`;
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
			dueSoon: dueSoon.length,
			recentActivity: recentActivity.length
		},
		dueSoon,
		recentActivity
	};
}

// Domain context: deep dive into a domain
export function generateDomainContext(domainId: string): ContextResponse {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(domainId) as
		| { id: string; name: string; description: string | null }
		| undefined;
	if (!domain) throw new Error('Domain not found');

	const focuses = db
		.prepare('SELECT * FROM focuses WHERE domain_id = ? ORDER BY sort_order')
		.all(domainId) as { id: string; name: string; description: string | null }[];

	// Count projects for stats
	const projectCountResult = db
		.prepare(
			'SELECT COUNT(*) as c FROM projects p JOIN focuses f ON p.focus_id = f.id WHERE f.domain_id = ?'
		)
		.get(domainId) as { c: number } | undefined;
	const projectCount = projectCountResult?.c ?? 0;

	let md = `# Domain: ${domain.name}\n`;
	if (domain.description) md += `${domain.description}\n`;
	md += '\n';

	for (const focus of focuses) {
		md += `## Focus: ${focus.name}\n`;
		if (focus.description) md += `${focus.description}\n`;

		const projects = db
			.prepare(
				`
			SELECT p.*
			FROM projects p WHERE p.focus_id = ? ORDER BY p.last_activity_at DESC
		`
			)
			.all(focus.id) as Project[];

		for (const p of projects) {
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
			focuses: focuses.length,
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
		SELECT p.*, f.name as focus_name, d.name as domain_name
		FROM projects p
		JOIN focuses f ON p.focus_id = f.id
		JOIN domains d ON f.domain_id = d.id
		WHERE p.id = ?
	`
		)
		.get(projectId) as (Project & { focus_name: string; domain_name: string }) | undefined;

	if (!project) throw new Error('Project not found');

	const activities = db
		.prepare('SELECT * FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT 20')
		.all(projectId) as Activity[];

	// Build markdown
	let md = `# P-${project.id}: ${project.title}\n`;
	md += `**Status:** ${project.status} | **Priority:** ${project.priority ?? 'normal'} | **Focus:** ${project.domain_name}/${project.focus_name}\n`;
	if (project.description) md += `\n${project.description}\n`;
	if (project.due_date) md += `**Due:** ${project.due_date}\n`;
	md += '\n';

	// Body
	if (project.body) {
		md += `## Status\n\n${project.body}\n\n`;
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
			activities: activities.length
		}
	};
}
