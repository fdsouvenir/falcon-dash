import {
	existsSync,
	mkdirSync,
	writeFileSync,
	readdirSync,
	unlinkSync,
	symlinkSync,
	readlinkSync,
	lstatSync
} from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { generateDashboardContext, generateProjectContext } from './context.js';
import { getDb } from './database.js';
import type { Project } from './database.js';
import { discoverAgentWorkspaces } from './workspace-discovery.js';

const SHARED_DIR = join(homedir(), '.openclaw', 'data', 'pm-context');

function getOutputDir(): string {
	return process.env.PM_CONTEXT_DIR ?? SHARED_DIR;
}

/**
 * Ensure a symlink exists at `linkPath` pointing to `target`.
 * Replaces existing symlinks or removes stale ones.
 */
function ensureSymlink(target: string, linkPath: string): void {
	try {
		if (lstatSync(linkPath).isSymbolicLink()) {
			if (readlinkSync(linkPath) === target) return;
			unlinkSync(linkPath);
		} else {
			// Real file/dir exists — don't overwrite
			return;
		}
	} catch {
		// Doesn't exist, create it
	}
	try {
		symlinkSync(target, linkPath);
	} catch {
		// Symlink creation failed (permissions, etc.) — non-fatal
	}
}

/**
 * Create symlinks in each agent workspace pointing to the shared PM context dir.
 */
function symlinkToWorkspaces(sharedDir: string): void {
	const workspaces = discoverAgentWorkspaces();

	for (const { workspace } of workspaces) {
		// Skip if workspace IS the shared dir
		if (workspace === sharedDir) continue;

		mkdirSync(workspace, { recursive: true });

		// Symlink PROJECTS.md
		ensureSymlink(join(sharedDir, 'PROJECTS.md'), join(workspace, 'PROJECTS.md'));

		// Symlink Projects/ directory
		ensureSymlink(join(sharedDir, 'Projects'), join(workspace, 'Projects'));

		// Symlink PM-API.md
		ensureSymlink(join(sharedDir, 'PM-API.md'), join(workspace, 'PM-API.md'));
	}
}

function generatePMApiDoc(): string {
	const base = 'http://localhost:3000/api/pm';

	return `# PM API Reference

> Auto-generated reference for the Falcon Dash Project Management REST API.
> Base URL: \`${base}\`

All list endpoints return: \`{ items: [...], total, page, limit, hasMore }\`
All IDs: projects use numeric IDs; categories/subcategories use string slug IDs.
Statuses: \`todo\`, \`in_progress\`, \`review\`, \`done\`, \`cancelled\`, \`archived\`
Priorities: \`low\`, \`normal\`, \`high\`, \`urgent\`
Plan Statuses: \`planning\`, \`assigned\`, \`in_progress\`, \`needs_review\`, \`complete\`, \`cancelled\`
Dates: ISO 8601 date format \`YYYY-MM-DD\`

---

## Categories

### List categories
\`\`\`
GET ${base}/categories?page=1&limit=50
\`\`\`

### Create category
\`\`\`
POST ${base}/categories
Content-Type: application/json

{"id": "my-category", "name": "My Category", "description": "Optional description", "color": "#60a5fa"}
\`\`\`

### Get category
\`\`\`
GET ${base}/categories/{id}
\`\`\`

### Update category
\`\`\`
PATCH ${base}/categories/{id}
Content-Type: application/json

{"name": "New Name", "description": "Updated description", "color": "#a78bfa"}
\`\`\`

### Delete category
\`\`\`
DELETE ${base}/categories/{id}
\`\`\`

### Reorder categories
\`\`\`
POST ${base}/categories/reorder
Content-Type: application/json

{"ids": ["category-a", "category-b", "category-c"]}
\`\`\`

---

## Subcategories

### List subcategories
\`\`\`
GET ${base}/subcategories?category_id=my-category&page=1&limit=50
\`\`\`

### Create subcategory
\`\`\`
POST ${base}/subcategories
Content-Type: application/json

{"id": "my-subcategory", "category_id": "my-category", "name": "My Subcategory", "description": "Optional"}
\`\`\`

### Get subcategory
\`\`\`
GET ${base}/subcategories/{id}
\`\`\`

### Update subcategory
\`\`\`
PATCH ${base}/subcategories/{id}
Content-Type: application/json

{"name": "New Name", "description": "Updated", "category_id": "other-category"}
\`\`\`

### Delete subcategory
\`\`\`
DELETE ${base}/subcategories/{id}
\`\`\`

### Move subcategory to another category
\`\`\`
POST ${base}/subcategories/{id}/move
Content-Type: application/json

{"category_id": "target-category"}
\`\`\`

### Reorder subcategories
\`\`\`
POST ${base}/subcategories/reorder
Content-Type: application/json

{"ids": ["subcategory-a", "subcategory-b", "subcategory-c"]}
\`\`\`

---

## Projects

### List projects
\`\`\`
GET ${base}/projects?category_id=my-category&subcategory_id=my-subcategory&status=in_progress&page=1&limit=50
\`\`\`

### Create project
\`\`\`
POST ${base}/projects
Content-Type: application/json

{"category_id": "my-category", "subcategory_id": "my-subcategory", "title": "Project Title", "description": "Optional", "body": "Rich markdown content", "status": "todo", "priority": "normal", "due_date": "2025-12-31"}
\`\`\`
Required: \`category_id\`, \`title\`. Optional: \`subcategory_id\`, \`description\`, \`body\` (rich markdown), \`status\` (default: todo), \`priority\`, \`due_date\`.

### Get project
\`\`\`
GET ${base}/projects/{id}
\`\`\`

### Update project
\`\`\`
PATCH ${base}/projects/{id}
Content-Type: application/json

{"title": "New Title", "status": "in_progress", "priority": "high", "due_date": "2025-12-31", "category_id": "new-category", "subcategory_id": "new-subcategory", "description": "Updated", "body": "Updated rich markdown content"}
\`\`\`

### Delete project
\`\`\`
DELETE ${base}/projects/{id}
\`\`\`

---

## Plans

### List plans for a project
\`\`\`
GET ${base}/plans?project_id=1&page=1&limit=50
\`\`\`

### Create plan
\`\`\`
POST ${base}/plans
Content-Type: application/json

{"project_id": 1, "title": "Plan Title", "description": "Plan description", "status": "planning"}
\`\`\`
Required: \`project_id\`, \`title\`. Optional: \`description\`, \`result\`, \`status\` (default: planning).

### Get plan
\`\`\`
GET ${base}/plans/{id}
\`\`\`

### Update plan (auto-versions on edit)
\`\`\`
PATCH ${base}/plans/{id}
Content-Type: application/json

{"title": "Updated Title", "description": "Updated description", "result": "Plan outcome", "status": "complete"}
\`\`\`

### Delete plan
\`\`\`
DELETE ${base}/plans/{id}
\`\`\`

### Reorder plans
\`\`\`
POST ${base}/plans/reorder
Content-Type: application/json

{"ids": [1, 2, 3]}
\`\`\`

### List plan versions
\`\`\`
GET ${base}/plans/{id}/versions
\`\`\`

### Revert to plan version
\`\`\`
POST ${base}/plans/{id}/revert
Content-Type: application/json

{"version": 2}
\`\`\`

---

## Activities

### List activities for a project
\`\`\`
GET ${base}/activities?project_id=1&page=1&limit=50
\`\`\`
Required: \`project_id\`. Read-only — activities are auto-generated by mutations.

---

## Search

### Full-text search
\`\`\`
GET ${base}/search?q=search+terms&entity_type=project&project_id=1&limit=20&offset=0
\`\`\`
Required: \`q\`. Optional: \`entity_type\`, \`project_id\`, \`limit\` (default: 20), \`offset\` (default: 0).

---

## Context

### Get dashboard context (markdown)
\`\`\`
GET ${base}/context
\`\`\`

### Trigger context file regeneration
\`\`\`
POST ${base}/context
\`\`\`

### Get project context
\`\`\`
GET ${base}/context/project/{id}
\`\`\`

### Get domain context
\`\`\`
GET ${base}/context/domain/{id}
\`\`\`

---

## Stats

### Get PM statistics
\`\`\`
GET ${base}/stats
\`\`\`
`;
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
			SELECT p.*, 
			       c.name as category_name, 
			       s.name as subcategory_name,
			       c.color as category_color
			FROM projects p
			JOIN categories c ON p.category_id = c.id
			LEFT JOIN subcategories s ON p.subcategory_id = s.id
			WHERE p.status IN ('todo', 'in_progress', 'review')
			ORDER BY p.last_activity_at DESC
		`
		)
		.all() as (Project & {
		category_name: string;
		subcategory_name: string | null;
		category_color: string | null;
	})[];

	let projectsMd = '# Active Projects\n\n';
	projectsMd += `> Generated: ${new Date().toISOString()}\n\n`;

	if (activeProjects.length > 0) {
		projectsMd += '| ID | Title | Status | Category/Subcategory | Due |\n';
		projectsMd += '|---|---|---|---|---|\n';
		for (const p of activeProjects) {
			const categoryPath = p.subcategory_name 
				? `${p.category_name}/${p.subcategory_name}` 
				: p.category_name;
			projectsMd += `| P-${p.id} | ${p.title} | ${p.status} | ${categoryPath} | ${p.due_date ?? '-'} |\n`;
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

	// 4. Generate PM-API.md
	writeFileSync(join(dir, 'PM-API.md'), generatePMApiDoc(), 'utf-8');
	filesWritten++;

	// 5. Create symlinks in agent workspaces
	symlinkToWorkspaces(dir);

	return { filesWritten, timestamp: Date.now() };
}
