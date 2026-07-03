import { randomBytes } from 'node:crypto';
import { getGatewayClient } from '../gateway-client.js';
import {
	createWorkRelationship,
	getWorkItem,
	listWorkItems,
	listWorkRelationshipsForItems,
	updateWorkItem
} from './crud.js';
import { getWorkDb } from './database.js';
import type {
	WorkItem,
	WorkReconciliationRun,
	WorkReconciliationRunView,
	WorkReconciliationStatus,
	WorkRelationship,
	WorkRelationType
} from './types.js';

const RECONCILER_ACTOR = 'work-reconciler';
const openStatuses = new Set([
	'backlog',
	'planning',
	'ready',
	'in_progress',
	'waiting',
	'needs_review',
	'blocked',
	'scheduled'
]);
const closedStatuses = new Set(['complete', 'cancelled', 'archived']);

type ReconcileOptions = {
	forceAgent?: boolean;
	triggerEntity?: string;
	triggerId?: string | number;
};

type ReconcileResult = {
	run: WorkReconciliationRunView;
	root: WorkItem;
};

type SessionMode = 'ask' | 'reconcile';

type ContextualSessionResult = {
	sessionKey: string;
	workItemId: number;
	mode: SessionMode;
};

export { RECONCILER_ACTOR };

export async function reconcileWorkItem(
	itemId: number,
	options: ReconcileOptions = {}
): Promise<ReconcileResult> {
	const root = rootItemFor(itemId);
	const run = createReconciliationRun({
		root_item_id: root.id,
		trigger_entity: options.triggerEntity ?? 'item',
		trigger_id: String(options.triggerId ?? itemId),
		status: 'running'
	});

	const related = relatedWorkForRoot(root);
	const relationships = listWorkRelationshipsForItems(related.map((item) => item.id));
	const changes: string[] = [];
	const ambiguities: string[] = [];

	if (options.forceAgent) {
		ambiguities.push('Manual reconciliation requested agent review.');
	} else {
		changes.push(...resolveGraphCascades(related, relationships));
		changes.push(...closeSatisfiedDecisions(related, relationships));
		changes.push(...updateProjectNextMove(root.id));
		ambiguities.push(...findAmbiguities(root, related, relationships, itemId));
	}

	let status: WorkReconciliationStatus =
		ambiguities.length > 0 ? 'needs_agent' : changes.length > 0 ? 'applied' : 'no_action';
	let sessionKey: string | null = null;

	if (ambiguities.length > 0) {
		try {
			const session = await createContextualAgentSession(root.id, {
				mode: 'reconcile',
				message: buildReconciliationPrompt(root, related, relationships, ambiguities)
			});
			sessionKey = session.sessionKey;
			status = 'agent_running';
		} catch (err) {
			ambiguities.push(
				`Agent session could not be started: ${err instanceof Error ? err.message : String(err)}`
			);
			status = 'needs_agent';
		}
	}

	return {
		root,
		run: updateReconciliationRun(run.id, {
			status,
			deterministic_changes: changes,
			ambiguities,
			session_key: sessionKey
		})
	};
}

export async function createContextualAgentSession(
	workItemId: number,
	options: { mode: SessionMode; message?: string }
): Promise<ContextualSessionResult> {
	const item = getWorkItem(workItemId);
	if (!item) throw new Error(`Work item ${workItemId} not found`);
	const root = rootItemFor(workItemId);
	const related = relatedWorkForRoot(root);
	const sessionKey = createSessionKey();
	const label = `${capitalize(root.type)} ${root.id} · ${
		options.mode === 'reconcile' ? 'Reconcile Work' : 'Ask Agent'
	}`;
	const prompt =
		options.message?.trim() ||
		buildAskPrompt(item, root, related, options.mode === 'reconcile' ? 'reconcile' : 'ask');
	const client = getGatewayClient();
	if (client.state !== 'ready') throw new Error(`Gateway ${client.state}`);

	await client.call('sessions.patch', { key: sessionKey, label });
	await client.call('chat.send', {
		sessionKey,
		message: prompt
	});

	logContextualSession(root.id, workItemId, sessionKey, options.mode, prompt);
	return { sessionKey, workItemId, mode: options.mode };
}

export function listReconciliationRunsForItem(itemId: number): WorkReconciliationRunView[] {
	const root = rootItemFor(itemId);
	const db = getWorkDb();
	const rows = db
		.prepare(
			`SELECT * FROM work_reconciliation_runs
			 WHERE root_item_id = ?
			 ORDER BY created_at DESC, id DESC
			 LIMIT 25`
		)
		.all(root.id) as WorkReconciliationRun[];
	return rows.map(runView);
}

export function findReusableReconciliationRun(
	rootItemId: number
): WorkReconciliationRunView | null {
	const db = getWorkDb();
	const row = db
		.prepare(
			`SELECT * FROM work_reconciliation_runs
			 WHERE root_item_id = ?
			   AND status IN ('queued','running','needs_agent','agent_running')
			 ORDER BY created_at DESC, id DESC
			 LIMIT 1`
		)
		.get(rootItemId) as WorkReconciliationRun | undefined;
	return row ? runView(row) : null;
}

export function ensureRelationship(data: {
	from_item_id: number;
	to_item_id: number;
	relation_type: WorkRelationType;
	actor?: string;
}): WorkRelationship {
	return createWorkRelationship(data);
}

function resolveGraphCascades(items: WorkItem[], relationships: WorkRelationship[]): string[] {
	const changes: string[] = [];
	const byId = mapItems(items);
	for (const item of items) {
		if (!['blocked', 'waiting'].includes(item.status)) continue;
		const blockers = requiredOpenBlockers(item.id, relationships, byId);
		if (blockers.length > 0) continue;
		const nextStatus =
			item.type === 'decision' ? 'needs_review' : item.type === 'routine' ? 'scheduled' : 'ready';
		updateWorkItem(item.id, {
			status: nextStatus,
			waiting_on: null,
			result: appendResult(item.result, 'Work reconciler cleared stale blocker/dependency state.'),
			actor: RECONCILER_ACTOR
		});
		changes.push(`${label(item)} advanced from ${item.status} to ${nextStatus}.`);
	}
	return changes;
}

function closeSatisfiedDecisions(items: WorkItem[], relationships: WorkRelationship[]): string[] {
	const changes: string[] = [];
	const byId = mapItems(items);
	for (const decision of items.filter(
		(item) => item.type === 'decision' && openStatuses.has(item.status)
	)) {
		const gated = gatedItemsForDecision(decision.id, relationships, byId);
		if (gated.length === 0) continue;
		if (gated.every((item) => closedStatuses.has(item.status))) {
			updateWorkItem(decision.id, {
				status: 'complete',
				waiting_on: null,
				result: appendResult(
					decision.result,
					`Work reconciler closed this question because gated work is already ${summarizeStatuses(gated)}.`
				),
				actor: RECONCILER_ACTOR
			});
			changes.push(`${label(decision)} completed because its gated work is closed.`);
		}
	}
	return changes;
}

function updateProjectNextMove(rootId: number): string[] {
	const root = getWorkItem(rootId);
	if (!root || root.type !== 'project') return [];
	const children = listWorkItems({ parent_item_id: root.id, includeClosed: true, limit: 500 });
	const next = deriveNextMove(root, children);
	if (next === root.next_action) return [];
	updateWorkItem(root.id, {
		next_action: next,
		actor: RECONCILER_ACTOR
	});
	return [`${label(root)} next action updated to: ${next}`];
}

function findAmbiguities(
	root: WorkItem,
	items: WorkItem[],
	relationships: WorkRelationship[],
	triggerItemId: number
): string[] {
	const trigger = items.find((item) => item.id === triggerItemId);
	if (!trigger) return [];
	const connectedIds = new Set<number>();
	for (const relationship of relationships) {
		connectedIds.add(relationship.from_item_id);
		connectedIds.add(relationship.to_item_id);
	}
	const openQuestions = items.filter(
		(item) =>
			item.id !== trigger.id &&
			openStatuses.has(item.status) &&
			(item.type === 'decision' || item.status === 'needs_review' || item.waiting_on === 'operator')
	);
	if (
		trigger.type === 'observation' &&
		closedStatuses.has(trigger.status) &&
		openQuestions.length > 0 &&
		!connectedIds.has(trigger.id)
	) {
		return [
			`${label(trigger)} is a completed finding under ${label(root)}, but it is not linked to open operator questions. An agent must decide whether any question is stale.`
		];
	}
	return [];
}

function requiredOpenBlockers(
	itemId: number,
	relationships: WorkRelationship[],
	byId: Map<number, WorkItem>
): WorkItem[] {
	const candidates = relationships
		.filter(
			(relationship) =>
				(relationship.relation_type === 'depends_on' && relationship.from_item_id === itemId) ||
				(relationship.relation_type === 'blocks' && relationship.to_item_id === itemId)
		)
		.map((relationship) =>
			relationship.relation_type === 'depends_on'
				? byId.get(relationship.to_item_id)
				: byId.get(relationship.from_item_id)
		)
		.filter((item): item is WorkItem => Boolean(item));
	return candidates.filter((item) => openStatuses.has(item.status));
}

function gatedItemsForDecision(
	decisionId: number,
	relationships: WorkRelationship[],
	byId: Map<number, WorkItem>
): WorkItem[] {
	return relationships
		.filter(
			(relationship) =>
				(relationship.relation_type === 'depends_on' && relationship.to_item_id === decisionId) ||
				(relationship.relation_type === 'blocks' && relationship.from_item_id === decisionId)
		)
		.map((relationship) =>
			relationship.relation_type === 'depends_on'
				? byId.get(relationship.from_item_id)
				: byId.get(relationship.to_item_id)
		)
		.filter((item): item is WorkItem => Boolean(item));
}

function deriveNextMove(project: WorkItem, children: WorkItem[]): string {
	const openChildren = children.filter((item) => openStatuses.has(item.status));
	const blocker = openChildren.find((item) => item.status === 'blocked');
	if (blocker) return `Clear: ${blocker.title}`;
	const decision = openChildren.find(
		(item) =>
			item.type === 'decision' || item.status === 'needs_review' || item.waiting_on === 'operator'
	);
	if (decision) return `Decide: ${decision.title}`;
	const action = openChildren.find(
		(item) =>
			['task', 'change'].includes(item.type) && ['ready', 'in_progress'].includes(item.status)
	);
	if (action) return action.next_action ?? action.title;
	const scheduled = openChildren.find(
		(item) => item.type === 'routine' || item.scheduled_at || item.due_date
	);
	if (scheduled) return `Track: ${scheduled.title}`;
	return project.next_action?.trim() || 'No operator action set';
}

function relatedWorkForRoot(root: WorkItem): WorkItem[] {
	const children = listWorkItems({ parent_item_id: root.id, includeClosed: true, limit: 500 });
	return uniqueById([root, ...children]);
}

function rootItemFor(itemId: number): WorkItem {
	let item = getWorkItem(itemId);
	if (!item) throw new Error(`Work item ${itemId} not found`);
	const seen = new Set<number>();
	while (item.parent_item_id && !seen.has(item.id)) {
		seen.add(item.id);
		const parent = getWorkItem(item.parent_item_id);
		if (!parent) break;
		item = parent;
	}
	return item;
}

function createReconciliationRun(data: {
	root_item_id: number;
	trigger_entity: string;
	trigger_id: string;
	status: WorkReconciliationStatus;
}): WorkReconciliationRunView {
	const existing = findReusableReconciliationRun(data.root_item_id);
	if (existing) return existing;
	const db = getWorkDb();
	const ts = now();
	const result = db
		.prepare(
			`INSERT INTO work_reconciliation_runs
			 (root_item_id, trigger_entity, trigger_id, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(data.root_item_id, data.trigger_entity, data.trigger_id, data.status, ts, ts);
	const row = db
		.prepare('SELECT * FROM work_reconciliation_runs WHERE id = ?')
		.get(result.lastInsertRowid as number) as WorkReconciliationRun;
	return runView(row);
}

function updateReconciliationRun(
	id: number,
	data: {
		status: WorkReconciliationStatus;
		deterministic_changes: string[];
		ambiguities: string[];
		session_key: string | null;
	}
): WorkReconciliationRunView {
	const db = getWorkDb();
	db.prepare(
		`UPDATE work_reconciliation_runs
		 SET status = ?,
		     deterministic_changes_json = ?,
		     ambiguities_json = ?,
		     session_key = ?,
		     updated_at = ?
		 WHERE id = ?`
	).run(
		data.status,
		JSON.stringify(data.deterministic_changes),
		JSON.stringify(data.ambiguities),
		data.session_key,
		now(),
		id
	);
	const row = db.prepare('SELECT * FROM work_reconciliation_runs WHERE id = ?').get(id) as
		| WorkReconciliationRun
		| undefined;
	if (!row) throw new Error(`Reconciliation run ${id} not found`);
	return runView(row);
}

function logContextualSession(
	rootItemId: number,
	workItemId: number,
	sessionKey: string,
	mode: SessionMode,
	prompt: string
): void {
	const db = getWorkDb();
	const ts = now();
	db.prepare(
		`INSERT INTO work_reconciliation_runs
		 (root_item_id, trigger_entity, trigger_id, status, deterministic_changes_json, ambiguities_json, session_key, created_at, updated_at)
		 VALUES (?, 'session', ?, 'agent_running', '[]', ?, ?, ?, ?)`
	).run(
		rootItemId,
		String(workItemId),
		JSON.stringify([
			`${capitalize(mode)} session opened for Work item ${workItemId}.`,
			prompt.slice(0, 500)
		]),
		sessionKey,
		ts,
		ts
	);
}

function buildReconciliationPrompt(
	root: WorkItem,
	items: WorkItem[],
	relationships: WorkRelationship[],
	ambiguities: string[]
): string {
	return `You are resolving Falcon Dash Work integrity for ${label(root)}.

Do not reply with prose only. Inspect and update Work through /api/work/* so the dashboard stops showing stale state.

Ambiguities:
${ambiguities.map((item) => `- ${item}`).join('\n')}

Current Work:
${items.map(compactItem).join('\n')}

Relationships:
${relationships.length ? relationships.map(compactRelationship).join('\n') : '- none'}

Required finish:
- Close or keep open any stale decisions/blockers based on evidence.
- Ensure ${label(root)} has the correct next_action.
- Leave a concise result summary on every item you change.`;
}

function buildAskPrompt(
	item: WorkItem,
	root: WorkItem,
	items: WorkItem[],
	mode: 'ask' | 'reconcile'
): string {
	return `You are in a Falcon Dash contextual session for ${label(item)} under ${label(root)}.

Mode: ${mode}

Use the Work API when state needs to change. Keep the operator-facing answer concise.

Current Work:
${items.map(compactItem).join('\n')}`;
}

function createSessionKey(): string {
	let agentId = 'default';
	try {
		const snapshot = getGatewayClient().snapshot;
		const defaults = snapshot?.snapshot?.sessionDefaults ?? {};
		if (typeof defaults.defaultAgentId === 'string' && defaults.defaultAgentId.trim()) {
			agentId = defaults.defaultAgentId;
		}
	} catch {
		// Gateway availability is checked when the session is created.
	}
	return `agent:${agentId}:falcon:dm:fd-chat-${randomBytes(4).toString('hex')}`;
}

function mapItems(items: WorkItem[]): Map<number, WorkItem> {
	return new Map(items.map((item) => [item.id, item]));
}

function uniqueById(items: WorkItem[]): WorkItem[] {
	const seen = new Set<number>();
	return items.filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
}

function compactItem(item: WorkItem): string {
	const waiting = item.waiting_on ? ` waiting_on=${item.waiting_on}` : '';
	const next = item.next_action ? ` next=${item.next_action}` : '';
	return `- ${label(item)} status=${item.status}${waiting}${next} title="${item.title}"`;
}

function compactRelationship(relationship: WorkRelationship): string {
	return `- ${relationship.from_item_id} ${relationship.relation_type} ${relationship.to_item_id}`;
}

function label(item: WorkItem): string {
	return `${capitalize(item.type)} ${item.id}`;
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function appendResult(current: string | null, addition: string): string {
	return current?.trim() ? `${current.trim()}\n\n${addition}` : addition;
}

function summarizeStatuses(items: WorkItem[]): string {
	const statuses = [...new Set(items.map((item) => item.status))];
	return statuses.join('/');
}

function parseJsonArray(value: string): string[] {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

function runView(row: WorkReconciliationRun): WorkReconciliationRunView {
	return {
		...row,
		deterministic_changes: parseJsonArray(row.deterministic_changes_json),
		ambiguities: parseJsonArray(row.ambiguities_json)
	};
}

function now(): number {
	return Math.floor(Date.now() / 1000);
}
