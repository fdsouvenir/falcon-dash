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
const PACKET_TEXT_LIMIT = 220;
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

type StewardPacket = {
	root: WorkItem;
	touched: WorkItem | null;
	items: WorkItem[];
	relationships: WorkRelationship[];
	mechanicalChanges: string[];
	staleCandidates: string[];
	evidenceRefs: WorkEvidencePacket[];
	recentActivity: WorkActivityPacket[];
};

type WorkEvidencePacket = {
	work_item_id: number | null;
	observation_id: number | null;
	source_type: string;
	source_ref: string;
	summary: string | null;
	created_at: number;
};

type WorkActivityPacket = {
	work_item_id: number;
	actor: string;
	action: string;
	details: string | null;
	created_at: number;
};

export { RECONCILER_ACTOR };

export async function reconcileWorkItem(
	itemId: number,
	options: ReconcileOptions = {}
): Promise<ReconcileResult> {
	const root = rootItemFor(itemId);
	const touched = getWorkItem(itemId) ?? null;
	const run = createReconciliationRun({
		root_item_id: root.id,
		trigger_entity: options.triggerEntity ?? 'item',
		trigger_id: String(options.triggerId ?? itemId),
		status: 'running'
	});

	const related = relatedWorkForRoot(root);
	const relationships = listWorkRelationshipsForItems(related.map((item) => item.id));
	const changes: string[] = [];
	let staleCandidates: string[] = [];

	if (options.forceAgent) {
		staleCandidates.push('Manual reconciliation requested agent steward review.');
	} else {
		changes.push(...resolveGraphCascades(related, relationships));
	}
	staleCandidates = uniqueStrings([
		...staleCandidates,
		...findStaleRiskCandidates(root, related, relationships, itemId)
	]);

	let status: WorkReconciliationStatus =
		staleCandidates.length > 0 ? 'needs_agent' : changes.length > 0 ? 'applied' : 'no_action';
	let sessionKey: string | null = null;

	if (staleCandidates.length > 0) {
		if (run.session_key && ['agent_running', 'needs_agent', 'needs_review'].includes(run.status)) {
			sessionKey = run.session_key;
			status = 'agent_running';
		} else {
			try {
				const packet = buildStewardPacket({
					root,
					touched,
					items: related,
					relationships,
					mechanicalChanges: changes,
					staleCandidates
				});
				const session = await createContextualAgentSession(root.id, {
					mode: 'reconcile',
					message: buildReconciliationPrompt(packet),
					recordRun: false
				});
				sessionKey = session.sessionKey;
				status = 'agent_running';
			} catch (err) {
				staleCandidates.push(
					`Agent session could not be started: ${err instanceof Error ? err.message : String(err)}`
				);
				status = 'needs_agent';
			}
		}
	}

	return {
		root,
		run: updateReconciliationRun(run.id, {
			status,
			deterministic_changes: changes,
			ambiguities: staleCandidates,
			session_key: sessionKey
		})
	};
}

export async function createContextualAgentSession(
	workItemId: number,
	options: { mode: SessionMode; message?: string; recordRun?: boolean }
): Promise<ContextualSessionResult> {
	const item = getWorkItem(workItemId);
	if (!item) throw new Error(`Work item ${workItemId} not found`);
	const root = rootItemFor(workItemId);
	const related = relatedWorkForRoot(root);
	const relationships = listWorkRelationshipsForItems(related.map((workItem) => workItem.id));
	const sessionKey = createSessionKey();
	const label = `${capitalize(root.type)} ${root.id} · ${
		options.mode === 'reconcile' ? 'Reconcile Work' : 'Ask Agent'
	}`;
	const packet = buildStewardPacket({
		root,
		touched: item,
		items: related,
		relationships,
		mechanicalChanges: [],
		staleCandidates:
			options.mode === 'reconcile'
				? findStaleRiskCandidates(root, related, relationships, item.id)
				: []
	});
	const prompt =
		options.mode === 'reconcile' && options.message?.trim()
			? options.message
			: buildAskPrompt(packet, options.mode, options.message);
	const client = getGatewayClient();
	if (client.state !== 'ready') throw new Error(`Gateway ${client.state}`);

	await client.call('sessions.patch', { key: sessionKey, label });
	await client.call('chat.send', {
		sessionKey,
		message: prompt
	});

	if (options.recordRun ?? true) {
		logContextualSession(root.id, workItemId, sessionKey, options.mode, prompt);
	}
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

export function hasStaleRiskForProject(rootItemId: number): boolean {
	const root = getWorkItem(rootItemId);
	if (!root) return false;
	const related = relatedWorkForRoot(root);
	const relationships = listWorkRelationshipsForItems(related.map((item) => item.id));
	return findStaleRiskCandidates(root, related, relationships, root.id).length > 0;
}

function resolveGraphCascades(items: WorkItem[], relationships: WorkRelationship[]): string[] {
	const changes: string[] = [];
	const byId = mapItems(items);
	for (const item of items) {
		if (!['blocked', 'waiting'].includes(item.status)) continue;
		if (!hasStructuredBlockerReason(item.id, relationships)) continue;
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

function findStaleRiskCandidates(
	root: WorkItem,
	items: WorkItem[],
	relationships: WorkRelationship[],
	triggerItemId: number
): string[] {
	const candidates: string[] = [];
	const trigger = items.find((item) => item.id === triggerItemId);
	const connectedIds = new Set<number>();
	for (const relationship of relationships) {
		connectedIds.add(relationship.from_item_id);
		connectedIds.add(relationship.to_item_id);
	}
	const openQuestions = items.filter(
		(item) =>
			item.id !== trigger?.id &&
			openStatuses.has(item.status) &&
			(item.type === 'decision' || item.status === 'needs_review' || item.waiting_on === 'operator')
	);
	if (
		trigger &&
		trigger.type === 'observation' &&
		closedStatuses.has(trigger.status) &&
		openQuestions.length > 0 &&
		!connectedIds.has(trigger.id)
	) {
		candidates.push(
			`${label(trigger)} is a completed finding under ${label(root)}, but it is not linked to open operator questions. An agent must decide whether any question is stale.`
		);
	}

	const byId = mapItems(items);
	for (const decision of openQuestions.filter((item) => item.type === 'decision')) {
		const gated = gatedItemsForDecision(decision.id, relationships, byId);
		if (gated.length > 0 && gated.every((item) => closedStatuses.has(item.status))) {
			candidates.push(
				`${label(decision)} gates only closed Work (${gated.map(label).join(', ')}). The agent must decide whether to complete, supersede, or keep it open.`
			);
		}
	}

	for (const item of items.filter((candidate) =>
		['blocked', 'waiting'].includes(candidate.status)
	)) {
		const blockers = requiredOpenBlockers(item.id, relationships, byId);
		const hasStructuredReason = hasStructuredBlockerReason(item.id, relationships);
		const isStructuredBlocker = relationships.some(
			(relationship) =>
				relationship.relation_type === 'blocks' && relationship.from_item_id === item.id
		);
		if (!hasStructuredReason && !isStructuredBlocker) {
			candidates.push(
				`${label(item)} is ${item.status} without an explicit depends_on/blocks relationship. The agent should encode the blocker or update the state.`
			);
		} else if (blockers.length === 0 && item.type === 'decision') {
			candidates.push(
				`${label(item)} has no open structured blockers after mechanical propagation. The agent should confirm the decision state and next operator-facing action.`
			);
		}
	}

	const suggestedNext = root.type === 'project' ? deriveNextMove(root, items) : null;
	if (
		suggestedNext &&
		root.next_action?.trim() &&
		normalizeText(suggestedNext) !== normalizeText(root.next_action)
	) {
		candidates.push(
			`${label(root)} next_action may need agent review. Current="${truncate(root.next_action)}"; mechanical candidate="${truncate(suggestedNext)}".`
		);
	}

	return uniqueStrings(candidates);
}

function hasStructuredBlockerReason(itemId: number, relationships: WorkRelationship[]): boolean {
	return relationships.some(
		(relationship) =>
			(relationship.relation_type === 'depends_on' && relationship.from_item_id === itemId) ||
			(relationship.relation_type === 'blocks' && relationship.to_item_id === itemId)
	);
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

function buildStewardPacket(data: {
	root: WorkItem;
	touched: WorkItem | null;
	items: WorkItem[];
	relationships: WorkRelationship[];
	mechanicalChanges: string[];
	staleCandidates: string[];
}): StewardPacket {
	const itemIds = data.items.map((item) => item.id);
	return {
		...data,
		evidenceRefs: listEvidenceRefsForItems(itemIds),
		recentActivity: listRecentActivityForItems(itemIds)
	};
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

function buildReconciliationPrompt(packet: StewardPacket): string {
	return `${renderStewardInstructions(packet.root)}

Mode: reconcile

${renderStewardPacket(packet)}

Required finish:
- Update Work through /api/work/* when state should change.
- Do not reply with prose only; prose is not reconciliation.
- Close or update stale blockers, decisions, and next actions only when the Work context and evidence support it.
- When uncertain, leave the item open, record what is missing, and set the appropriate waiting state.
- Keep the operator-facing summary short: what changed, what remains blocked, and the next real move.`;
}

function buildAskPrompt(
	packet: StewardPacket,
	mode: SessionMode,
	operatorMessage?: string
): string {
	return `${renderStewardInstructions(packet.root)}

Mode: ${mode}
Operator message: ${operatorMessage?.trim() || '0 results. No explicit operator message provided.'}

${renderStewardPacket(packet)}

If Work state needs to change, call /api/work/*. Otherwise answer concisely with the current state and next real move.`;
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

function renderStewardInstructions(root: WorkItem): string {
	return `You are the Work steward for ${label(root)}. Your job is to keep Falcon Dash's Work state coherent, current, and operator-useful.

Role rules:
- Use deterministic mechanical facts as hints, not as a substitute for judgment.
- If Work state needs to change, call /api/work/*. Do not only explain what should happen.
- Close or update stale blockers, decisions, and next actions only when the provided Work context and evidence support it.
- When you change a Work item, include a concise result or next_action explaining why.
- When uncertain, leave the item open, record what is missing, and set the appropriate waiting state.
- Prefer structured relationships over prose. If one item gates another, create or update a depends_on, blocks, relates_to, or derived_from relationship.
- Keep operator-facing output short: what changed, what is still blocked, and the next real move.`;
}

function renderStewardPacket(packet: StewardPacket): string {
	const buckets = bucketItems(packet.items);
	return `Work packet:
root:
${compactItem(packet.root)}

touched:
${packet.touched ? compactItem(packet.touched) : '0 results. No touched Work item was available.'}

aggregates:
- open_blockers: ${buckets.openBlockers.length}
- open_operator_questions: ${buckets.openOperatorQuestions.length}
- ready_actions: ${buckets.readyActions.length}
- stale_risk_candidates: ${packet.staleCandidates.length}
- mechanical_changes: ${packet.mechanicalChanges.length}

stale_risk_candidates[${packet.staleCandidates.length}]:
${renderStringRows(packet.staleCandidates)}

mechanical_changes[${packet.mechanicalChanges.length}]:
${renderStringRows(packet.mechanicalChanges)}

open_blockers[${buckets.openBlockers.length}]:
${renderItemRows(buckets.openBlockers)}

open_operator_questions[${buckets.openOperatorQuestions.length}]:
${renderItemRows(buckets.openOperatorQuestions)}

ready_actions[${buckets.readyActions.length}]:
${renderItemRows(buckets.readyActions)}

current_work[${packet.items.length}]{id,type,status,waiting_on,title,next_action,result}:
${renderItemRows(packet.items)}

relationships[${packet.relationships.length}]{from,relation,to}:
${packet.relationships.length ? packet.relationships.map(compactRelationship).join('\n') : '0 results. No relationships recorded.'}

evidence_refs[${packet.evidenceRefs.length}]{work_item_id,source_type,source_ref,summary}:
${renderEvidenceRows(packet.evidenceRefs)}

recent_activity[${packet.recentActivity.length}]{work_item_id,actor,action,details}:
${renderActivityRows(packet.recentActivity)}

next_commands:
- GET /api/work/items/${packet.root.id}
- GET /api/work/items/${packet.root.id}/relationships
- PATCH /api/work/items/<id> with {"status":"<status>","waiting_on":null,"result":"<why>","actor":"agent"}
- POST /api/work/items/<id>/relationships with {"to_item_id":<id>,"relation_type":"depends_on"}`;
}

function bucketItems(items: WorkItem[]): {
	openBlockers: WorkItem[];
	openOperatorQuestions: WorkItem[];
	readyActions: WorkItem[];
} {
	return {
		openBlockers: items.filter((item) => item.status === 'blocked'),
		openOperatorQuestions: items.filter(
			(item) =>
				openStatuses.has(item.status) &&
				(item.type === 'decision' ||
					item.status === 'needs_review' ||
					item.waiting_on === 'operator')
		),
		readyActions: items.filter(
			(item) =>
				['task', 'change'].includes(item.type) && ['ready', 'in_progress'].includes(item.status)
		)
	};
}

function renderStringRows(rows: string[]): string {
	return rows.length ? rows.map((row) => `- ${row}`).join('\n') : '0 results.';
}

function renderItemRows(items: WorkItem[]): string {
	return items.length ? items.map(compactItem).join('\n') : '0 results.';
}

function renderEvidenceRows(rows: WorkEvidencePacket[]): string {
	if (rows.length === 0) return '0 results.';
	return rows
		.map(
			(row) =>
				`- item=${row.work_item_id ?? '-'} source=${row.source_type}:${row.source_ref} summary="${truncate(row.summary)}"`
		)
		.join('\n');
}

function renderActivityRows(rows: WorkActivityPacket[]): string {
	if (rows.length === 0) return '0 results.';
	return rows
		.map(
			(row) =>
				`- item=${row.work_item_id} actor=${row.actor} action=${row.action} details="${truncate(row.details)}"`
		)
		.join('\n');
}

function listEvidenceRefsForItems(itemIds: number[]): WorkEvidencePacket[] {
	if (itemIds.length === 0) return [];
	const placeholders = itemIds.map(() => '?').join(',');
	const db = getWorkDb();
	return db
		.prepare(
			`SELECT work_item_id, observation_id, source_type, source_ref, summary, created_at
			 FROM work_evidence_refs
			 WHERE work_item_id IN (${placeholders}) OR observation_id IN (${placeholders})
			 ORDER BY created_at DESC, id DESC
			 LIMIT 30`
		)
		.all(...itemIds, ...itemIds) as WorkEvidencePacket[];
}

function listRecentActivityForItems(itemIds: number[]): WorkActivityPacket[] {
	if (itemIds.length === 0) return [];
	const placeholders = itemIds.map(() => '?').join(',');
	const db = getWorkDb();
	return db
		.prepare(
			`SELECT work_item_id, actor, action, details, created_at
			 FROM work_activity
			 WHERE work_item_id IN (${placeholders})
			 ORDER BY created_at DESC, id DESC
			 LIMIT 30`
		)
		.all(...itemIds) as WorkActivityPacket[];
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

function normalizeText(value: string | null | undefined): string {
	return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function truncate(value: string | null | undefined): string {
	const text = value?.trim() ?? '';
	if (!text) return '-';
	return text.length > PACKET_TEXT_LIMIT
		? `${text.slice(0, PACKET_TEXT_LIMIT)}... (${text.length} chars total)`
		: text;
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter((value) => value.trim()))];
}
