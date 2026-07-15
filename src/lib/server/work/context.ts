import { listWorkQueue, listWorkItems } from './crud.js';
import type { WorkContextResponse, WorkItem } from './types.js';

const BUCKET_LIMIT = 20;
const INLINE_TEXT_LIMIT = 220;

export interface WorkContextOptions {
	publicOrigin?: string | null;
}

export function generateWorkContext(): WorkContextResponse {
	const generated_at = Math.floor(Date.now() / 1000);
	const queue = listWorkQueue();
	const active = listWorkItems({ limit: 500 });
	const counts = countByType(active);

	let markdown = '# Work Queue\n\n';
	markdown += `generated_at: ${new Date(generated_at * 1000).toISOString()}\n`;
	markdown += `source: Falcon Dash Work database\n`;
	markdown += `context_dir_hint: see FALCON-DASH.md for the generated context directory\n\n`;
	markdown +=
		'Falcon Dash Work is the agent-facing source of truth. Use Work nouns: Project, project-local Milestone, Task, Needs Resolution, Change Request, Finding, and Automation. “Next up” is a project pointer to the current actionable item, not a standalone work type.\n\n';

	markdown += renderCaptureSummary(counts);
	markdown += '## Summary\n\n';
	markdown += `active: ${active.length}\n`;
	markdown += `types: ${formatCounts(counts)}\n`;
	markdown += `queue: nextActions=${queue.nextActions.length}, needsOperator=${queue.needsOperator.length}, waitingOnAgent=${queue.waitingOnAgent.length}, waitingOnExternal=${queue.waitingOnExternal.length}, needsReview=${queue.needsReview.length}, failedAutomations=${queue.failedAutomations.length}, scheduledAutomations=${queue.scheduledAutomations.length}, blockedRisky=${queue.blockedRisky.length}\n\n`;

	markdown += renderBucket(
		'Next Actions',
		queue.nextActions,
		'Pick ready/in-progress Tasks or Change Requests that are waiting for agent execution.'
	);
	markdown += renderBucket(
		'Needs Resolution',
		queue.needsOperator,
		'Ask the operator for the smallest concrete decision, approval, or missing input.'
	);
	markdown += renderBucket(
		'Waiting on Agent',
		queue.waitingOnAgent,
		'Resume, update, or close Work that expects agent follow-through.'
	);
	markdown += renderBucket(
		'Waiting on External / System',
		queue.waitingOnExternal,
		'Check whether external/system blockers changed before moving the item.'
	);
	markdown += renderBucket(
		'Needs Review',
		queue.needsReview,
		'Present results and ask for review or acceptance.'
	);
	markdown += renderBucket(
		'Failed / Paused Automations',
		queue.failedAutomations,
		'Review failed or paused automations and record the next recovery action.'
	);
	markdown += renderBucket(
		'Scheduled Automations',
		queue.scheduledAutomations,
		'Check due automation work and record meaningful outcomes.'
	);
	markdown += renderBucket(
		'Blocked / Risky',
		queue.blockedRisky,
		'Surface urgent blockers, risk, and the next unblocking ask.'
	);

	if (active.length === 0) {
		markdown += '## Active Work\n\n0 results. No active Work items are available.\n\n';
	}

	markdown += renderGlobalHelp();

	return {
		markdown,
		generated_at,
		stats: {
			active: active.length,
			...counts,
			nextActions: queue.nextActions.length,
			needsOperator: queue.needsOperator.length,
			waitingOnOperator: queue.waitingOnOperator.length,
			waitingOnAgent: queue.waitingOnAgent.length,
			waitingOnExternal: queue.waitingOnExternal.length,
			needsReview: queue.needsReview.length,
			failedAutomations: queue.failedAutomations.length,
			scheduledAutomations: queue.scheduledAutomations.length,
			blockedRisky: queue.blockedRisky.length
		},
		queue
	};
}

export function generateWorkItemContext(item: WorkItem, options: WorkContextOptions = {}): string {
	let markdown = `# ${workRef(item)}: ${item.title}\n\n`;
	markdown += `context_file: Work/W-${item.id}.md\n`;
	markdown += `id: ${item.id}\n`;
	markdown += `type: ${item.type}\n`;
	markdown += `status: ${item.status}\n`;
	markdown += `priority: ${item.priority ?? 'normal'}\n`;
	const publicUrl = workItemPublicUrl(item, options.publicOrigin);
	if (publicUrl) markdown += `**Public URL:** ${publicUrl}\n`;
	if (item.owner || item.waiting_on) {
		markdown += `owner: ${item.owner ?? '-'}\n`;
		markdown += `waiting_on: ${item.waiting_on ?? '-'}\n`;
	}
	if (item.next_action) markdown += `next_action: ${item.next_action}\n`;
	if (item.type === 'project') {
		if (item.goal) markdown += `**Goal:** ${item.goal}\n`;
		if (item.definition_of_done) markdown += `**Definition of done:** ${item.definition_of_done}\n`;
		if (item.health) markdown += `**Health:** ${item.health}\n`;
	}
	if (item.type === 'open_question') {
		markdown += `**Question:** ${item.question_text ?? item.title}\n`;
		if (item.why_it_matters) markdown += `**Why it matters:** ${item.why_it_matters}\n`;
		if (item.answerer) markdown += `**Can answer:** ${item.answerer}\n`;
	}
	if (item.type === 'decision') {
		markdown += `**Decision question:** ${item.decision_question ?? item.title}\n`;
		if (item.options?.length) markdown += `**Options:** ${item.options.join(' | ')}\n`;
		if (item.recommended_option) markdown += `**Recommendation:** ${item.recommended_option}\n`;
		if (item.consequence_of_no_decision) {
			markdown += `**No decision consequence:** ${item.consequence_of_no_decision}\n`;
		}
	}
	if (item.type === 'change_request') {
		if (item.change_scope) markdown += `**Scope:** ${item.change_scope}\n`;
		if (item.risk) markdown += `**Risk:** ${item.risk}\n`;
		if (item.verification_plan) markdown += `**Verification:** ${item.verification_plan}\n`;
	}
	if (item.type === 'automation') {
		if (item.trigger_type) markdown += `**Trigger:** ${item.trigger_type}\n`;
		if (item.schedule) markdown += `**Schedule:** ${item.schedule}\n`;
		markdown += `**Enabled:** ${item.enabled === 0 ? 'no' : 'yes'}\n`;
	}
	if (item.due_date) markdown += `due: ${item.due_date}\n`;
	if (item.approval_required) markdown += `approval_required: yes\n`;
	if (item.legacy_project_id || item.legacy_plan_id) {
		markdown += `legacy_refs: ${[
			item.legacy_project_id ? `P-${item.legacy_project_id}` : null,
			item.legacy_plan_id ? `Plan ${item.legacy_plan_id}` : null
		]
			.filter(Boolean)
			.join(', ')}\n`;
	}
	if (item.description) {
		if (item.legacy_project_id || item.legacy_plan_id) {
			markdown += `\n## Migrated Historical Description\n\n`;
			markdown +=
				'> Preserved source material from the archived PM database. Current Falcon Dash behavior is defined by WORK.md, WORK-API.md, and FALCON-DASH.md.\n\n';
			markdown += `${item.description}\n`;
		} else {
			markdown += `\n${item.description}\n`;
		}
	} else if (!item.body) {
		markdown += '\n## Description\n\n0 results. No description or body recorded yet.\n';
	}
	if (item.body && item.body !== item.description) {
		const title =
			item.legacy_project_id || item.legacy_plan_id ? 'Migrated Historical Body' : 'Body';
		markdown += `\n## ${title}\n\n`;
		if (title !== 'Body') {
			markdown +=
				'> This section is preserved source material from the archived PM database. Do not treat old route names, compatibility notes, or execution instructions here as current Falcon Dash behavior.\n\n';
		}
		markdown += `${item.body}\n`;
	}
	if (item.result) markdown += `\n## Result\n\n${item.result}\n`;
	markdown += renderItemHelp(item);
	return markdown;
}

export function workItemPublicUrl(item: WorkItem, publicOrigin?: string | null): string | null {
	if (!publicOrigin) return null;
	const route = workItemRoute(item);
	return route ? `${publicOrigin}${route}` : null;
}

function workItemRoute(item: WorkItem): string | null {
	if (item.type === 'milestone') {
		return item.parent_item_id ? `/work/projects/${item.parent_item_id}` : null;
	}
	return `/work/${pathForType(item.type)}/${item.id}`;
}

function pathForType(type: WorkItem['type']): string {
	if (type === 'project') return 'projects';
	if (type === 'task') return 'tasks';
	if (type === 'open_question' || type === 'decision') return 'needs-resolution';
	if (type === 'change_request') return 'change-requests';
	if (type === 'finding') return 'findings';
	if (type === 'automation') return 'automations';
	return 'projects';
}

function renderCaptureSummary(counts: Record<string, number>): string {
	const parts = [
		countPart(counts.project, 'Project'),
		countPart(counts.milestone, 'Milestone'),
		countPart(counts.task, 'Task'),
		countPart((counts.open_question ?? 0) + (counts.decision ?? 0), 'Resolution'),
		countPart(counts.change_request, 'Change Request'),
		countPart(counts.finding, 'Finding'),
		countPart(counts.automation, 'Automation')
	].filter(Boolean);
	if (parts.length === 0) return '';
	return `Captured ${parts.join(', ')}.\n\n`;
}

function countPart(count: number | undefined, singular: string): string | null {
	if (!count) return null;
	return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function renderBucket(title: string, items: WorkItem[], guidance: string): string {
	let markdown = `## ${title} (${items.length})\n\n`;
	markdown += `${guidance}\n\n`;
	if (items.length === 0) return `${markdown}0 results.\n\n`;

	for (const item of items.slice(0, BUCKET_LIMIT)) {
		const waiting = item.waiting_on ? `, waiting on ${item.waiting_on}` : '';
		const due = item.due_date ? `, due ${item.due_date}` : '';
		markdown += `- ${workRef(item)} [${item.status}, ${item.priority ?? 'normal'}${waiting}${due}] ${item.title} (detail: Work/W-${item.id}.md)\n`;
		if (item.next_action) markdown += `  Next: ${truncateInline(item.next_action)}\n`;
		if (item.approval_required) markdown += '  Approval required: yes\n';
	}
	if (items.length > BUCKET_LIMIT) {
		markdown += `- (${items.length - BUCKET_LIMIT} more omitted; use \`curl "http://localhost:3000/api/work/items?limit=500"\` for the full list.)\n`;
	}
	return `${markdown}\n`;
}

function countByType(items: WorkItem[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;
	return counts;
}

function workRef(item: WorkItem): string {
	return `${typeLabel(item.type)} ${item.id}`;
}

function typeLabel(type: WorkItem['type']): string {
	if (type === 'open_question') return 'Open Question';
	if (type === 'change_request') return 'Change Request';
	return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

function truncateInline(value: string): string {
	if (value.length <= INLINE_TEXT_LIMIT) return value;
	return `${value.slice(0, INLINE_TEXT_LIMIT).trimEnd()}... (truncated, ${
		value.length
	} chars total; open detail file or GET /api/work/items/{id} for full text)`;
}

function formatCounts(counts: Record<string, number>): string {
	const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
	if (entries.length === 0) return '0 results';
	return entries.map(([type, count]) => `${type}=${count}`).join(', ');
}

function renderGlobalHelp(): string {
	return `## Help

- Read API reference: WORK-API.md
- Open item detail: Work/W-<id>.md
- List active items: \`curl "http://localhost:3000/api/work/items?limit=100"\`
- Create approved Change Request spec: \`curl -X POST http://localhost:3000/api/work/items -H "Content-Type: application/json" -d '{"type":"change_request","title":"<title>","status":"planning","owner":"agent","waiting_on":"operator","approval_required":true,"change_scope":"<scope>","risk":"<risk>","verification_plan":"<plan>"}'\`
- Update item status: \`curl -X PATCH http://localhost:3000/api/work/items/<id> -H "Content-Type: application/json" -d '{"status":"in_progress","waiting_on":"agent","actor":"agent"}'\`

`;
}

function renderItemHelp(item: WorkItem): string {
	const readyHelp =
		item.type === 'change_request' && item.status === 'planning'
			? `- Mark approved Change Request ready after operator approval: \`curl -X PATCH http://localhost:3000/api/work/items/${item.id} -H "Content-Type: application/json" -d '{"status":"ready","waiting_on":"agent","actor":"agent"}'\`\n`
			: '';
	return `
## Help

- Refresh this item: \`curl http://localhost:3000/api/work/items/${item.id}\`
- Update progress: \`curl -X PATCH http://localhost:3000/api/work/items/${item.id} -H "Content-Type: application/json" -d '{"status":"in_progress","waiting_on":"agent","actor":"agent"}'\`
${readyHelp}- Complete with result: \`curl -X PATCH http://localhost:3000/api/work/items/${item.id} -H "Content-Type: application/json" -d '{"status":"complete","result":"<summary>","waiting_on":null,"actor":"agent"}'\`
`;
}
