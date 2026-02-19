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
All IDs: projects/tasks/milestones/comments/attachments use numeric IDs; domains/focuses use string slug IDs.
Statuses: \`todo\`, \`in_progress\`, \`review\`, \`done\`, \`cancelled\`, \`archived\`
Priorities: \`low\`, \`normal\`, \`high\`, \`urgent\`
Dates: ISO 8601 date format \`YYYY-MM-DD\`

---

## Domains

### List domains
\`\`\`
GET ${base}/domains?page=1&limit=50
\`\`\`

### Create domain
\`\`\`
POST ${base}/domains
Content-Type: application/json

{"id": "my-domain", "name": "My Domain", "description": "Optional description"}
\`\`\`

### Get domain
\`\`\`
GET ${base}/domains/{id}
\`\`\`

### Update domain
\`\`\`
PATCH ${base}/domains/{id}
Content-Type: application/json

{"name": "New Name", "description": "Updated description"}
\`\`\`

### Delete domain
\`\`\`
DELETE ${base}/domains/{id}
\`\`\`

### Reorder domains
\`\`\`
POST ${base}/domains/reorder
Content-Type: application/json

{"ids": ["domain-a", "domain-b", "domain-c"]}
\`\`\`

---

## Focuses

### List focuses
\`\`\`
GET ${base}/focuses?domain_id=my-domain&page=1&limit=50
\`\`\`

### Create focus
\`\`\`
POST ${base}/focuses
Content-Type: application/json

{"id": "my-focus", "domain_id": "my-domain", "name": "My Focus", "description": "Optional"}
\`\`\`

### Get focus
\`\`\`
GET ${base}/focuses/{id}
\`\`\`

### Update focus
\`\`\`
PATCH ${base}/focuses/{id}
Content-Type: application/json

{"name": "New Name", "description": "Updated", "domain_id": "other-domain"}
\`\`\`

### Delete focus
\`\`\`
DELETE ${base}/focuses/{id}
\`\`\`

### Move focus to another domain
\`\`\`
POST ${base}/focuses/{id}/move
Content-Type: application/json

{"domain_id": "target-domain"}
\`\`\`

### Reorder focuses
\`\`\`
POST ${base}/focuses/reorder
Content-Type: application/json

{"ids": ["focus-a", "focus-b", "focus-c"]}
\`\`\`

---

## Projects

### List projects
\`\`\`
GET ${base}/projects?focus_id=my-focus&status=in_progress&milestone_id=1&page=1&limit=50
\`\`\`

### Create project
\`\`\`
POST ${base}/projects
Content-Type: application/json

{"focus_id": "my-focus", "title": "Project Title", "description": "Optional", "status": "todo", "priority": "normal", "due_date": "2025-12-31", "milestone_id": 1}
\`\`\`
Required: \`focus_id\`, \`title\`. Optional: \`description\`, \`status\` (default: todo), \`priority\`, \`due_date\`, \`milestone_id\`.

### Get project
\`\`\`
GET ${base}/projects/{id}
\`\`\`

### Update project
\`\`\`
PATCH ${base}/projects/{id}
Content-Type: application/json

{"title": "New Title", "status": "in_progress", "priority": "high", "due_date": "2025-12-31", "focus_id": "new-focus", "milestone_id": 2, "description": "Updated"}
\`\`\`

### Delete project
\`\`\`
DELETE ${base}/projects/{id}
\`\`\`

---

## Tasks

### List tasks
\`\`\`
GET ${base}/tasks?parent_project_id=1&parent_task_id=5&status=todo&page=1&limit=50
\`\`\`

### Create task (top-level under project)
\`\`\`
POST ${base}/tasks
Content-Type: application/json

{"parent_project_id": 1, "title": "Task Title", "body": "Optional details", "status": "todo", "priority": "normal", "due_date": "2025-12-31", "milestone_id": 1}
\`\`\`

### Create subtask (under another task)
\`\`\`
POST ${base}/tasks
Content-Type: application/json

{"parent_task_id": 5, "title": "Subtask Title"}
\`\`\`
Required: \`title\` + one of \`parent_project_id\` or \`parent_task_id\`. Optional: \`body\`, \`status\` (default: todo), \`priority\`, \`due_date\`, \`milestone_id\`.

### Get task
\`\`\`
GET ${base}/tasks/{id}
\`\`\`

### Update task
\`\`\`
PATCH ${base}/tasks/{id}
Content-Type: application/json

{"title": "Updated", "body": "New body", "status": "done", "priority": "high", "due_date": "2025-12-31", "milestone_id": 1}
\`\`\`

### Delete task
\`\`\`
DELETE ${base}/tasks/{id}
\`\`\`

### Move task (change parent)
\`\`\`
POST ${base}/tasks/{id}/move
Content-Type: application/json

{"parent_project_id": 2}
\`\`\`
or
\`\`\`json
{"parent_task_id": 10}
\`\`\`

### Reorder tasks
\`\`\`
POST ${base}/tasks/reorder
Content-Type: application/json

{"ids": [3, 1, 2]}
\`\`\`

---

## Milestones

### List milestones
\`\`\`
GET ${base}/milestones?page=1&limit=50
\`\`\`

### Create milestone
\`\`\`
POST ${base}/milestones
Content-Type: application/json

{"name": "v1.0 Release", "due_date": "2025-12-31", "description": "Optional"}
\`\`\`
Required: \`name\`. Optional: \`due_date\`, \`description\`.

### Get milestone
\`\`\`
GET ${base}/milestones/{id}
\`\`\`

### Update milestone
\`\`\`
PATCH ${base}/milestones/{id}
Content-Type: application/json

{"name": "v1.1", "due_date": "2026-01-15", "description": "Updated"}
\`\`\`

### Delete milestone
\`\`\`
DELETE ${base}/milestones/{id}
\`\`\`

---

## Comments

### List comments
\`\`\`
GET ${base}/comments?target_type=project&target_id=1&page=1&limit=50
\`\`\`
Required query params: \`target_type\` (\`project\` or \`task\`), \`target_id\`.

### Create comment
\`\`\`
POST ${base}/comments
Content-Type: application/json

{"target_type": "task", "target_id": 5, "body": "Comment text", "author": "agent"}
\`\`\`
Required: \`target_type\`, \`target_id\`, \`body\`, \`author\`.

### Update comment
\`\`\`
PATCH ${base}/comments/{id}
Content-Type: application/json

{"body": "Updated comment text"}
\`\`\`

### Delete comment
\`\`\`
DELETE ${base}/comments/{id}
\`\`\`

---

## Blocks (Task Dependencies)

### List blocks for a task
\`\`\`
GET ${base}/blocks?task_id=5
\`\`\`
Returns: \`{ blocking: [...], blockedBy: [...] }\`

### Create block
\`\`\`
POST ${base}/blocks
Content-Type: application/json

{"blocker_id": 3, "blocked_id": 5}
\`\`\`
Means task 3 blocks task 5 (task 5 cannot proceed until task 3 is done).

### Delete block
\`\`\`
DELETE ${base}/blocks
Content-Type: application/json

{"blocker_id": 3, "blocked_id": 5}
\`\`\`

---

## Activities

### List activities for a project
\`\`\`
GET ${base}/activities?project_id=1&page=1&limit=50
\`\`\`
Required: \`project_id\`. Read-only — activities are auto-generated by mutations.

---

## Attachments

### List attachments
\`\`\`
GET ${base}/attachments?target_type=project&target_id=1&page=1&limit=50
\`\`\`

### Create attachment
\`\`\`
POST ${base}/attachments
Content-Type: application/json

{"target_type": "task", "target_id": 5, "file_path": "/path/to/file", "file_name": "doc.pdf", "description": "Optional", "added_by": "agent"}
\`\`\`

### Delete attachment
\`\`\`
DELETE ${base}/attachments/{id}
\`\`\`

---

## Search

### Full-text search
\`\`\`
GET ${base}/search?q=search+terms&entity_type=task&project_id=1&limit=20&offset=0
\`\`\`
Required: \`q\`. Optional: \`entity_type\`, \`project_id\`, \`limit\` (default: 20), \`offset\` (default: 0).

---

## Bulk Operations

### Bulk status update
\`\`\`
POST ${base}/bulk
Content-Type: application/json

{"action": "update", "entityType": "task", "ids": [1, 2, 3], "fields": {"status": "done"}}
\`\`\`

### Bulk move tasks
\`\`\`
POST ${base}/bulk
Content-Type: application/json

{"action": "move", "ids": [1, 2, 3], "target": {"parent_project_id": 2}}
\`\`\`

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

	// 4. Generate PM-API.md
	writeFileSync(join(dir, 'PM-API.md'), generatePMApiDoc(), 'utf-8');
	filesWritten++;

	// 5. Create symlinks in agent workspaces
	symlinkToWorkspaces(dir);

	return { filesWritten, timestamp: Date.now() };
}
