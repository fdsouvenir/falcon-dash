import { getWorkDb } from './database.js';
import { emitWorkEvent } from './events.js';
import type {
	WorkArea,
	WorkItem,
	WorkItemType,
	WorkPriority,
	WorkQueue,
	WorkStatus
} from './types.js';
import { WORK_ITEM_TYPES, WORK_STATUSES } from './types.js';

export class WorkError extends Error {
	constructor(
		public code: 'WORK_NOT_FOUND' | 'WORK_CONSTRAINT' | 'WORK_DUPLICATE',
		message: string
	) {
		super(message);
		this.name = 'WorkError';
	}
}

function now(): number {
	return Math.floor(Date.now() / 1000);
}

function assertType(type: string): WorkItemType {
	if (!WORK_ITEM_TYPES.includes(type as WorkItemType)) {
		throw new WorkError('WORK_CONSTRAINT', `Invalid work type: ${type}`);
	}
	return type as WorkItemType;
}

function assertStatus(status: string): WorkStatus {
	if (!WORK_STATUSES.includes(status as WorkStatus)) {
		throw new WorkError('WORK_CONSTRAINT', `Invalid work status: ${status}`);
	}
	return status as WorkStatus;
}

export function listWorkAreas(): WorkArea[] {
	const db = getWorkDb();
	return db.prepare('SELECT * FROM work_areas ORDER BY title ASC').all() as WorkArea[];
}

export function getWorkArea(id: string): WorkArea | undefined {
	const db = getWorkDb();
	return db.prepare('SELECT * FROM work_areas WHERE id = ?').get(id) as WorkArea | undefined;
}

export function upsertWorkArea(data: {
	id: string;
	title: string;
	description?: string | null;
	parent_area_id?: string | null;
	status?: 'active' | 'paused' | 'archived';
}): WorkArea {
	const db = getWorkDb();
	const ts = now();
	db.prepare(
		`INSERT INTO work_areas (id, title, description, parent_area_id, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   title = excluded.title,
		   description = excluded.description,
		   parent_area_id = excluded.parent_area_id,
		   status = excluded.status,
		   updated_at = excluded.updated_at`
	).run(
		data.id,
		data.title,
		data.description ?? null,
		data.parent_area_id ?? null,
		data.status ?? 'active',
		ts,
		ts
	);
	emitWorkEvent({ type: 'work.changed', entity: 'area', id: data.id });
	return getWorkArea(data.id)!;
}

export function listWorkItems(
	filters: {
		type?: WorkItemType;
		status?: WorkStatus;
		area_id?: string;
		parent_item_id?: number | null;
		includeClosed?: boolean;
		limit?: number;
	} = {}
): WorkItem[] {
	const db = getWorkDb();
	const conditions: string[] = [];
	const values: unknown[] = [];

	if (filters.type) {
		conditions.push('type = ?');
		values.push(assertType(filters.type));
	}
	if (filters.status) {
		conditions.push('status = ?');
		values.push(assertStatus(filters.status));
	}
	if (filters.area_id) {
		conditions.push('area_id = ?');
		values.push(filters.area_id);
	}
	if (filters.parent_item_id !== undefined) {
		if (filters.parent_item_id === null) {
			conditions.push('parent_item_id IS NULL');
		} else {
			conditions.push('parent_item_id = ?');
			values.push(filters.parent_item_id);
		}
	}
	if (!filters.includeClosed) {
		conditions.push("status NOT IN ('complete','cancelled','archived')");
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
	return db
		.prepare(`SELECT * FROM work_items ${where} ORDER BY last_activity_at DESC, id DESC LIMIT ?`)
		.all(...values, limit) as WorkItem[];
}

export function getWorkItem(id: number): WorkItem | undefined {
	const db = getWorkDb();
	return db.prepare('SELECT * FROM work_items WHERE id = ?').get(id) as WorkItem | undefined;
}

export function getWorkItemByLegacy(
	legacyType: 'project' | 'plan',
	legacyId: number
): WorkItem | undefined {
	const db = getWorkDb();
	const column = legacyType === 'project' ? 'legacy_project_id' : 'legacy_plan_id';
	return db.prepare(`SELECT * FROM work_items WHERE ${column} = ?`).get(legacyId) as
		| WorkItem
		| undefined;
}

export function createWorkItem(data: {
	type: WorkItemType;
	area_id?: string | null;
	parent_item_id?: number | null;
	title: string;
	description?: string | null;
	body?: string | null;
	status?: WorkStatus;
	owner?: string | null;
	waiting_on?: string | null;
	priority?: WorkPriority | null;
	next_action?: string | null;
	approval_required?: boolean;
	due_date?: string | null;
	scheduled_at?: string | null;
	stale_after?: string | null;
	result?: string | null;
	legacy_project_id?: number | null;
	legacy_plan_id?: number | null;
	actor?: string;
}): WorkItem {
	if (!data.title.trim()) throw new WorkError('WORK_CONSTRAINT', 'title is required');
	const db = getWorkDb();
	const ts = now();
	const type = assertType(data.type);
	const status = assertStatus(data.status ?? defaultStatusForType(type));
	const result = db
		.prepare(
			`INSERT INTO work_items (
			 type, area_id, parent_item_id, title, description, body, status, owner, waiting_on, priority,
			 next_action, approval_required, due_date, scheduled_at, stale_after, result,
			 legacy_project_id, legacy_plan_id, created_at, updated_at, last_activity_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			type,
			data.area_id ?? null,
			data.parent_item_id ?? null,
			data.title,
			data.description ?? null,
			data.body ?? null,
			status,
			data.owner ?? null,
			data.waiting_on ?? null,
			data.priority ?? 'normal',
			data.next_action ?? null,
			data.approval_required ? 1 : 0,
			data.due_date ?? null,
			data.scheduled_at ?? null,
			data.stale_after ?? null,
			data.result ?? null,
			data.legacy_project_id ?? null,
			data.legacy_plan_id ?? null,
			ts,
			ts,
			ts
		);
	const id = result.lastInsertRowid as number;
	logWorkActivity(id, data.actor ?? 'system', 'created', `Created ${type}`);
	createWorkVersion(id, data.actor ?? 'system');
	emitWorkEvent({ type: 'work.changed', entity: 'item', id });
	return getWorkItem(id)!;
}

export function updateWorkItem(
	id: number,
	data: Partial<{
		type: WorkItemType;
		area_id: string | null;
		parent_item_id: number | null;
		title: string;
		description: string | null;
		body: string | null;
		status: WorkStatus;
		owner: string | null;
		waiting_on: string | null;
		priority: WorkPriority | null;
		next_action: string | null;
		approval_required: boolean;
		due_date: string | null;
		scheduled_at: string | null;
		stale_after: string | null;
		result: string | null;
		actor: string;
	}>
): WorkItem | undefined {
	const current = getWorkItem(id);
	if (!current) return undefined;
	const db = getWorkDb();
	const ts = now();
	const updates = ['updated_at = ?', 'last_activity_at = ?'];
	const values: unknown[] = [ts, ts];

	function set(column: string, value: unknown): void {
		updates.push(`${column} = ?`);
		values.push(value);
	}

	if (data.type !== undefined) set('type', assertType(data.type));
	if (data.area_id !== undefined) set('area_id', data.area_id);
	if (data.parent_item_id !== undefined) set('parent_item_id', data.parent_item_id);
	if (data.title !== undefined) set('title', data.title);
	if (data.description !== undefined) set('description', data.description);
	if (data.body !== undefined) set('body', data.body);
	if (data.status !== undefined) set('status', assertStatus(data.status));
	if (data.owner !== undefined) set('owner', data.owner);
	if (data.waiting_on !== undefined) set('waiting_on', data.waiting_on);
	if (data.priority !== undefined) set('priority', data.priority);
	if (data.next_action !== undefined) set('next_action', data.next_action);
	if (data.approval_required !== undefined)
		set('approval_required', data.approval_required ? 1 : 0);
	if (data.due_date !== undefined) set('due_date', data.due_date);
	if (data.scheduled_at !== undefined) set('scheduled_at', data.scheduled_at);
	if (data.stale_after !== undefined) set('stale_after', data.stale_after);
	if (data.result !== undefined) set('result', data.result);

	values.push(id);
	db.prepare(`UPDATE work_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
	logWorkActivity(id, data.actor ?? 'system', 'updated', summarizeWorkUpdate(current, data));
	createWorkVersion(id, data.actor ?? 'system');
	emitWorkEvent({ type: 'work.changed', entity: 'item', id });
	return getWorkItem(id);
}

export function listWorkQueue(): WorkQueue {
	const active = listWorkItems({ limit: 500 });
	const isAgent = (item: WorkItem) =>
		item.waiting_on === 'agent' || item.waiting_on === 'me' || item.owner === 'agent';
	const needsOperator = active.filter(
		(i) =>
			i.waiting_on === 'operator' ||
			i.waiting_on === 'me' ||
			i.waiting_on === 'fred' ||
			i.status === 'needs_review'
	);
	const waitingOnExternal = active.filter(
		(i) => i.waiting_on === 'external' || i.waiting_on === 'system'
	);

	return {
		nextActions: active.filter(
			(i) => ['task', 'change'].includes(i.type) && ['ready', 'in_progress'].includes(i.status)
		),
		needsOperator,
		waitingOnOperator: needsOperator,
		waitingOnFred: needsOperator,
		waitingOnAgent: active.filter((i) => isAgent(i) && i.status !== 'needs_review'),
		waitingOnExternal,
		needsReview: active.filter((i) => i.status === 'needs_review'),
		scheduledRoutines: active.filter((i) => i.type === 'routine' || i.status === 'scheduled'),
		staleCleanup: active.filter((i) => Boolean(i.stale_after)),
		blockedRisky: active.filter((i) => i.status === 'blocked' || i.priority === 'urgent')
	};
}

export function logWorkActivity(
	workItemId: number,
	actor: string,
	action: string,
	details?: string
): void {
	const db = getWorkDb();
	db.prepare(
		'INSERT INTO work_activity (work_item_id, actor, action, details, created_at) VALUES (?, ?, ?, ?, ?)'
	).run(workItemId, actor, action, details ?? null, now());
}

export function addEvidenceRef(data: {
	work_item_id?: number | null;
	observation_id?: number | null;
	source_type: string;
	source_ref: string;
	summary?: string | null;
}): void {
	const db = getWorkDb();
	const existing = db
		.prepare(
			`SELECT id FROM work_evidence_refs
			 WHERE source_type = ?
			   AND source_ref = ?
			   AND work_item_id IS ?
			   AND observation_id IS ?`
		)
		.get(data.source_type, data.source_ref, data.work_item_id ?? null, data.observation_id ?? null);
	if (existing) return;

	db.prepare(
		`INSERT INTO work_evidence_refs
		 (work_item_id, observation_id, source_type, source_ref, summary, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`
	).run(
		data.work_item_id ?? null,
		data.observation_id ?? null,
		data.source_type,
		data.source_ref,
		data.summary ?? null,
		now()
	);
	emitWorkEvent({ type: 'work.changed', entity: 'evidence', id: data.source_ref });
}

function createWorkVersion(workItemId: number, actor: string): void {
	const db = getWorkDb();
	const item = getWorkItem(workItemId);
	if (!item) return;
	const current = db
		.prepare('SELECT MAX(version) as version FROM work_versions WHERE work_item_id = ?')
		.get(workItemId) as { version: number | null };
	const version = (current.version ?? 0) + 1;
	db.prepare(
		`INSERT INTO work_versions
		 (work_item_id, version, title, description, body, result, status, created_by, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		workItemId,
		version,
		item.title,
		item.description,
		item.body,
		item.result,
		item.status,
		actor,
		now()
	);
}

function defaultStatusForType(type: WorkItemType): WorkStatus {
	if (type === 'decision') return 'needs_review';
	if (type === 'routine') return 'scheduled';
	if (type === 'observation') return 'complete';
	return 'backlog';
}

function summarizeWorkUpdate(current: WorkItem, data: Record<string, unknown>): string {
	const parts: string[] = [];
	if (data.status !== undefined && data.status !== current.status) {
		parts.push(`Status: ${current.status} -> ${data.status}`);
	}
	if (data.title !== undefined && data.title !== current.title) parts.push('Title updated');
	if (data.description !== undefined && data.description !== current.description) {
		parts.push('Description updated');
	}
	if (data.body !== undefined && data.body !== current.body) parts.push('Body updated');
	if (data.result !== undefined && data.result !== current.result) parts.push('Result updated');
	return parts.join('; ') || 'Updated';
}
