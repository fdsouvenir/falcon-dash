import { writable } from 'svelte/store';
import { gateway } from '$lib/gateway';
import type {
	PmDomain,
	PmFocus,
	PmMilestone,
	PmProject,
	PmTask,
	PmComment,
	PmBlock,
	PmAttachment,
	PmActivity,
	PmStats,
	PmEvent,
	PmSearchParams,
	PmSearchResult,
	PmBulkUpdateParams,
	PmBulkUpdateResponse,
	PmBulkMoveParams,
	PmBulkMoveResponse,
	PmDomainListResponse,
	PmDomainCreateParams,
	PmDomainUpdateParams,
	PmDomainReorderParams,
	PmFocusListParams,
	PmFocusListResponse,
	PmFocusCreateParams,
	PmFocusUpdateParams,
	PmFocusMoveParams,
	PmFocusReorderParams,
	PmMilestoneListResponse,
	PmMilestoneCreateParams,
	PmMilestoneUpdateParams,
	PmProjectListParams,
	PmProjectListResponse,
	PmProjectCreateParams,
	PmProjectUpdateParams,
	PmTaskListParams,
	PmTaskListResponse,
	PmTaskCreateParams,
	PmTaskUpdateParams,
	PmTaskMoveParams,
	PmTaskReorderParams,
	PmCommentListParams,
	PmCommentListResponse,
	PmCommentCreateParams,
	PmCommentUpdateParams,
	PmBlockListParams,
	PmBlockListResponse,
	PmBlockCreateParams,
	PmBlockDeleteParams,
	PmAttachmentListParams,
	PmAttachmentListResponse,
	PmAttachmentCreateParams,
	PmActivityListParams,
	PmActivityListResponse
} from '$lib/types/pm';

// --- Entity Stores ---

export const pmDomains = writable<PmDomain[]>([]);
export const pmFocuses = writable<PmFocus[]>([]);
export const pmMilestones = writable<PmMilestone[]>([]);
export const pmProjects = writable<PmProject[]>([]);
export const pmTasks = writable<PmTask[]>([]);
export const pmComments = writable<PmComment[]>([]);
export const pmActivities = writable<PmActivity[]>([]);
export const pmStats = writable<PmStats | null>(null);

/** Tracks the latest PM state version for gap detection */
let pmStateVersion = 0;

// --- Domain CRUD ---

export async function loadDomains(): Promise<void> {
	const response = await gateway.call<PmDomainListResponse>('pm.domain.list');
	pmDomains.set(response.domains);
}

export async function createDomain(params: PmDomainCreateParams): Promise<void> {
	const optimistic: PmDomain = {
		id: params.id,
		name: params.name,
		description: params.description,
		createdAt: Date.now()
	};
	pmDomains.update((list) => [...list, optimistic]);
	try {
		await gateway.call('pm.domain.create', params as unknown as Record<string, unknown>);
	} catch (err) {
		pmDomains.update((list) => list.filter((d) => d.id !== params.id));
		throw err;
	}
}

export async function updateDomain(params: PmDomainUpdateParams): Promise<void> {
	let prev: PmDomain | undefined;
	pmDomains.update((list) =>
		list.map((d) => {
			if (d.id === params.id) {
				prev = d;
				return { ...d, ...params };
			}
			return d;
		})
	);
	try {
		await gateway.call('pm.domain.update', params as unknown as Record<string, unknown>);
	} catch (err) {
		if (prev) {
			pmDomains.update((list) => list.map((d) => (d.id === params.id ? prev! : d)));
		}
		throw err;
	}
}

export async function deleteDomain(id: string): Promise<void> {
	await gateway.call('pm.domain.delete', { id });
	pmDomains.update((list) => list.filter((d) => d.id !== id));
}

export async function reorderDomains(params: PmDomainReorderParams): Promise<void> {
	await gateway.call('pm.domain.reorder', params as unknown as Record<string, unknown>);
	await loadDomains();
}

// --- Focus CRUD ---

export async function loadFocuses(domainId?: string): Promise<void> {
	const params: PmFocusListParams = domainId ? { domainId } : {};
	const response = await gateway.call<PmFocusListResponse>(
		'pm.focus.list',
		params as unknown as Record<string, unknown>
	);
	if (domainId) {
		pmFocuses.update((list) => {
			const other = list.filter((f) => f.domainId !== domainId);
			return [...other, ...response.focuses];
		});
	} else {
		pmFocuses.set(response.focuses);
	}
}

export async function createFocus(params: PmFocusCreateParams): Promise<void> {
	const optimistic: PmFocus = {
		id: params.id,
		domainId: params.domainId,
		name: params.name,
		description: params.description,
		createdAt: Date.now()
	};
	pmFocuses.update((list) => [...list, optimistic]);
	try {
		await gateway.call('pm.focus.create', params as unknown as Record<string, unknown>);
	} catch (err) {
		pmFocuses.update((list) => list.filter((f) => f.id !== params.id));
		throw err;
	}
}

export async function updateFocus(params: PmFocusUpdateParams): Promise<void> {
	let prev: PmFocus | undefined;
	pmFocuses.update((list) =>
		list.map((f) => {
			if (f.id === params.id) {
				prev = f;
				return { ...f, ...params };
			}
			return f;
		})
	);
	try {
		await gateway.call('pm.focus.update', params as unknown as Record<string, unknown>);
	} catch (err) {
		if (prev) {
			pmFocuses.update((list) => list.map((f) => (f.id === params.id ? prev! : f)));
		}
		throw err;
	}
}

export async function moveFocus(params: PmFocusMoveParams): Promise<void> {
	let prev: PmFocus | undefined;
	pmFocuses.update((list) =>
		list.map((f) => {
			if (f.id === params.id) {
				prev = f;
				return { ...f, domainId: params.domainId };
			}
			return f;
		})
	);
	try {
		await gateway.call('pm.focus.move', params as unknown as Record<string, unknown>);
	} catch (err) {
		if (prev) {
			pmFocuses.update((list) => list.map((f) => (f.id === params.id ? prev! : f)));
		}
		throw err;
	}
}

export async function deleteFocus(id: string): Promise<void> {
	await gateway.call('pm.focus.delete', { id });
	pmFocuses.update((list) => list.filter((f) => f.id !== id));
}

export async function reorderFocuses(params: PmFocusReorderParams): Promise<void> {
	await gateway.call('pm.focus.reorder', params as unknown as Record<string, unknown>);
	await loadFocuses(params.domainId);
}

// --- Milestone CRUD ---

export async function loadMilestones(): Promise<void> {
	const response = await gateway.call<PmMilestoneListResponse>('pm.milestone.list');
	pmMilestones.set(response.milestones);
}

export async function createMilestone(params: PmMilestoneCreateParams): Promise<void> {
	await gateway.call('pm.milestone.create', params as unknown as Record<string, unknown>);
	await loadMilestones();
}

export async function updateMilestone(params: PmMilestoneUpdateParams): Promise<void> {
	await gateway.call('pm.milestone.update', params as unknown as Record<string, unknown>);
	await loadMilestones();
}

export async function deleteMilestone(id: number): Promise<void> {
	await gateway.call('pm.milestone.delete', { id });
	pmMilestones.update((list) => list.filter((m) => m.id !== id));
}

// --- Project CRUD ---

export async function loadProjects(filters?: PmProjectListParams): Promise<void> {
	const response = await gateway.call<PmProjectListResponse>(
		'pm.project.list',
		filters as unknown as Record<string, unknown>
	);
	pmProjects.set(response.projects);
}

export async function createProject(params: PmProjectCreateParams): Promise<PmProject> {
	const result = await gateway.call<PmProject>(
		'pm.project.create',
		params as unknown as Record<string, unknown>
	);
	pmProjects.update((list) => [...list, result]);
	return result;
}

export async function updateProject(params: PmProjectUpdateParams): Promise<void> {
	let prev: PmProject | undefined;
	pmProjects.update((list) =>
		list.map((p) => {
			if (p.id === params.id) {
				prev = p;
				return { ...p, ...params, updatedAt: Date.now() };
			}
			return p;
		})
	);
	try {
		await gateway.call('pm.project.update', params as unknown as Record<string, unknown>);
	} catch (err) {
		if (prev) {
			pmProjects.update((list) => list.map((p) => (p.id === params.id ? prev! : p)));
		}
		throw err;
	}
}

export async function deleteProject(id: number): Promise<void> {
	await gateway.call('pm.project.delete', { id });
	pmProjects.update((list) => list.filter((p) => p.id !== id));
}

// --- Task CRUD ---

export async function loadTasks(projectId: number): Promise<void> {
	const params: PmTaskListParams = { projectId };
	const response = await gateway.call<PmTaskListResponse>(
		'pm.task.list',
		params as unknown as Record<string, unknown>
	);
	pmTasks.update((list) => {
		const other = list.filter((t) => t.parentProjectId !== projectId);
		return [...other, ...response.tasks];
	});
}

export async function createTask(params: PmTaskCreateParams): Promise<PmTask> {
	const result = await gateway.call<PmTask>(
		'pm.task.create',
		params as unknown as Record<string, unknown>
	);
	pmTasks.update((list) => [...list, result]);
	return result;
}

export async function updateTask(params: PmTaskUpdateParams): Promise<void> {
	let prev: PmTask | undefined;
	pmTasks.update((list) =>
		list.map((t) => {
			if (t.id === params.id) {
				prev = t;
				return { ...t, ...params, updatedAt: Date.now() };
			}
			return t;
		})
	);
	try {
		await gateway.call('pm.task.update', params as unknown as Record<string, unknown>);
	} catch (err) {
		if (prev) {
			pmTasks.update((list) => list.map((t) => (t.id === params.id ? prev! : t)));
		}
		throw err;
	}
}

export async function moveTask(params: PmTaskMoveParams): Promise<void> {
	let prev: PmTask | undefined;
	pmTasks.update((list) =>
		list.map((t) => {
			if (t.id === params.id) {
				prev = t;
				return {
					...t,
					parentProjectId: params.parentProjectId ?? t.parentProjectId,
					parentTaskId: params.parentTaskId ?? t.parentTaskId
				};
			}
			return t;
		})
	);
	try {
		await gateway.call('pm.task.move', params as unknown as Record<string, unknown>);
	} catch (err) {
		if (prev) {
			pmTasks.update((list) => list.map((t) => (t.id === params.id ? prev! : t)));
		}
		throw err;
	}
}

export async function reorderTasks(params: PmTaskReorderParams): Promise<void> {
	await gateway.call('pm.task.reorder', params as unknown as Record<string, unknown>);
}

export async function deleteTask(id: number): Promise<void> {
	await gateway.call('pm.task.delete', { id });
	pmTasks.update((list) => list.filter((t) => t.id !== id));
}

// --- Comment CRUD ---

export async function loadComments(
	targetType: PmCommentListParams['targetType'],
	targetId: number
): Promise<void> {
	const params: PmCommentListParams = { targetType, targetId };
	const response = await gateway.call<PmCommentListResponse>(
		'pm.comment.list',
		params as unknown as Record<string, unknown>
	);
	pmComments.set(response.comments);
}

export async function createComment(params: PmCommentCreateParams): Promise<void> {
	const result = await gateway.call<PmComment>(
		'pm.comment.create',
		params as unknown as Record<string, unknown>
	);
	pmComments.update((list) => [...list, result]);
}

export async function updateComment(params: PmCommentUpdateParams): Promise<void> {
	await gateway.call('pm.comment.update', params as unknown as Record<string, unknown>);
	pmComments.update((list) =>
		list.map((c) => (c.id === params.id ? { ...c, body: params.body } : c))
	);
}

export async function deleteComment(id: number): Promise<void> {
	await gateway.call('pm.comment.delete', { id });
	pmComments.update((list) => list.filter((c) => c.id !== id));
}

// --- Block CRUD ---

export const pmBlocks = writable<PmBlock[]>([]);

export async function loadBlocks(taskId?: number): Promise<void> {
	const params: PmBlockListParams = taskId != null ? { taskId } : {};
	const response = await gateway.call<PmBlockListResponse>(
		'pm.block.list',
		params as unknown as Record<string, unknown>
	);
	pmBlocks.set(response.blocks);
}

export async function createBlock(params: PmBlockCreateParams): Promise<void> {
	await gateway.call('pm.block.create', params as unknown as Record<string, unknown>);
	pmBlocks.update((list) => [
		...list,
		{ blockerId: params.blockerId, blockedId: params.blockedId }
	]);
}

export async function deleteBlock(params: PmBlockDeleteParams): Promise<void> {
	await gateway.call('pm.block.delete', params as unknown as Record<string, unknown>);
	pmBlocks.update((list) =>
		list.filter((b) => !(b.blockerId === params.blockerId && b.blockedId === params.blockedId))
	);
}

// --- Attachment CRUD ---

export const pmAttachments = writable<PmAttachment[]>([]);

export async function loadAttachments(
	targetType: PmAttachmentListParams['targetType'],
	targetId: number
): Promise<void> {
	const params: PmAttachmentListParams = { targetType, targetId };
	const response = await gateway.call<PmAttachmentListResponse>(
		'pm.attachment.list',
		params as unknown as Record<string, unknown>
	);
	pmAttachments.set(response.attachments);
}

export async function createAttachment(params: PmAttachmentCreateParams): Promise<void> {
	const result = await gateway.call<PmAttachment>(
		'pm.attachment.create',
		params as unknown as Record<string, unknown>
	);
	pmAttachments.update((list) => [...list, result]);
}

export async function deleteAttachment(id: number): Promise<void> {
	await gateway.call('pm.attachment.delete', { id });
	pmAttachments.update((list) => list.filter((a) => a.id !== id));
}

// --- Activity ---

export async function loadActivities(
	entityType?: PmActivityListParams['targetType'],
	entityId?: number,
	limit?: number
): Promise<void> {
	const params: PmActivityListParams = {};
	if (entityType) params.targetType = entityType;
	if (entityId != null) params.targetId = entityId;
	if (limit != null) params.limit = limit;
	const response = await gateway.call<PmActivityListResponse>(
		'pm.activity.list',
		params as unknown as Record<string, unknown>
	);
	pmActivities.set(response.activities);
}

// --- Stats ---

export async function loadStats(): Promise<void> {
	const response = await gateway.call<PmStats>('pm.stats');
	pmStats.set(response);
}

// --- Search ---

export async function searchPm(params: PmSearchParams): Promise<PmSearchResult> {
	return gateway.call<PmSearchResult>('pm.search', params as unknown as Record<string, unknown>);
}

// --- Bulk Operations ---

export async function bulkUpdateTasks(params: PmBulkUpdateParams): Promise<PmBulkUpdateResponse> {
	const result = await gateway.call<PmBulkUpdateResponse>(
		'pm.bulk.update',
		params as unknown as Record<string, unknown>
	);
	// Refetch tasks to sync with server state
	await loadProjects();
	return result;
}

export async function bulkMoveTasks(params: PmBulkMoveParams): Promise<PmBulkMoveResponse> {
	const result = await gateway.call<PmBulkMoveResponse>(
		'pm.bulk.move',
		params as unknown as Record<string, unknown>
	);
	await loadProjects();
	return result;
}

// --- Real-time Event Listeners ---

let unsubscribeFns: (() => void)[] = [];

/** Refetch all affected entities when a state version gap is detected */
async function handleVersionGap(): Promise<void> {
	await Promise.all([loadDomains(), loadFocuses(), loadMilestones(), loadProjects()]);
}

/** Handle incoming PM events to keep stores in sync */
function handlePmEvent(payload: unknown): void {
	const event = payload as PmEvent;
	const { action, entityType, entity, stateVersion } = event;

	// Gap detection: if the incoming version is more than 1 ahead, refetch
	if (stateVersion?.pm != null) {
		if (stateVersion.pm > pmStateVersion + 1 && pmStateVersion > 0) {
			handleVersionGap();
			pmStateVersion = stateVersion.pm;
			return;
		}
		pmStateVersion = stateVersion.pm;
	}

	switch (entityType) {
		case 'domain':
			handleEntityEvent(pmDomains, entity as PmDomain, action, (d) => d.id);
			break;
		case 'focus':
			handleEntityEvent(pmFocuses, entity as PmFocus, action, (f) => f.id);
			break;
		case 'milestone':
			handleEntityEvent(pmMilestones, entity as PmMilestone, action, (m) => m.id);
			break;
		case 'project':
			handleEntityEvent(pmProjects, entity as PmProject, action, (p) => p.id);
			break;
		case 'task':
			handleEntityEvent(pmTasks, entity as PmTask, action, (t) => t.id);
			break;
		case 'comment':
			handleEntityEvent(pmComments, entity as PmComment, action, (c) => c.id);
			break;
		case 'attachment':
			handleEntityEvent(pmAttachments, entity as PmAttachment, action, (a) => a.id);
			break;
		case 'activity': {
			const activity = entity as PmActivity;
			pmActivities.update((list) => [activity, ...list]);
			break;
		}
		case 'block': {
			const block = entity as PmBlock;
			if (action === 'created') {
				pmBlocks.update((list) => [...list, block]);
			} else if (action === 'deleted') {
				pmBlocks.update((list) =>
					list.filter((b) => !(b.blockerId === block.blockerId && b.blockedId === block.blockedId))
				);
			}
			break;
		}
	}
}

/** Generic handler for entity create/update/delete events */
function handleEntityEvent<T>(
	store: ReturnType<typeof writable<T[]>>,
	entity: T,
	action: PmEvent['action'],
	getId: (e: T) => string | number
): void {
	if (action === 'created') {
		store.update((list) => {
			const exists = list.some((item) => getId(item) === getId(entity));
			return exists
				? list.map((item) => (getId(item) === getId(entity) ? entity : item))
				: [...list, entity];
		});
	} else if (action === 'updated') {
		store.update((list) => list.map((item) => (getId(item) === getId(entity) ? entity : item)));
	} else if (action === 'deleted') {
		store.update((list) => list.filter((item) => getId(item) !== getId(entity)));
	}
}

/** Wire up gateway PM event listeners */
export function initPmListeners(): void {
	destroyPmListeners();
	unsubscribeFns.push(gateway.on('pm', handlePmEvent));
}

/** Clean up PM event listeners */
export function destroyPmListeners(): void {
	unsubscribeFns.forEach((fn) => fn());
	unsubscribeFns = [];
}
