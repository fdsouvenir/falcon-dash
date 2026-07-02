import { listWorkQueue, listWorkItems } from './crud.js';
import type { WorkContextResponse, WorkItem } from './types.js';

export interface WorkContextOptions {
	publicOrigin?: string | null;
}

export function generateWorkContext(): WorkContextResponse {
	const generated_at = Math.floor(Date.now() / 1000);
	const queue = listWorkQueue();
	const active = listWorkItems({ limit: 500 });
	const counts = countByType(active);

	let markdown = '# Work Queue\n\n';
	markdown += `> Generated: ${new Date(generated_at * 1000).toISOString()}\n\n`;
	markdown +=
		'Falcon Dash Work is the agent-facing source of truth. Use Work nouns: Project, project-local Milestone, Task, Needs Resolution, Change Request, Finding, and Automation. “Next up” is a project pointer to the current actionable item, not a standalone work type.\n\n';

	markdown += renderCaptureSummary(counts);

	markdown += renderBucket('Next Actions', queue.nextActions);
	markdown += renderBucket('Needs Resolution', queue.needsOperator);
	markdown += renderBucket('Waiting on Agent', queue.waitingOnAgent);
	markdown += renderBucket('Waiting on External / System', queue.waitingOnExternal);
	markdown += renderBucket('Change Requests Needing Review', queue.needsReview);
	markdown += renderBucket('Failed / Paused Automations', queue.failedAutomations);
	markdown += renderBucket('Scheduled Automations', queue.scheduledAutomations);
	markdown += renderBucket('Blocked / Risky', queue.blockedRisky);

	if (active.length === 0) markdown += 'No active Work items.\n';

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
	let markdown = `# W-${item.id}: ${item.title}\n\n`;
	markdown += `**Type:** ${item.type} | **Status:** ${item.status} | **Priority:** ${item.priority ?? 'normal'}\n`;
	const publicUrl = workItemPublicUrl(item, options.publicOrigin);
	if (publicUrl) markdown += `**Public URL:** ${publicUrl}\n`;
	if (item.owner || item.waiting_on) {
		markdown += `**Owner:** ${item.owner ?? '-'} | **Waiting on:** ${item.waiting_on ?? '-'}\n`;
	}
	if (item.next_action) markdown += `**Next action:** ${item.next_action}\n`;
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
	if (item.due_date) markdown += `**Due:** ${item.due_date}\n`;
	if (item.approval_required) markdown += `**Approval required:** yes\n`;
	if (item.legacy_project_id || item.legacy_plan_id) {
		markdown += `**Legacy refs:** ${[
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

function renderBucket(title: string, items: WorkItem[]): string {
	if (items.length === 0) return '';
	let markdown = `## ${title} (${items.length})\n\n`;
	for (const item of items.slice(0, 30)) {
		const waiting = item.waiting_on ? `, waiting on ${item.waiting_on}` : '';
		markdown += `- W-${item.id} [${item.type}/${item.status}${waiting}] ${item.title}\n`;
		if (item.next_action) markdown += `  Next: ${item.next_action}\n`;
	}
	return `${markdown}\n`;
}

function countByType(items: WorkItem[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;
	return counts;
}
