import {
	lstatSync,
	mkdirSync,
	readdirSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { env } from '$env/dynamic/private';
import { generateWorkContext, generateWorkItemContext } from './context.js';
import { listWorkItems } from './crud.js';
import { getWorkDbPath } from './database.js';
import { discoverAgentWorkspaces } from './workspace-discovery.js';

export interface ContextGenerationResult {
	filesWritten: number;
	timestamp: number;
	contextDir: string;
}

export function getWorkContextDir(): string {
	const explicitContextDir =
		process.env.FALCON_DASH_WORK_CONTEXT_DIR ?? env.FALCON_DASH_WORK_CONTEXT_DIR;
	if (explicitContextDir) return explicitContextDir;

	const explicitDataDir = process.env.FALCON_DASH_DATA_DIR ?? env.FALCON_DASH_DATA_DIR;
	if (explicitDataDir) return join(explicitDataDir, 'context');

	return join(homedir(), '.openclaw', 'data', 'falcon-dash', 'context');
}

export function generateAndWriteContext(): ContextGenerationResult {
	const timestamp = Math.floor(Date.now() / 1000);
	const contextDir = getWorkContextDir();
	const projectsDir = join(contextDir, 'Work');
	let filesWritten = 0;

	mkdirSync(projectsDir, { recursive: true });

	const workContext = generateWorkContext();
	writeFileSync(join(contextDir, 'WORK.md'), workContext.markdown);
	writeFileSync(join(contextDir, 'WORK-API.md'), generateWorkApiDoc());
	writeFileSync(join(contextDir, 'FALCON-DASH.md'), generateFalconDashContext());
	filesWritten += 3;

	const activeItems = listWorkItems({ limit: 500 });
	const activeFilenames = new Set<string>();
	for (const item of activeItems) {
		const filename = `W-${item.id}.md`;
		activeFilenames.add(filename);
		writeFileSync(join(projectsDir, filename), generateWorkItemContext(item));
		filesWritten += 1;
	}

	for (const file of readdirSync(projectsDir)) {
		if (file.endsWith('.md') && !activeFilenames.has(file)) {
			rmSync(join(projectsDir, file));
		}
	}

	const skipWorkspaceSymlinks =
		process.env.FALCON_DASH_WORK_SKIP_WORKSPACE_SYMLINKS ??
		env.FALCON_DASH_WORK_SKIP_WORKSPACE_SYMLINKS;
	if (!skipWorkspaceSymlinks) {
		for (const workspace of discoverAgentWorkspaces()) {
			ensureSymlink(join(workspace.workspace, 'WORK.md'), join(contextDir, 'WORK.md'));
			ensureSymlink(join(workspace.workspace, 'WORK-API.md'), join(contextDir, 'WORK-API.md'));
			ensureSymlink(
				join(workspace.workspace, 'FALCON-DASH.md'),
				join(contextDir, 'FALCON-DASH.md')
			);
			ensureSymlink(join(workspace.workspace, 'Work'), projectsDir);
		}
	}

	return { filesWritten, timestamp, contextDir };
}

function ensureSymlink(linkPath: string, targetPath: string): void {
	mkdirSync(dirname(linkPath), { recursive: true });
	try {
		try {
			lstatSync(linkPath);
			unlinkSync(linkPath);
		} catch {
			// Missing path, including broken symlink target, is fine.
		}
		symlinkSync(targetPath, linkPath);
	} catch (err) {
		console.error(`[work-context] Failed to symlink ${linkPath}:`, err);
	}
}

function generateFalconDashContext(): string {
	return `# Falcon Dash

Falcon Dash is the OpenClaw operator dashboard plugin. The active work system is the Work module.

## Source of Truth

- Work database: ${getWorkDbPath()}
- Context: ${getWorkContextDir()}
- Primary queue: WORK.md
- API reference: WORK-API.md

Archived PM data is not part of the active Falcon Dash contract. If an old source database exists on disk, treat it only as migration source material.
`;
}

function generateWorkApiDoc(): string {
	return `# Falcon Dash Work API

Base URL: http://localhost:3000/api/work

## Items

- GET /items
- GET /items?type=change_request&status=in_progress
- POST /items
- GET /items/{id}
- PATCH /items/{id}

Item types: project, milestone, next_step, open_question, decision, change_request, finding, automation.

Categories and subcategories are setup records exposed through /categories, not Work item types.
Deleting a category or subcategory removes it from the directory and unassigns linked Work items.

Item filters include type, status, category_id, subcategory_id, parent_item_id, includeClosed, and limit.

Statuses: backlog, planning, ready, in_progress, waiting, needs_review, blocked, scheduled, complete, cancelled, archived.

## Categories

- GET /categories
- POST /categories
- GET /categories/{id}
- PATCH /categories/{id}
- DELETE /categories/{id}

## Queue

- GET /queue

Returns nextActions, needsOperator, waitingOnOperator, waitingOnAgent, waitingOnExternal, needsReview, failedAutomations, scheduledAutomations, staleCleanup, and blockedRisky buckets.

## Change Log

- GET /change-log
- GET /change-log?project_id={id}
- GET /change-log?entity_type=next_step&entity_id={id}

Returns Work mutation events with the changed entity, project/category/parent scope at the time of the event, a human summary, and structured field deltas in changes.

## Context

- GET /context

Returns the generated Work markdown plus queue stats.

## Migration

- GET /migration/preview
- POST /migration/apply

Migration reads the old PM database as an external, read-only source and writes to the new Work database. The old PM database remains untouched on disk.
`;
}
