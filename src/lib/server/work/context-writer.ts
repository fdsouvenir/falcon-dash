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
	const publicOrigin = getPublicDashboardOrigin();
	let filesWritten = 0;

	mkdirSync(projectsDir, { recursive: true });

	const workContext = generateWorkContext();
	writeFileSync(join(contextDir, 'WORK.md'), workContext.markdown);
	writeFileSync(join(contextDir, 'WORK-API.md'), generateWorkApiDoc(publicOrigin));
	writeFileSync(join(contextDir, 'FALCON-DASH.md'), generateFalconDashContext(publicOrigin));
	filesWritten += 3;

	const activeItems = listWorkItems({ limit: 500 });
	const activeFilenames = new Set<string>();
	for (const item of activeItems) {
		const filename = `W-${item.id}.md`;
		activeFilenames.add(filename);
		writeFileSync(join(projectsDir, filename), generateWorkItemContext(item, { publicOrigin }));
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

export function getPublicDashboardOrigin(): string | null {
	const rawOrigin = (process.env.ORIGIN ?? env.ORIGIN)?.trim();
	if (!rawOrigin) return null;
	const normalized = rawOrigin.replace(/\/+$/, '');
	try {
		const url = new URL(normalized);
		if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
			return null;
		}
		return `${url.protocol}//${url.host}`;
	} catch {
		return null;
	}
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

export function generateFalconDashContext(publicOrigin = getPublicDashboardOrigin()): string {
	const publicOriginLine = publicOrigin ? `- Public dashboard URL: ${publicOrigin}\n` : '';
	return `# Falcon Dash

Falcon Dash is the OpenClaw operator dashboard plugin. The active work system is the Work module.

## Source of Truth

- Work database: ${getWorkDbPath()}
- Context: ${getWorkContextDir()}
- Primary queue: WORK.md
- API reference: WORK-API.md
${publicOriginLine}
## Operator References

${objectLinkGuidance(publicOrigin)}

Archived PM data is not part of the active Falcon Dash contract. If an old source database exists on disk, treat it only as migration source material.

## Agent Interface

- Start with WORK.md for a compact current-state home view.
- Open Work/W-<id>.md only when the queue row is not enough.
- Use WORK-API.md for mutation templates and filter options.
- Human/operator-facing references should be type plus ID, such as Change 176 or Project 4. The W- prefix is only a context filename convention.
`;
}

export function generateWorkApiDoc(publicOrigin = getPublicDashboardOrigin()): string {
	const publicBaseUrl = publicOrigin ? `${publicOrigin}/api/work` : '/api/work';
	return `# Falcon Dash Work API

Base URL: ${publicBaseUrl}

## Operator References

${objectLinkGuidance(publicOrigin)}

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
- GET /items?type=change_request&status=in_progress
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

Item types: project, milestone, task, open_question, decision, change_request, finding, automation.

Use "Needs Resolution" in operator-facing conversation and UI. The API currently stores Needs
Resolution records as variants: open_question for missing knowledge, or decision for a commitment,
approval, or choice with options.

Projects expose their current "Next up" item through current_next_item_id. It points at an active
task, Needs Resolution variant, or change request inside the project. next_step is not a public
Work type.

Categories and subcategories are setup records exposed through /categories, not Work item types.
Deleting a category or subcategory removes it from the directory and unassigns linked Work items.

Item filters include type, status, category_id, subcategory_id, parent_item_id, includeClosed, and limit.

Statuses: backlog, planning, ready, in_progress, waiting, needs_review, blocked, scheduled, complete, cancelled, archived.

Create an approval-gated Change Request:

\`\`\`bash
curl -X POST ${publicBaseUrl}/items \\
  -H "Content-Type: application/json" \\
  -d '{"type":"change_request","title":"<title>","status":"planning","owner":"agent","waiting_on":"operator","approval_required":true,"change_scope":"<scope>","risk":"<risk>","verification_plan":"<plan>"}'
\`\`\`

Mark an approved item in progress:

\`\`\`bash
curl -X PATCH ${publicBaseUrl}/items/<id> \\
  -H "Content-Type: application/json" \\
  -d '{"status":"in_progress","waiting_on":"agent","actor":"agent"}'
\`\`\`

Complete an item with a result summary:

\`\`\`bash
curl -X PATCH ${publicBaseUrl}/items/<id> \\
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
curl -X POST ${publicBaseUrl}/items/<id>/relationships \\
  -H "Content-Type: application/json" \\
  -d '{"to_item_id":123,"relation_type":"depends_on"}'
\`\`\`

## Reconciliation

- POST /reconcile
- GET /items/{id}/reconciliation
- POST /items/{id}/session

Falcon Dash reconciles Work after mutations. Deterministic reconciliation uses relationships and
parent/child state only for explicit mechanical consequences, such as clearing downstream
blocked/waiting state when all structured blockers are closed. Semantic cleanup is agent-owned:
decisions, evidence interpretation, project next_action, and narrative summaries.

When stale-risk remains, Falcon Dash opens or reuses a contextual agent session. The reconciliation
packet is AXI-style: content first, minimal fields, precomputed counts, explicit "0 results" empty
states, truncated long text, evidence refs, recent activity, stale-risk candidates, mechanical
changes, and concrete /api/work/* next-command templates.

Agent role during reconciliation:

- You are the Work steward for the project. Keep Work coherent, current, and operator-useful.
- Use deterministic mechanical facts as hints, not as a substitute for judgment.
- If Work state needs to change, call /api/work/*. Do not only explain what should happen.
- Close or update stale blockers, decisions, and next actions only when context and evidence support it.
- Include a concise result or next_action when changing Work.
- When uncertain, leave the item open, record what is missing, and set the appropriate waiting state.
- Prefer structured relationships over prose.
- Keep operator-facing output short: what changed, what is blocked, and the next real move.

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
- GET /change-log?entity_type=task&entity_id={id}

Returns Work mutation events with the changed entity, project/category/parent scope at the time of the event, a human summary, and structured field deltas in changes.

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

function objectLinkGuidance(publicOrigin: string | null): string {
	if (!publicOrigin) {
		return 'No public dashboard URL is configured. In operator-facing messages, use plain object references such as `Project 4`, `Task 12`, or `Needs Resolution 9`; do not use localhost, 127.0.0.1, or relative paths.\n';
	}
	return `Use inline Markdown links for specific Falcon Dash objects in operator-facing messages. Examples: [Project 4](${publicOrigin}/work/projects/4), [Task 12](${publicOrigin}/work/tasks/12), [Needs Resolution 9](${publicOrigin}/work/needs-resolution/9), [Change Request 176](${publicOrigin}/work/change-requests/176), [Finding 22](${publicOrigin}/work/findings/22), and [Automation 31](${publicOrigin}/work/automations/31). Milestones link to their parent project; categories and subcategories link to ${publicOrigin}/work/settings. Do not use localhost, 127.0.0.1, or relative paths for operator-facing object references.\n`;
}
