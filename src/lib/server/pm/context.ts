import { getDb } from './database.js';
import type { Project, Task, Activity, Comment } from './database.js';

export interface ContextResponse {
	markdown: string;
	generated_at: number;
	stats: Record<string, number>;
}

// Dashboard context: overview of all active work
export function generateDashboardContext(): ContextResponse {
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

	// Due soon (next 7 days)
	const dueSoon = db
		.prepare(
			`
		SELECT 'project' as type, id, title, due_date FROM projects
		WHERE due_date IS NOT NULL AND due_date <= ? AND status NOT IN ('done', 'cancelled', 'archived')
		UNION ALL
		SELECT 'task' as type, id, title, due_date FROM tasks
		WHERE due_date IS NOT NULL AND due_date <= ? AND status NOT IN ('done', 'cancelled', 'archived')
		ORDER BY due_date
	`
		)
		.all(
			new Date(weekFromNow * 1000).toISOString().split('T')[0],
			new Date(weekFromNow * 1000).toISOString().split('T')[0]
		) as { type: string; id: number; title: string; due_date: string }[];

	// Blocked tasks
	const blocked = db
		.prepare(
			`
		SELECT t.id, t.title, COUNT(b.blocker_id) as blocker_count
		FROM tasks t
		JOIN blocks b ON b.blocked_id = t.id
		WHERE t.status NOT IN ('done', 'cancelled')
		GROUP BY t.id
	`
		)
		.all() as { id: number; title: string; blocker_count: number }[];

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
			md += `- ${d.type === 'project' ? 'P' : 'T'}-${d.id}: ${d.title} (due ${d.due_date})\n`;
		}
	}

	if (blocked.length > 0) {
		md += `\n## Blocked (${blocked.length})\n`;
		for (const b of blocked) {
			md += `- T-${b.id}: ${b.title} (${b.blocker_count} blocker${b.blocker_count > 1 ? 's' : ''})\n`;
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
			blocked: blocked.length,
			recentActivity: recentActivity.length
		}
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
			SELECT p.*, (SELECT COUNT(*) FROM tasks WHERE parent_project_id = p.id) as task_count,
			       (SELECT COUNT(*) FROM tasks WHERE parent_project_id = p.id AND status = 'done') as done_count
			FROM projects p WHERE p.focus_id = ? ORDER BY p.last_activity_at DESC
		`
			)
			.all(focus.id) as (Project & { task_count: number; done_count: number })[];

		for (const p of projects) {
			md += `\n### P-${p.id}: ${p.title} [${p.status}]\n`;
			if (p.description) md += `${p.description}\n`;
			md += `Progress: ${p.done_count}/${p.task_count} tasks done\n`;
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

	const tasks = db
		.prepare('SELECT * FROM tasks WHERE parent_project_id = ? ORDER BY sort_order, created_at')
		.all(projectId) as Task[];
	const subtasks = db
		.prepare(
			`
		SELECT t.* FROM tasks t
		JOIN tasks parent ON t.parent_task_id = parent.id
		WHERE parent.parent_project_id = ?
		ORDER BY t.sort_order, t.created_at
	`
		)
		.all(projectId) as Task[];

	const comments = db
		.prepare(
			`
		SELECT c.* FROM comments c
		WHERE (c.target_type = 'project' AND c.target_id = ?)
		OR (c.target_type = 'task' AND c.target_id IN (SELECT id FROM tasks WHERE parent_project_id = ?))
		ORDER BY c.created_at DESC LIMIT 20
	`
		)
		.all(projectId, projectId) as Comment[];

	const activities = db
		.prepare('SELECT * FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT 20')
		.all(projectId) as Activity[];

	const blocks = db
		.prepare(
			`
		SELECT b.*, t1.title as blocker_title, t2.title as blocked_title
		FROM blocks b
		JOIN tasks t1 ON b.blocker_id = t1.id
		JOIN tasks t2 ON b.blocked_id = t2.id
		WHERE t1.parent_project_id = ? OR t2.parent_project_id = ?
	`
		)
		.all(projectId, projectId) as {
		blocker_id: number;
		blocked_id: number;
		blocker_title: string;
		blocked_title: string;
	}[];

	// Build markdown
	let md = `# P-${project.id}: ${project.title}\n`;
	md += `**Status:** ${project.status} | **Priority:** ${project.priority ?? 'normal'} | **Focus:** ${project.domain_name}/${project.focus_name}\n`;
	if (project.description) md += `\n${project.description}\n`;
	if (project.due_date) md += `**Due:** ${project.due_date}\n`;
	md += '\n';

	// Tasks
	md += `## Tasks (${tasks.length})\n`;
	for (const t of tasks) {
		const status = t.status === 'done' ? '[x]' : '[ ]';
		md += `- ${status} T-${t.id}: ${t.title} [${t.status}]${t.priority ? ' !' + t.priority : ''}\n`;
		// Show subtasks
		const subs = subtasks.filter((s) => s.parent_task_id === t.id);
		for (const s of subs) {
			const subStatus = s.status === 'done' ? '[x]' : '[ ]';
			md += `  - ${subStatus} T-${s.id}: ${s.title} [${s.status}]\n`;
		}
	}

	// Blocks
	if (blocks.length > 0) {
		md += `\n## Dependencies (${blocks.length})\n`;
		for (const b of blocks) {
			md += `- T-${b.blocker_id} (${b.blocker_title}) blocks T-${b.blocked_id} (${b.blocked_title})\n`;
		}
	}

	// Comments
	if (comments.length > 0) {
		md += `\n## Recent Comments (${comments.length})\n`;
		for (const c of comments) {
			md += `- **${c.author}** on ${c.target_type} ${c.target_id}: ${c.body.substring(0, 200)}${c.body.length > 200 ? '...' : ''}\n`;
		}
	}

	// Activity
	if (activities.length > 0) {
		md += `\n## Recent Activity (${activities.length})\n`;
		for (const a of activities) {
			md += `- ${a.actor} ${a.action} ${a.target_type}${a.target_title ? ' "' + a.target_title + '"' : ''}\n`;
		}
	}

	return {
		markdown: md,
		generated_at: now,
		stats: {
			tasks: tasks.length,
			subtasks: subtasks.length,
			comments: comments.length,
			activities: activities.length,
			blocks: blocks.length
		}
	};
}
