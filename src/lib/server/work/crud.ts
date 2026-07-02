import { getWorkDb } from './database.js';
import { emitWorkEvent } from './events.js';
import type {
	WorkArea,
	WorkBlockerLink,
	WorkBlockerSource,
	WorkBlockerStatus,
	WorkCategory,
	WorkCategoryDeleteResult,
	WorkCategoryKind,
	WorkChange,
	WorkChangeAction,
	WorkChangeEntityType,
	WorkChangeLogEntry,
	WorkItem,
	WorkItemType,
	WorkQueue,
	WorkStatus
} from './types.js';
import { WORK_ITEM_TYPES, WORK_STATUSES } from './types.js';

type CreateWorkItemInput = {
	type: WorkItemType;
	title: string;
	approval_required?: boolean | number;
	actor?: string;
	source?: string;
} & Partial<Omit<WorkItem, 'id' | 'type' | 'title' | 'approval_required'>>;

type UpdateWorkItemInput = {
	approval_required?: boolean | number;
	actor?: string;
	source?: string;
} & Partial<Omit<WorkItem, 'id' | 'approval_required'>>;

type WorkChangeLogInput = {
	actor?: string;
	source?: string;
	entity_type: WorkChangeEntityType;
	entity_id: string | number;
	entity_title?: string | null;
	action: WorkChangeAction;
	project_id?: number | null;
	parent_item_id?: number | null;
	area_id?: string | null;
	summary: string;
	changes?: WorkChange[];
	metadata?: Record<string, unknown>;
};

type CreateWorkBlockerLinkInput = {
	project_id?: number | null;
	blocked_item_id: number;
	blocker_source: WorkBlockerSource;
	blocker_item_id?: number | null;
	external_label?: string | null;
	reason?: string | null;
	unblock_action?: string | null;
	status?: WorkBlockerStatus;
	actor?: string;
	source?: string;
};

type UpdateWorkBlockerLinkInput = Partial<
	Pick<WorkBlockerLink, 'external_label' | 'reason' | 'unblock_action' | 'status' | 'project_id'>
> & {
	actor?: string;
	source?: string;
};

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

function assertBlockerSource(source: string): WorkBlockerSource {
	const sources: WorkBlockerSource[] = ['work_item', 'person', 'system', 'external'];
	if (!sources.includes(source as WorkBlockerSource)) {
		throw new WorkError('WORK_CONSTRAINT', `Invalid blocker source: ${source}`);
	}
	return source as WorkBlockerSource;
}

function assertBlockerStatus(status: string): WorkBlockerStatus {
	const statuses: WorkBlockerStatus[] = ['active', 'resolved'];
	if (!statuses.includes(status as WorkBlockerStatus)) {
		throw new WorkError('WORK_CONSTRAINT', `Invalid blocker status: ${status}`);
	}
	return status as WorkBlockerStatus;
}

export function listWorkAreas(): WorkArea[] {
	const db = getWorkDb();
	return db.prepare('SELECT * FROM work_areas ORDER BY title ASC').all() as WorkArea[];
}

export function listWorkCategories(): WorkCategory[] {
	return listWorkAreas()
		.filter((area) => area.status !== 'archived')
		.map(mapWorkCategory);
}

export function getWorkArea(id: string): WorkArea | undefined {
	const db = getWorkDb();
	return db.prepare('SELECT * FROM work_areas WHERE id = ?').get(id) as WorkArea | undefined;
}

export function getWorkCategory(id: string): WorkCategory | undefined {
	const area = getWorkArea(id);
	return area ? mapWorkCategory(area) : undefined;
}

export function upsertWorkCategory(data: {
	id?: string;
	title: string;
	description?: string | null;
	parent_category_id?: string | null;
	status?: 'active' | 'paused' | 'archived';
	kind?: WorkCategoryKind;
}): WorkCategory {
	const title = data.title.trim();
	if (!title) throw new WorkError('WORK_CONSTRAINT', 'title is required');
	const kind = data.kind ?? (data.parent_category_id ? 'subcategory' : 'category');
	if (kind === 'subcategory' && !data.parent_category_id) {
		throw new WorkError('WORK_CONSTRAINT', 'parent_category_id is required');
	}
	if (kind === 'category' && data.parent_category_id) {
		throw new WorkError('WORK_CONSTRAINT', 'categories cannot have a parent_category_id');
	}
	if (data.parent_category_id && !getWorkArea(data.parent_category_id)) {
		throw new WorkError('WORK_NOT_FOUND', `Category ${data.parent_category_id} not found`);
	}
	const id = data.id?.trim() || categoryIdFor(kind, title, data.parent_category_id);
	const before = getWorkArea(id);
	const area = upsertWorkArea({
		id,
		title,
		description: data.description ?? null,
		parent_area_id: kind === 'subcategory' ? data.parent_category_id : null,
		status: data.status ?? 'active'
	});
	recordWorkChangeLog({
		actor: 'operator',
		source: 'api',
		entity_type: kind,
		entity_id: area.id,
		entity_title: area.title,
		action: before ? 'updated' : 'created',
		area_id: area.id,
		summary: before ? `Updated ${kind}` : `Created ${kind}`,
		changes: before ? diffWorkRecords(before, area, categoryChangeFields) : [],
		metadata: {
			parent_category_id: area.parent_area_id
		}
	});
	return mapWorkCategory(area);
}

export function deleteWorkCategory(id: string): WorkCategoryDeleteResult | undefined {
	const area = getWorkArea(id);
	if (!area) return undefined;

	const db = getWorkDb();
	const childRows = db
		.prepare('SELECT id FROM work_areas WHERE parent_area_id = ?')
		.all(id) as Array<{ id: string }>;
	const deletedIds = area.parent_area_id ? [id] : [id, ...childRows.map((child) => child.id)];
	const placeholders = deletedIds.map(() => '?').join(', ');
	const ts = now();

	const result = db.transaction(() => {
		const unassigned = db
			.prepare(
				`UPDATE work_items
				 SET area_id = NULL, updated_at = ?, last_activity_at = ?
				 WHERE area_id IN (${placeholders})`
			)
			.run(ts, ts, ...deletedIds);

		let deletedCategories = 0;
		if (!area.parent_area_id) {
			deletedCategories += db
				.prepare('DELETE FROM work_areas WHERE parent_area_id = ?')
				.run(id).changes;
		}
		deletedCategories += db.prepare('DELETE FROM work_areas WHERE id = ?').run(id).changes;

		return {
			id,
			deleted: deletedCategories > 0,
			unassigned_items: unassigned.changes,
			deleted_categories: deletedCategories
		};
	})();

	recordWorkChangeLog({
		actor: 'operator',
		source: 'api',
		entity_type: area.parent_area_id ? 'subcategory' : 'category',
		entity_id: area.id,
		entity_title: area.title,
		action: 'deleted',
		area_id: area.id,
		summary: `Deleted ${area.parent_area_id ? 'subcategory' : 'category'}`,
		changes: [{ field: 'exists', label: 'Exists', from: true, to: false }],
		metadata: {
			deleted_categories: result.deleted_categories,
			unassigned_items: result.unassigned_items
		}
	});
	emitWorkEvent({ type: 'work.changed', entity: 'area', id });
	if (result.unassigned_items > 0) {
		emitWorkEvent({ type: 'work.changed', entity: 'item', id: 'category-unassigned' });
	}
	return result;
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
		category_id?: string;
		subcategory_id?: string;
		parent_item_id?: number | null;
		includeClosed?: boolean;
		limit?: number;
	} = {}
): WorkItem[] {
	const db = getWorkDb();
	const conditions: string[] = [];
	const values: unknown[] = [];

	if (filters.type) {
		conditions.push('wi.type = ?');
		values.push(assertType(filters.type));
	}
	if (filters.status) {
		conditions.push('wi.status = ?');
		values.push(assertStatus(filters.status));
	}
	if (filters.area_id) {
		conditions.push('wi.area_id = ?');
		values.push(filters.area_id);
	}
	if (filters.subcategory_id) {
		conditions.push('wi.area_id = ?');
		values.push(filters.subcategory_id);
	}
	if (filters.category_id) {
		conditions.push(
			`wi.area_id IN (
				SELECT id FROM work_areas WHERE id = ? OR parent_area_id = ?
			)`
		);
		values.push(filters.category_id, filters.category_id);
	}
	if (filters.parent_item_id !== undefined) {
		if (filters.parent_item_id === null) {
			conditions.push('wi.parent_item_id IS NULL');
		} else {
			conditions.push('wi.parent_item_id = ?');
			values.push(filters.parent_item_id);
		}
	}
	conditions.push("wi.type NOT IN ('space','area')");
	if (!filters.includeClosed) {
		conditions.push("wi.status NOT IN ('complete','cancelled','archived')");
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
	return db
		.prepare(`${workItemSelect()} ${where} ORDER BY wi.last_activity_at DESC, wi.id DESC LIMIT ?`)
		.all(...values, limit)
		.map(mapWorkItem);
}

export function getWorkItem(id: number): WorkItem | undefined {
	const db = getWorkDb();
	const row = db
		.prepare(`${workItemSelect()} WHERE wi.id = ? AND wi.type NOT IN ('space','area')`)
		.get(id);
	return row ? mapWorkItem(row) : undefined;
}

export function getWorkItemByLegacy(
	legacyType: 'project' | 'plan',
	legacyId: number
): WorkItem | undefined {
	const db = getWorkDb();
	const column = legacyType === 'project' ? 'legacy_project_id' : 'legacy_plan_id';
	const row = db.prepare(`${workItemSelect()} WHERE wi.${column} = ?`).get(legacyId);
	return row ? mapWorkItem(row) : undefined;
}

export function createWorkItem(data: CreateWorkItemInput): WorkItem {
	if (!data.title.trim()) throw new WorkError('WORK_CONSTRAINT', 'title is required');
	const db = getWorkDb();
	const ts = now();
	const type = assertType(data.type);
	const status = assertStatus(data.status ?? defaultStatusForType(type));
	validateTypedDetails(type, data);
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
			toApprovalFlag(data.approval_required),
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
	upsertTypedDetails(id, type, data);
	logWorkActivity(id, data.actor ?? 'system', 'created', `Created ${type}`);
	createWorkVersion(id, data.actor ?? 'system');
	const created = getWorkItem(id)!;
	recordWorkItemChange(created, 'created', data.actor ?? 'system', data.source, `Created ${type}`);
	syncImplicitBlockerLinksForItem(created);
	emitWorkEvent({ type: 'work.changed', entity: 'item', id });
	return created;
}

export function updateWorkItem(id: number, data: UpdateWorkItemInput): WorkItem | undefined {
	const current = getWorkItem(id);
	if (!current) return undefined;
	const db = getWorkDb();
	const ts = now();
	const nextType = assertType(data.type ?? current.type);
	validateTypedDetails(nextType, { ...current, ...data, type: nextType }, Boolean(data.type));
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
		set('approval_required', toApprovalFlag(data.approval_required));
	if (data.due_date !== undefined) set('due_date', data.due_date);
	if (data.scheduled_at !== undefined) set('scheduled_at', data.scheduled_at);
	if (data.stale_after !== undefined) set('stale_after', data.stale_after);
	if (data.result !== undefined) set('result', data.result);

	values.push(id);
	db.prepare(`UPDATE work_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
	upsertTypedDetails(id, nextType, { ...current, ...data, type: nextType });
	logWorkActivity(id, data.actor ?? 'system', 'updated', summarizeWorkUpdate(current, data));
	createWorkVersion(id, data.actor ?? 'system');
	const updated = getWorkItem(id);
	if (!updated) return undefined;
	const changes = diffWorkRecords(current, updated, itemChangeFields);
	recordWorkItemChange(
		updated,
		actionForItemChanges(current, updated, changes),
		data.actor ?? 'system',
		data.source,
		summarizeChangeLog(changes, 'Updated'),
		changes
	);
	syncImplicitBlockerLinksForItem(updated);
	emitWorkEvent({ type: 'work.changed', entity: 'item', id });
	return updated;
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
			(i) =>
				['next_step', 'change_request'].includes(i.type) &&
				['ready', 'in_progress'].includes(i.status)
		),
		needsOperator,
		waitingOnOperator: needsOperator,
		waitingOnAgent: active.filter((i) => isAgent(i) && i.status !== 'needs_review'),
		waitingOnExternal,
		needsReview: active.filter((i) => i.status === 'needs_review'),
		failedAutomations: active.filter(
			(i) =>
				i.type === 'automation' &&
				(i.status === 'blocked' || (i.failure_count ?? 0) > 0 || i.enabled === 0)
		),
		scheduledAutomations: active.filter((i) => i.type === 'automation' || i.status === 'scheduled'),
		staleCleanup: active.filter((i) => Boolean(i.stale_after)),
		blockedRisky: active.filter((i) => i.status === 'blocked' || i.priority === 'urgent')
	};
}

export function listWorkBlockerLinks(
	filters: {
		project_id?: number;
		blocked_item_id?: number;
		blocker_item_id?: number;
		status?: WorkBlockerStatus | 'all';
		limit?: number;
	} = {}
): WorkBlockerLink[] {
	const db = getWorkDb();
	const conditions: string[] = [];
	const values: unknown[] = [];

	if (filters.project_id !== undefined) {
		conditions.push('bl.project_id = ?');
		values.push(filters.project_id);
	}
	if (filters.blocked_item_id !== undefined) {
		conditions.push('bl.blocked_item_id = ?');
		values.push(filters.blocked_item_id);
	}
	if (filters.blocker_item_id !== undefined) {
		conditions.push('bl.blocker_item_id = ?');
		values.push(filters.blocker_item_id);
	}
	if (filters.status !== 'all') {
		conditions.push('bl.status = ?');
		values.push(filters.status ?? 'active');
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
	return db
		.prepare(
			`${workBlockerSelect()} ${where} ORDER BY bl.status ASC, bl.updated_at DESC, bl.id DESC LIMIT ?`
		)
		.all(...values, limit)
		.map(mapWorkBlockerLink);
}

export function getWorkBlockerLink(id: number): WorkBlockerLink | undefined {
	const db = getWorkDb();
	const row = db.prepare(`${workBlockerSelect()} WHERE bl.id = ?`).get(id);
	return row ? mapWorkBlockerLink(row) : undefined;
}

export function createWorkBlockerLink(data: CreateWorkBlockerLinkInput): WorkBlockerLink {
	const db = getWorkDb();
	const blockedItem = getWorkItem(data.blocked_item_id);
	if (!blockedItem) {
		throw new WorkError('WORK_NOT_FOUND', `Blocked Work item ${data.blocked_item_id} not found`);
	}
	const blockerSource = assertBlockerSource(data.blocker_source);
	let blockerItem: WorkItem | undefined;
	let externalLabel = data.external_label?.trim() || null;
	if (blockerSource === 'work_item') {
		if (!data.blocker_item_id) {
			throw new WorkError('WORK_CONSTRAINT', 'blocker_item_id is required for work_item blockers');
		}
		if (data.blocker_item_id === data.blocked_item_id) {
			throw new WorkError('WORK_CONSTRAINT', 'blocked_item_id cannot block itself');
		}
		blockerItem = getWorkItem(data.blocker_item_id);
		if (!blockerItem) {
			throw new WorkError('WORK_NOT_FOUND', `Blocker Work item ${data.blocker_item_id} not found`);
		}
		externalLabel = null;
	} else if (!externalLabel) {
		throw new WorkError('WORK_CONSTRAINT', 'external_label is required for external blockers');
	}

	const status = assertBlockerStatus(data.status ?? 'active');
	const projectId = resolveBlockerProjectId(data.project_id, blockedItem);
	assertNoActiveBlockerDuplicate({
		blocked_item_id: blockedItem.id,
		blocker_source: blockerSource,
		blocker_item_id: blockerItem?.id ?? null,
		external_label: externalLabel,
		status
	});
	const ts = now();
	const result = db
		.prepare(
			`INSERT INTO work_blocker_links
			 (project_id, blocked_item_id, blocker_source, blocker_item_id, external_label, reason,
			  unblock_action, status, created_at, updated_at, resolved_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			projectId,
			blockedItem.id,
			blockerSource,
			blockerItem?.id ?? null,
			externalLabel,
			trimOrNull(data.reason),
			trimOrNull(data.unblock_action),
			status,
			ts,
			ts,
			status === 'resolved' ? ts : null
		);
	const link = getWorkBlockerLink(result.lastInsertRowid as number)!;
	recordBlockerChange(link, 'created', data.actor ?? 'agent', data.source, 'Created blocker link');
	emitWorkEvent({ type: 'work.changed', entity: 'blocker', id: link.id });
	return link;
}

export function updateWorkBlockerLink(
	id: number,
	data: UpdateWorkBlockerLinkInput
): WorkBlockerLink | undefined {
	const current = getWorkBlockerLink(id);
	if (!current) return undefined;
	const db = getWorkDb();
	const updates = ['updated_at = ?'];
	const values: unknown[] = [now()];

	function set(column: string, value: unknown): void {
		updates.push(`${column} = ?`);
		values.push(value);
	}

	if (data.project_id !== undefined) {
		const blockedItem = getWorkItem(current.blocked_item_id);
		if (!blockedItem) throw new WorkError('WORK_NOT_FOUND', 'Blocked Work item not found');
		set('project_id', resolveBlockerProjectId(data.project_id, blockedItem));
	}
	if (data.external_label !== undefined) {
		if (current.blocker_source === 'work_item') {
			throw new WorkError('WORK_CONSTRAINT', 'work_item blockers cannot set external_label');
		}
		const label = data.external_label?.trim() || null;
		if (!label) throw new WorkError('WORK_CONSTRAINT', 'external_label is required');
		set('external_label', label);
	}
	if (data.reason !== undefined) set('reason', trimOrNull(data.reason));
	if (data.unblock_action !== undefined) set('unblock_action', trimOrNull(data.unblock_action));
	if (data.status !== undefined) {
		const status = assertBlockerStatus(data.status);
		set('status', status);
		set('resolved_at', status === 'resolved' ? (current.resolved_at ?? now()) : null);
	}

	values.push(id);
	db.prepare(`UPDATE work_blocker_links SET ${updates.join(', ')} WHERE id = ?`).run(...values);
	const updated = getWorkBlockerLink(id);
	if (!updated) return undefined;
	recordBlockerChange(
		updated,
		'updated',
		data.actor ?? 'agent',
		data.source,
		updated.status === 'resolved' ? 'Resolved blocker link' : 'Updated blocker link',
		diffWorkRecords(current, updated, blockerChangeFields)
	);
	emitWorkEvent({ type: 'work.changed', entity: 'blocker', id });
	return updated;
}

export function deleteWorkBlockerLink(id: number): WorkBlockerLink | undefined {
	const current = getWorkBlockerLink(id);
	if (!current) return undefined;
	const db = getWorkDb();
	db.prepare('DELETE FROM work_blocker_links WHERE id = ?').run(id);
	recordBlockerChange(current, 'deleted', 'agent', 'api', 'Deleted blocker link', [
		{ field: 'exists', label: 'Exists', from: true, to: false }
	]);
	emitWorkEvent({ type: 'work.changed', entity: 'blocker', id });
	return current;
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

export function listWorkChangeLog(
	filters: {
		project_id?: number;
		entity_type?: WorkChangeEntityType;
		entity_id?: string | number;
		area_id?: string;
		limit?: number;
	} = {}
): WorkChangeLogEntry[] {
	const db = getWorkDb();
	const conditions: string[] = [];
	const values: unknown[] = [];
	if (filters.project_id !== undefined) {
		conditions.push('project_id = ?');
		values.push(filters.project_id);
	}
	if (filters.entity_type) {
		conditions.push('entity_type = ?');
		values.push(filters.entity_type);
	}
	if (filters.entity_id !== undefined) {
		conditions.push('entity_id = ?');
		values.push(String(filters.entity_id));
	}
	if (filters.area_id) {
		conditions.push('area_id = ?');
		values.push(filters.area_id);
	}
	const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
	return db
		.prepare(`SELECT * FROM work_change_log ${where} ORDER BY occurred_at DESC, id DESC LIMIT ?`)
		.all(...values, limit)
		.map(mapWorkChangeLogEntry);
}

export function recordWorkChangeLog(data: WorkChangeLogInput): WorkChangeLogEntry {
	const db = getWorkDb();
	const occurredAt = now();
	const actor = data.actor ?? 'system';
	const source = data.source ?? sourceForActor(actor);
	const changes = data.changes ?? [];
	const metadata = data.metadata ?? {};
	const result = db
		.prepare(
			`INSERT INTO work_change_log
			 (occurred_at, actor, source, entity_type, entity_id, entity_title, action, project_id,
			  parent_item_id, area_id, summary, changes_json, metadata_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			occurredAt,
			actor,
			source,
			data.entity_type,
			String(data.entity_id),
			data.entity_title ?? null,
			data.action,
			data.project_id ?? null,
			data.parent_item_id ?? null,
			data.area_id ?? null,
			data.summary,
			JSON.stringify(changes),
			JSON.stringify(metadata)
		);
	return mapWorkChangeLogEntry({
		id: result.lastInsertRowid as number,
		occurred_at: occurredAt,
		actor,
		source,
		entity_type: data.entity_type,
		entity_id: String(data.entity_id),
		entity_title: data.entity_title ?? null,
		action: data.action,
		project_id: data.project_id ?? null,
		parent_item_id: data.parent_item_id ?? null,
		area_id: data.area_id ?? null,
		summary: data.summary,
		changes_json: JSON.stringify(changes),
		metadata_json: JSON.stringify(metadata)
	});
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
	if (data.work_item_id) {
		const item = getWorkItem(data.work_item_id);
		if (item) {
			recordWorkItemChange(item, 'attached', 'system', 'api', 'Attached evidence', [], {
				source_type: data.source_type,
				source_ref: data.source_ref,
				summary: data.summary ?? null
			});
		}
	}
	emitWorkEvent({ type: 'work.changed', entity: 'evidence', id: data.source_ref });
}

function workItemSelect(): string {
	return `
		SELECT
			wi.*,
			CASE
				WHEN wa.parent_area_id IS NULL THEN wi.area_id
				ELSE wa.parent_area_id
			END AS category_id,
			CASE
				WHEN wa.parent_area_id IS NULL THEN NULL
				ELSE wi.area_id
			END AS subcategory_id,
			p.goal, p.definition_of_done, p.why_it_matters, p.scope, p.non_scope, p.health,
			p.operator, p.start_date, p.target_date, p.actual_completed_date,
			p.current_next_step_id, p.last_meaningful_update_at,
			m.marker AS milestone_marker,
			ns.action AS next_step_action,
			oq.question_text, oq.why_it_matters AS question_why_it_matters, oq.answerer,
			oq.blocked_item_id, oq.proposed_answer, oq.answer, oq.answered_at,
			d.decision_question, d.options_json, d.recommended_option,
			d.consequence_of_no_decision, d.decision, d.decided_by, d.decided_at,
			cr.scope AS change_scope, cr.systems_touched_json, cr.risk, cr.rollback_notes,
			cr.verification_plan, cr.approval_state, cr.execution_state,
			a.trigger_type, a.schedule, a.enabled, a.last_run_at, a.next_run_at, a.last_result,
			a.failure_count, a.generated_work_policy, a.backing_ref,
			f.finding_text, f.source_refs_json
		FROM work_items wi
		LEFT JOIN work_areas wa ON wa.id = wi.area_id
		LEFT JOIN work_project_details p ON p.work_item_id = wi.id
		LEFT JOIN work_milestone_details m ON m.work_item_id = wi.id
		LEFT JOIN work_next_step_details ns ON ns.work_item_id = wi.id
		LEFT JOIN work_open_question_details oq ON oq.work_item_id = wi.id
		LEFT JOIN work_decision_details d ON d.work_item_id = wi.id
		LEFT JOIN work_change_request_details cr ON cr.work_item_id = wi.id
		LEFT JOIN work_automation_details a ON a.work_item_id = wi.id
		LEFT JOIN work_finding_details f ON f.work_item_id = wi.id
		`;
}

function workBlockerSelect(): string {
	return `
		SELECT
			bl.*,
			blocked.title AS blocked_item_title,
			blocked.type AS blocked_item_type,
			blocker.title AS blocker_item_title,
			blocker.type AS blocker_item_type
		FROM work_blocker_links bl
		LEFT JOIN work_items blocked ON blocked.id = bl.blocked_item_id
		LEFT JOIN work_items blocker ON blocker.id = bl.blocker_item_id
	`;
}

function mapWorkItem(row: unknown): WorkItem {
	const item = row as WorkItem & {
		options_json?: string | null;
		systems_touched_json?: string | null;
		source_refs_json?: string | null;
		question_why_it_matters?: string | null;
	};
	if (item.question_why_it_matters && !item.why_it_matters) {
		item.why_it_matters = item.question_why_it_matters;
	}
	item.options = parseJsonArray(item.options_json);
	item.systems_touched = parseJsonArray(item.systems_touched_json);
	item.source_refs = parseJsonArray(item.source_refs_json);
	return item;
}

function mapWorkBlockerLink(row: unknown): WorkBlockerLink {
	const link = row as WorkBlockerLink;
	return {
		id: link.id,
		project_id: link.project_id,
		blocked_item_id: link.blocked_item_id,
		blocked_item_title: link.blocked_item_title,
		blocked_item_type: link.blocked_item_type,
		blocker_source: link.blocker_source,
		blocker_item_id: link.blocker_item_id,
		blocker_item_title: link.blocker_item_title,
		blocker_item_type: link.blocker_item_type,
		external_label: link.external_label,
		reason: link.reason,
		unblock_action: link.unblock_action,
		status: link.status,
		created_at: link.created_at,
		updated_at: link.updated_at,
		resolved_at: link.resolved_at
	};
}

function validateTypedDetails(
	type: WorkItemType,
	data: CreateWorkItemInput | UpdateWorkItemInput,
	allowPartial = false
): void {
	const migration = data.actor === 'migration' || data.actor === 'system';
	if (migration) return;
	if (type === 'open_question') {
		requireText(data.question_text, 'question_text', allowPartial);
		requireText(data.why_it_matters, 'why_it_matters', allowPartial);
		requireText(data.answerer, 'answerer', allowPartial);
	}
	if (type === 'decision') {
		requireText(data.decision_question ?? data.title, 'decision_question', allowPartial);
		if (!allowPartial && normalizeArray(data.options).length < 2) {
			throw new WorkError('WORK_CONSTRAINT', 'decision options require at least two choices');
		}
		requireText(data.recommended_option, 'recommended_option', allowPartial);
		requireText(data.consequence_of_no_decision, 'consequence_of_no_decision', allowPartial);
	}
	if (type === 'change_request') {
		requireText(data.change_scope ?? data.scope, 'change_scope', allowPartial);
		requireText(data.risk, 'risk', allowPartial);
		requireText(data.verification_plan, 'verification_plan', allowPartial);
	}
	if (type === 'automation') {
		requireText(data.trigger_type, 'trigger_type', allowPartial);
	}
}

function upsertTypedDetails(
	id: number,
	type: WorkItemType,
	data: CreateWorkItemInput | UpdateWorkItemInput
): void {
	const db = getWorkDb();
	if (type === 'project') {
		db.prepare(
			`INSERT INTO work_project_details
			 (work_item_id, goal, definition_of_done, why_it_matters, scope, non_scope, health,
			  operator, start_date, target_date, actual_completed_date, current_next_step_id,
			  last_meaningful_update_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(work_item_id) DO UPDATE SET
			   goal = excluded.goal,
			   definition_of_done = excluded.definition_of_done,
			   why_it_matters = excluded.why_it_matters,
			   scope = excluded.scope,
			   non_scope = excluded.non_scope,
			   health = excluded.health,
			   operator = excluded.operator,
			   start_date = excluded.start_date,
			   target_date = excluded.target_date,
			   actual_completed_date = excluded.actual_completed_date,
			   current_next_step_id = excluded.current_next_step_id,
			   last_meaningful_update_at = excluded.last_meaningful_update_at`
		).run(
			id,
			firstText(data.goal, data.description, data.title),
			firstText(data.definition_of_done, data.next_action, 'Complete the project outcome'),
			data.why_it_matters ?? data.body ?? null,
			data.scope ?? data.description ?? null,
			data.non_scope ?? null,
			data.health ?? 'unknown',
			data.operator ?? data.owner ?? null,
			data.start_date ?? null,
			data.target_date ?? data.due_date ?? null,
			data.actual_completed_date ?? null,
			data.current_next_step_id ?? null,
			data.last_meaningful_update_at ?? data.last_activity_at ?? null
		);
		return;
	}
	if (type === 'milestone') {
		db.prepare(
			`INSERT INTO work_milestone_details (work_item_id, marker, target_date, completed_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(work_item_id) DO UPDATE SET
			   marker = excluded.marker,
			   target_date = excluded.target_date,
			   completed_at = excluded.completed_at`
		).run(
			id,
			data.milestone_marker ?? data.next_action ?? data.title ?? null,
			data.target_date ?? data.due_date ?? null,
			data.answered_at ?? null
		);
		return;
	}
	if (type === 'next_step') {
		db.prepare(
			`INSERT INTO work_next_step_details (work_item_id, action)
			 VALUES (?, ?)
			 ON CONFLICT(work_item_id) DO UPDATE SET action = excluded.action`
		).run(id, data.next_step_action ?? data.next_action ?? data.title ?? null);
		return;
	}
	if (type === 'open_question') {
		db.prepare(
			`INSERT INTO work_open_question_details
			 (work_item_id, question_text, why_it_matters, answerer, blocked_item_id, proposed_answer,
			  answer, answered_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(work_item_id) DO UPDATE SET
			   question_text = excluded.question_text,
			   why_it_matters = excluded.why_it_matters,
			   answerer = excluded.answerer,
			   blocked_item_id = excluded.blocked_item_id,
			   proposed_answer = excluded.proposed_answer,
			   answer = excluded.answer,
			   answered_at = excluded.answered_at`
		).run(
			id,
			data.question_text ?? data.title,
			data.why_it_matters ?? data.description ?? 'Clarifies related work.',
			data.answerer ?? data.waiting_on ?? data.owner ?? 'operator',
			data.blocked_item_id ?? data.parent_item_id ?? null,
			data.proposed_answer ?? data.next_action ?? null,
			data.answer ?? data.result ?? null,
			data.answered_at ?? null
		);
		return;
	}
	if (type === 'decision') {
		db.prepare(
			`INSERT INTO work_decision_details
			 (work_item_id, decision_question, options_json, recommended_option,
			  consequence_of_no_decision, decision, decided_by, decided_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(work_item_id) DO UPDATE SET
			   decision_question = excluded.decision_question,
			   options_json = excluded.options_json,
			   recommended_option = excluded.recommended_option,
			   consequence_of_no_decision = excluded.consequence_of_no_decision,
			   decision = excluded.decision,
			   decided_by = excluded.decided_by,
			   decided_at = excluded.decided_at`
		).run(
			id,
			data.decision_question ?? data.title,
			JSON.stringify(
				normalizeArray(data.options).length ? normalizeArray(data.options) : ['Approve', 'Defer']
			),
			data.recommended_option ?? data.next_action ?? 'Approve',
			data.consequence_of_no_decision ?? data.description ?? 'Related work remains waiting.',
			data.decision ?? data.result ?? null,
			data.decided_by ?? data.owner ?? null,
			data.decided_at ?? null
		);
		return;
	}
	if (type === 'change_request') {
		db.prepare(
			`INSERT INTO work_change_request_details
			 (work_item_id, scope, systems_touched_json, risk, rollback_notes, verification_plan,
			  approval_state, execution_state)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(work_item_id) DO UPDATE SET
			   scope = excluded.scope,
			   systems_touched_json = excluded.systems_touched_json,
			   risk = excluded.risk,
			   rollback_notes = excluded.rollback_notes,
			   verification_plan = excluded.verification_plan,
			   approval_state = excluded.approval_state,
			   execution_state = excluded.execution_state`
		).run(
			id,
			data.change_scope ?? data.scope ?? data.description ?? data.title,
			JSON.stringify(normalizeArray(data.systems_touched)),
			data.risk ?? data.priority ?? 'normal',
			data.rollback_notes ?? null,
			data.verification_plan ?? data.next_action ?? 'Verify the requested change.',
			data.approval_state ?? (toApprovalFlag(data.approval_required) ? 'required' : 'not_required'),
			data.execution_state ?? data.status ?? 'planning'
		);
		return;
	}
	if (type === 'automation') {
		db.prepare(
			`INSERT INTO work_automation_details
			 (work_item_id, trigger_type, schedule, enabled, last_run_at, next_run_at, last_result,
			  failure_count, generated_work_policy, backing_ref)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(work_item_id) DO UPDATE SET
			   trigger_type = excluded.trigger_type,
			   schedule = excluded.schedule,
			   enabled = excluded.enabled,
			   last_run_at = excluded.last_run_at,
			   next_run_at = excluded.next_run_at,
			   last_result = excluded.last_result,
			   failure_count = excluded.failure_count,
			   generated_work_policy = excluded.generated_work_policy,
			   backing_ref = excluded.backing_ref`
		).run(
			id,
			data.trigger_type ?? 'heartbeat',
			data.schedule ?? data.stale_after ?? data.scheduled_at ?? null,
			data.enabled ?? 1,
			data.last_run_at ?? null,
			data.next_run_at ?? null,
			data.last_result ?? data.result ?? null,
			data.failure_count ?? 0,
			data.generated_work_policy ?? data.next_action ?? null,
			data.backing_ref ?? null
		);
		return;
	}
	if (type === 'finding') {
		db.prepare(
			`INSERT INTO work_finding_details (work_item_id, finding_text, source_refs_json)
			 VALUES (?, ?, ?)
			 ON CONFLICT(work_item_id) DO UPDATE SET
			   finding_text = excluded.finding_text,
			   source_refs_json = excluded.source_refs_json`
		).run(
			id,
			data.finding_text ?? data.description ?? data.body ?? data.title ?? null,
			JSON.stringify(normalizeArray(data.source_refs))
		);
	}
}

function requireText(value: unknown, name: string, allowPartial: boolean): void {
	if (allowPartial && value === undefined) return;
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new WorkError('WORK_CONSTRAINT', `${name} is required`);
	}
}

function normalizeArray(value: unknown): string[] {
	if (Array.isArray(value))
		return value.filter((entry): entry is string => typeof entry === 'string');
	if (typeof value === 'string' && value.trim()) return [value];
	return [];
}

function parseJsonArray(value: string | null | undefined): string[] | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((entry): entry is string => typeof entry === 'string')
			: null;
	} catch {
		return null;
	}
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
	if (!value) return {};
	try {
		const parsed = JSON.parse(value) as unknown;
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function parseJsonChanges(value: string | null | undefined): WorkChange[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((entry): entry is WorkChange => {
			return (
				Boolean(entry) &&
				typeof entry === 'object' &&
				typeof (entry as WorkChange).field === 'string' &&
				typeof (entry as WorkChange).label === 'string'
			);
		});
	} catch {
		return [];
	}
}

function mapWorkChangeLogEntry(row: unknown): WorkChangeLogEntry {
	const entry = row as WorkChangeLogEntry & {
		changes_json?: string | null;
		metadata_json?: string | null;
	};
	return {
		id: entry.id,
		occurred_at: entry.occurred_at,
		actor: entry.actor,
		source: entry.source,
		entity_type: entry.entity_type,
		entity_id: entry.entity_id,
		entity_title: entry.entity_title,
		action: entry.action,
		project_id: entry.project_id,
		parent_item_id: entry.parent_item_id,
		area_id: entry.area_id,
		summary: entry.summary,
		changes: parseJsonChanges(entry.changes_json),
		metadata: parseJsonObject(entry.metadata_json)
	};
}

const categoryChangeFields: Array<[keyof WorkArea, string]> = [
	['title', 'Name'],
	['description', 'Notes'],
	['parent_area_id', 'Parent category'],
	['status', 'Status']
];

const itemChangeFields: Array<[keyof WorkItem, string]> = [
	['type', 'Type'],
	['parent_item_id', 'Parent'],
	['area_id', 'Category assignment'],
	['category_id', 'Category'],
	['subcategory_id', 'Subcategory'],
	['title', 'Title'],
	['description', 'Description'],
	['body', 'Notes'],
	['status', 'Status'],
	['owner', 'Owner'],
	['waiting_on', 'Waiting on'],
	['priority', 'Priority'],
	['next_action', 'Next action'],
	['approval_required', 'Approval required'],
	['due_date', 'Due date'],
	['scheduled_at', 'Scheduled for'],
	['stale_after', 'Stale after'],
	['result', 'Result'],
	['goal', 'Goal'],
	['definition_of_done', 'Definition of done'],
	['why_it_matters', 'Why it matters'],
	['scope', 'Scope'],
	['non_scope', 'Out of scope'],
	['health', 'Health'],
	['operator', 'Operator'],
	['start_date', 'Start date'],
	['target_date', 'Target date'],
	['actual_completed_date', 'Completed date'],
	['current_next_step_id', 'Current next step'],
	['milestone_marker', 'Milestone marker'],
	['next_step_action', 'Action'],
	['question_text', 'Question'],
	['answerer', 'Can answer'],
	['blocked_item_id', 'Blocked item'],
	['proposed_answer', 'Proposed answer'],
	['answer', 'Answer'],
	['answered_at', 'Answered at'],
	['decision_question', 'Decision question'],
	['options', 'Options'],
	['recommended_option', 'Recommendation'],
	['consequence_of_no_decision', 'No-decision consequence'],
	['decision', 'Decision answer'],
	['decided_by', 'Decided by'],
	['decided_at', 'Decided at'],
	['change_scope', 'Change scope'],
	['systems_touched', 'Systems touched'],
	['risk', 'Risk'],
	['rollback_notes', 'Rollback notes'],
	['verification_plan', 'Verification plan'],
	['approval_state', 'Approval state'],
	['execution_state', 'Execution state'],
	['trigger_type', 'Trigger'],
	['schedule', 'Schedule'],
	['enabled', 'Enabled'],
	['last_run_at', 'Last run'],
	['next_run_at', 'Next run'],
	['last_result', 'Last result'],
	['failure_count', 'Failure count'],
	['generated_work_policy', 'Generated work policy'],
	['backing_ref', 'Backing system'],
	['finding_text', 'Finding'],
	['source_refs', 'Sources']
];

const blockerChangeFields: Array<[keyof WorkBlockerLink, string]> = [
	['project_id', 'Project'],
	['blocked_item_id', 'Blocked item'],
	['blocker_source', 'Blocker source'],
	['blocker_item_id', 'Blocker item'],
	['external_label', 'External blocker'],
	['reason', 'Reason'],
	['unblock_action', 'Unblock action'],
	['status', 'Status'],
	['resolved_at', 'Resolved at']
];

function diffWorkRecords<T extends object>(
	before: T,
	after: T,
	fields: Array<[keyof T, string]>
): WorkChange[] {
	const changes: WorkChange[] = [];
	const beforeRecord = before as Record<PropertyKey, unknown>;
	const afterRecord = after as Record<PropertyKey, unknown>;
	for (const [field, label] of fields) {
		const from = normalizeChangeValue(beforeRecord[field]);
		const to = normalizeChangeValue(afterRecord[field]);
		if (!sameChangeValue(from, to)) {
			changes.push({ field: String(field), label, from, to });
		}
	}
	return changes;
}

function normalizeChangeValue(value: unknown): unknown {
	if (value === undefined) return null;
	if (Array.isArray(value)) return value.map((entry) => normalizeChangeValue(entry));
	if (typeof value === 'string') return value.trim() ? value : null;
	return value;
}

function sameChangeValue(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function recordWorkItemChange(
	item: WorkItem,
	action: WorkChangeAction,
	actor: string,
	source: string | undefined,
	summary: string,
	changes: WorkChange[] = [],
	metadata: Record<string, unknown> = {}
): void {
	recordWorkChangeLog({
		actor,
		source,
		entity_type: item.type,
		entity_id: item.id,
		entity_title: item.title,
		action,
		project_id: projectIdForItem(item),
		parent_item_id: item.parent_item_id,
		area_id: item.area_id,
		summary,
		changes,
		metadata: {
			status: item.status,
			priority: item.priority,
			...metadata
		}
	});
}

function recordBlockerChange(
	link: WorkBlockerLink,
	action: WorkChangeAction,
	actor: string,
	source: string | undefined,
	summary: string,
	changes: WorkChange[] = []
): void {
	recordWorkChangeLog({
		actor,
		source,
		entity_type: 'blocker',
		entity_id: link.id,
		entity_title: blockerLinkTitle(link),
		action,
		project_id: link.project_id,
		parent_item_id: link.blocked_item_id,
		summary,
		changes,
		metadata: {
			blocked_item_id: link.blocked_item_id,
			blocker_source: link.blocker_source,
			blocker_item_id: link.blocker_item_id,
			external_label: link.external_label,
			status: link.status
		}
	});
}

function blockerLinkTitle(link: WorkBlockerLink): string {
	const blocked = link.blocked_item_title ?? `Work item ${link.blocked_item_id}`;
	const blocker =
		link.blocker_source === 'work_item'
			? (link.blocker_item_title ?? `Work item ${link.blocker_item_id}`)
			: (link.external_label ?? link.blocker_source);
	return `${blocked} blocked by ${blocker}`;
}

function resolveBlockerProjectId(
	projectId: number | null | undefined,
	blockedItem: WorkItem
): number | null {
	if (projectId !== undefined) {
		if (projectId === null) return null;
		const project = getWorkItem(projectId);
		if (!project || project.type !== 'project') {
			throw new WorkError('WORK_NOT_FOUND', `Project ${projectId} not found`);
		}
		return project.id;
	}
	return projectIdForItem(blockedItem);
}

function assertNoActiveBlockerDuplicate(data: {
	blocked_item_id: number;
	blocker_source: WorkBlockerSource;
	blocker_item_id: number | null;
	external_label: string | null;
	status: WorkBlockerStatus;
}): void {
	if (data.status !== 'active') return;
	const db = getWorkDb();
	const existing =
		data.blocker_source === 'work_item'
			? db
					.prepare(
						`SELECT id FROM work_blocker_links
						 WHERE blocked_item_id = ?
						   AND blocker_source = 'work_item'
						   AND blocker_item_id = ?
						   AND status = 'active'`
					)
					.get(data.blocked_item_id, data.blocker_item_id)
			: db
					.prepare(
						`SELECT id FROM work_blocker_links
						 WHERE blocked_item_id = ?
						   AND blocker_source = ?
						   AND external_label = ?
						   AND status = 'active'`
					)
					.get(data.blocked_item_id, data.blocker_source, data.external_label);
	if (existing) throw new WorkError('WORK_DUPLICATE', 'Active blocker link already exists');
}

function projectIdForItem(item: WorkItem): number | null {
	if (item.type === 'project') return item.id;
	let cursor = item.parent_item_id ? getWorkItem(item.parent_item_id) : undefined;
	const seen = new Set<number>([item.id]);
	while (cursor && !seen.has(cursor.id)) {
		if (cursor.type === 'project') return cursor.id;
		seen.add(cursor.id);
		cursor = cursor.parent_item_id ? getWorkItem(cursor.parent_item_id) : undefined;
	}
	return null;
}

function actionForItemChanges(
	before: WorkItem,
	after: WorkItem,
	changes: WorkChange[]
): WorkChangeAction {
	if (before.status !== 'complete' && after.status === 'complete') return 'completed';
	if (after.type === 'open_question' && changes.some((change) => change.field === 'answer')) {
		return 'answered';
	}
	if (after.type === 'decision' && changes.some((change) => change.field === 'decision')) {
		return 'answered';
	}
	if (
		after.type === 'change_request' &&
		changes.some((change) => change.field === 'approval_state')
	) {
		return 'approved';
	}
	if (
		changes.some((change) =>
			['parent_item_id', 'area_id', 'category_id', 'subcategory_id'].includes(change.field)
		)
	) {
		return 'moved';
	}
	return 'updated';
}

function summarizeChangeLog(changes: WorkChange[], fallback: string): string {
	if (!changes.length) return fallback;
	return changes
		.slice(0, 3)
		.map(
			(change) =>
				`${change.label}: ${formatChangeValue(change.from)} -> ${formatChangeValue(change.to)}`
		)
		.join('; ');
}

function formatChangeValue(value: unknown): string {
	if (value === null || value === undefined || value === '') return 'None';
	if (Array.isArray(value)) return value.length ? value.join(', ') : 'None';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	return String(value);
}

function sourceForActor(actor: string): string {
	if (actor === 'migration') return 'migration';
	if (actor === 'agent') return 'agent';
	if (actor === 'automation') return 'automation';
	if (actor === 'operator') return 'ui';
	if (actor === 'system') return 'system';
	return 'api';
}

function toApprovalFlag(value: boolean | number | undefined): number {
	return value === true || value === 1 ? 1 : 0;
}

function firstText(...values: Array<string | null | undefined>): string | null {
	return values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? null;
}

function trimOrNull(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function syncImplicitBlockerLinksForItem(item: WorkItem): void {
	syncOpenQuestionBlockerLink(item);
	syncWaitingBlockerLink(item);
}

function syncOpenQuestionBlockerLink(item: WorkItem): void {
	if (item.type !== 'open_question') return;
	const activeLinks = listWorkBlockerLinks({
		blocker_item_id: item.id,
		status: 'active',
		limit: 50
	}).filter((link) => link.blocker_source === 'work_item');
	const shouldLink =
		item.blocked_item_id !== null &&
		item.blocked_item_id !== undefined &&
		item.blocked_item_id !== item.id &&
		!isClosedStatus(item.status);
	for (const link of activeLinks) {
		if (!shouldLink || link.blocked_item_id !== item.blocked_item_id) {
			updateWorkBlockerLink(link.id, { status: 'resolved', actor: 'system', source: 'system' });
		}
	}
	if (!shouldLink) return;
	tryCreateImplicitBlockerLink({
		blocked_item_id: item.blocked_item_id!,
		blocker_source: 'work_item',
		blocker_item_id: item.id,
		reason: firstText(item.why_it_matters, item.description, item.title),
		unblock_action: firstText(
			item.proposed_answer,
			item.next_action,
			item.question_text,
			item.title
		),
		actor: 'system',
		source: 'system'
	});
}

function syncWaitingBlockerLink(item: WorkItem): void {
	const activeExternalLinks = listWorkBlockerLinks({
		blocked_item_id: item.id,
		status: 'active',
		limit: 50
	}).filter((link) => link.blocker_source !== 'work_item');
	const waitingOn = trimOrNull(item.waiting_on);
	const shouldLink = ['blocked', 'waiting'].includes(item.status) && Boolean(waitingOn);
	if (!shouldLink) {
		for (const link of activeExternalLinks) {
			updateWorkBlockerLink(link.id, { status: 'resolved', actor: 'system', source: 'system' });
		}
		return;
	}
	const blockerSource = sourceForWaitingOn(waitingOn!);
	const externalLabel = labelForWaitingOn(waitingOn!);
	for (const link of activeExternalLinks) {
		if (link.blocker_source !== blockerSource || link.external_label !== externalLabel) {
			updateWorkBlockerLink(link.id, { status: 'resolved', actor: 'system', source: 'system' });
		}
	}
	tryCreateImplicitBlockerLink({
		blocked_item_id: item.id,
		blocker_source: blockerSource,
		external_label: externalLabel,
		reason:
			item.status === 'blocked'
				? 'This work is marked blocked.'
				: `This work is waiting on ${waitingOn}.`,
		unblock_action: firstText(item.next_action, item.next_step_action, item.title),
		actor: 'system',
		source: 'system'
	});
}

function tryCreateImplicitBlockerLink(data: CreateWorkBlockerLinkInput): void {
	try {
		createWorkBlockerLink(data);
	} catch (err) {
		if (err instanceof WorkError && err.code === 'WORK_DUPLICATE') return;
		throw err;
	}
}

function isClosedStatus(status: WorkStatus): boolean {
	return status === 'complete' || status === 'cancelled' || status === 'archived';
}

function sourceForWaitingOn(value: string): WorkBlockerSource {
	if (value === 'system') return 'system';
	if (value === 'external') return 'external';
	return 'person';
}

function labelForWaitingOn(value: string): string {
	if (value === 'operator' || value === 'me') return 'Operator';
	if (value === 'agent') return 'Agent';
	if (value === 'fred') return 'Fred';
	if (value === 'system') return 'System';
	if (value === 'external') return 'External party';
	return value;
}

function mapWorkCategory(area: WorkArea): WorkCategory {
	return {
		id: area.id,
		title: area.title,
		description: area.description,
		parent_category_id: area.parent_area_id,
		status: area.status,
		kind: area.parent_area_id ? 'subcategory' : 'category',
		created_at: area.created_at,
		updated_at: area.updated_at
	};
}

function categoryIdFor(
	kind: WorkCategoryKind,
	title: string,
	parentCategoryId: string | null | undefined
): string {
	const prefix = kind === 'category' ? 'category' : 'subcategory';
	const parentPrefix = parentCategoryId ? `${slugify(parentCategoryId)}-` : '';
	return `${prefix}:${parentPrefix}${slugify(title)}`;
}

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return slug || 'untitled';
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
	if (type === 'open_question' || type === 'decision') return 'needs_review';
	if (type === 'automation') return 'scheduled';
	if (type === 'finding') return 'complete';
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
