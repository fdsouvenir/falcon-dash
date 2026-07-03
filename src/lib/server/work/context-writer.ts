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

## Agent Interface

- Start with WORK.md for a compact current-state home view.
- Open Work/W-<id>.md only when the queue row is not enough.
- Use WORK-API.md for mutation templates and filter options.
- Human/operator-facing references should be type plus ID, such as Change 176 or Project 4. The W- prefix is only a context filename convention.
`;
}

function generateWorkApiDoc(): string {
	return `# Falcon Dash Work API

Base URL: http://localhost:3000/api/work

This API backs the generated context files. Prefer WORK.md for the first read, then use the API
when you need fresh data, filtered lists, or mutations.

## Agent-Ergonomic Contract

- List responses should be filtered and capped with limit instead of hydrating everything by default.
- Empty results are valid; the generated context renders them as "0 results" so agents do not treat silence as failure.
- Long inline queue text may be truncated in WORK.md; use Work/W-<id>.md or GET /items/{id} for full content.
- Mutations should be idempotent from the agent's point of view: PATCH the intended final state and include actor.
- Unknown fields are not part of the contract. Prefer the templates below over inventing request shapes.

## Items

- GET /items
- GET /items?type=change&status=in_progress
- GET /items?type=task&status=ready&limit=50
- POST /items
- GET /items/{id}
- PATCH /items/{id}
- GET /items/{id}/relationships
- POST /items/{id}/relationships
- DELETE /items/{id}/relationships
- GET /items/{id}/reconciliation
- POST /items/{id}/session
- POST /reconcile

Item types: area, project, task, decision, routine, observation, change.

Statuses: backlog, planning, ready, in_progress, waiting, needs_review, blocked, scheduled, complete, cancelled, archived.

Create an approval-gated Change:

\`\`\`bash
curl -X POST http://localhost:3000/api/work/items \\
  -H "Content-Type: application/json" \\
  -d '{"type":"change","title":"<title>","status":"planning","owner":"agent","waiting_on":"operator","approval_required":true,"description":"<spec>"}'
\`\`\`

Mark an approved item in progress:

\`\`\`bash
curl -X PATCH http://localhost:3000/api/work/items/<id> \\
  -H "Content-Type: application/json" \\
  -d '{"status":"in_progress","waiting_on":"agent","actor":"agent"}'
\`\`\`

Complete an item with a result summary:

\`\`\`bash
curl -X PATCH http://localhost:3000/api/work/items/<id> \\
  -H "Content-Type: application/json" \\
  -d '{"status":"complete","result":"<summary>","waiting_on":null,"actor":"agent"}'
\`\`\`

## Relationships

Use relationships for graph-safe reconciliation:

- depends_on: from_item_id waits for to_item_id
- blocks: from_item_id blocks to_item_id
- relates_to: contextual relationship
- derived_from: provenance relationship

Create a relationship:

\`\`\`bash
curl -X POST http://localhost:3000/api/work/items/<id>/relationships \\
  -H "Content-Type: application/json" \\
  -d '{"to_item_id":123,"relation_type":"depends_on"}'
\`\`\`

## Reconciliation

- POST /reconcile
- GET /items/{id}/reconciliation
- POST /items/{id}/session

Falcon Dash reconciles Work after mutations. Deterministic reconciliation uses relationships and
parent/child state to clear stale blockers, complete satisfied decisions, and update project
next_action. Ambiguous state opens a contextual agent session when the gateway is available.

## Queue

- GET /queue

Returns nextActions, needsOperator, waitingOnOperator, waitingOnAgent, waitingOnExternal, needsReview, scheduledRoutines, staleCleanup, and blockedRisky buckets. The legacy waitingOnFred alias is still returned for older callers.

## Context

- GET /context

Returns the generated Work markdown plus queue stats.

Context files:

- WORK.md — compact source-of-truth home view with counts, queues, empty states, and next commands.
- Work/W-<id>.md — full item detail for active Work items.
- WORK-API.md — this reference.

## Migration

- GET /migration/preview
- POST /migration/apply

Migration reads the old PM database as an external, read-only source and writes to the new Work database. The old PM database remains untouched on disk.
`;
}
