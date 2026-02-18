import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { generateDashboardContext, generateProjectContext } from './context.js';
import { getDb } from './database.js';
import type { Project } from './database.js';

const DEFAULT_DIR = join(process.env.HOME ?? '/tmp', '.openclaw', 'workspace');

function getOutputDir(): string {
	return process.env.PM_CONTEXT_DIR ?? DEFAULT_DIR;
}

export function generateAndWriteContext(): { filesWritten: number; timestamp: number } {
	const dir = getOutputDir();
	const projectsDir = join(dir, 'Projects');

	// Ensure directories exist
	mkdirSync(dir, { recursive: true });
	mkdirSync(projectsDir, { recursive: true });

	let filesWritten = 0;
	const db = getDb();

	// 1. Generate PROJECTS.md - summary table of active projects
	const dashboard = generateDashboardContext();
	const activeProjects = db
		.prepare(
			`
			SELECT p.*, f.name as focus_name, d.name as domain_name,
				(SELECT COUNT(*) FROM tasks WHERE parent_project_id = p.id) as task_count,
				(SELECT COUNT(*) FROM tasks WHERE parent_project_id = p.id AND status = 'done') as done_count
			FROM projects p
			JOIN focuses f ON p.focus_id = f.id
			JOIN domains d ON f.domain_id = d.id
			WHERE p.status IN ('todo', 'in_progress', 'review')
			ORDER BY p.last_activity_at DESC
		`
		)
		.all() as (Project & {
		focus_name: string;
		domain_name: string;
		task_count: number;
		done_count: number;
	})[];

	let projectsMd = '# Active Projects\n\n';
	projectsMd += `> Generated: ${new Date().toISOString()}\n\n`;

	if (activeProjects.length > 0) {
		projectsMd += '| ID | Title | Status | Domain/Focus | Progress | Due |\n';
		projectsMd += '|---|---|---|---|---|---|\n';
		for (const p of activeProjects) {
			const progress = p.task_count > 0 ? `${p.done_count}/${p.task_count}` : '-';
			projectsMd += `| P-${p.id} | ${p.title} | ${p.status} | ${p.domain_name}/${p.focus_name} | ${progress} | ${p.due_date ?? '-'} |\n`;
		}
	} else {
		projectsMd += 'No active projects.\n';
	}

	projectsMd += '\n---\n\n' + dashboard.markdown;

	writeFileSync(join(dir, 'PROJECTS.md'), projectsMd, 'utf-8');
	filesWritten++;

	// 2. Generate per-project files
	const activeIds = new Set<string>();
	for (const p of activeProjects) {
		const ctx = generateProjectContext(p.id);
		const filename = `${p.id}.md`;
		activeIds.add(filename);
		writeFileSync(join(projectsDir, filename), ctx.markdown, 'utf-8');
		filesWritten++;
	}

	// 3. Cleanup stale project files
	if (existsSync(projectsDir)) {
		for (const file of readdirSync(projectsDir)) {
			if (file.endsWith('.md') && !activeIds.has(file)) {
				unlinkSync(join(projectsDir, file));
			}
		}
	}

	return { filesWritten, timestamp: Date.now() };
}
