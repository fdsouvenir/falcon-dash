import { listWorkQueue, listWorkItems } from './crud.js';
import type { WorkContextResponse, WorkItem } from './types.js';

export function generateWorkContext(): WorkContextResponse {
	const generated_at = Math.floor(Date.now() / 1000);
	const queue = listWorkQueue();
	const active = listWorkItems({ limit: 500 });
	const counts = countByType(active);

	let markdown = '# Work Queue\n\n';
	markdown += `> Generated: ${new Date(generated_at * 1000).toISOString()}\n\n`;
	markdown +=
		'Falcon Dash Work is the agent-facing source of truth. Archived source IDs are evidence, not active API guidance.\n\n';

	markdown += renderBucket('Next Actions', queue.nextActions);
	markdown += renderBucket('Waiting on Fred', queue.waitingOnFred);
	markdown += renderBucket('Waiting on Agent', queue.waitingOnAgent);
	markdown += renderBucket('Needs Review', queue.needsReview);
	markdown += renderBucket('Scheduled / Routines', queue.scheduledRoutines);
	markdown += renderBucket('Blocked / Risky', queue.blockedRisky);

	if (active.length === 0) markdown += 'No active Work items.\n';

	return {
		markdown,
		generated_at,
		stats: {
			active: active.length,
			...counts,
			nextActions: queue.nextActions.length,
			waitingOnFred: queue.waitingOnFred.length,
			waitingOnAgent: queue.waitingOnAgent.length,
			needsReview: queue.needsReview.length,
			scheduledRoutines: queue.scheduledRoutines.length,
			blockedRisky: queue.blockedRisky.length
		},
		queue
	};
}

export function generateWorkItemContext(item: WorkItem): string {
	let markdown = `# W-${item.id}: ${item.title}\n\n`;
	markdown += `**Type:** ${item.type} | **Status:** ${item.status} | **Priority:** ${item.priority ?? 'normal'}\n`;
	if (item.owner || item.waiting_on) {
		markdown += `**Owner:** ${item.owner ?? '-'} | **Waiting on:** ${item.waiting_on ?? '-'}\n`;
	}
	if (item.next_action) markdown += `**Next action:** ${item.next_action}\n`;
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
