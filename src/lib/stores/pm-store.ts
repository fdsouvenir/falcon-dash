import { writable, derived, readonly, type Readable, type Writable } from 'svelte/store';
import { call, snapshot } from '$lib/stores/gateway.js';
import type { Project } from './pm-projects.js';
import type { Task } from './pm-projects.js';
import type { Domain, Focus } from './pm-domains.js';

// Feature detection
const _pmAvailable: Writable<boolean> = writable(false);
export const pmAvailable: Readable<boolean> = readonly(_pmAvailable);

export function checkPMAvailability(): () => void {
	return snapshot.features.subscribe((features) => {
		_pmAvailable.set(features.some((m: string) => m.startsWith('pm.')));
	});
}

// State version tracking
let clientStateVersion = 0;
const STATE_VERSION_GAP_THRESHOLD = 5;

// Internal caches
const _domainCache: Writable<Map<string, Domain>> = writable(new Map());
const _focusCache: Writable<Map<string, Focus>> = writable(new Map());
const _projectCache: Writable<Map<number, Project>> = writable(new Map());
const _taskCache: Writable<Map<number, Task>> = writable(new Map());

// Hydrate all caches
export async function hydratePMStores(): Promise<void> {
	try {
		const [domainsRes, focusesRes, projectsRes] = await Promise.all([
			call<{ domains: Domain[] }>('pm.domain.list'),
			call<{ focuses: Focus[] }>('pm.focus.list'),
			call<{ projects: Project[] }>('pm.project.list')
		]);

		const domainMap = new Map<string, Domain>();
		for (const d of domainsRes.domains) domainMap.set(d.id, d);
		_domainCache.set(domainMap);

		const focusMap = new Map<string, Focus>();
		for (const f of focusesRes.focuses) focusMap.set(f.id, f);
		_focusCache.set(focusMap);

		const projectMap = new Map<number, Project>();
		for (const p of projectsRes.projects) projectMap.set(p.id, p);
		_projectCache.set(projectMap);
	} catch (err) {
		console.error('[PM] Failed to hydrate PM stores:', err);
		_pmAvailable.set(false);
	}
}

// Load tasks for a specific project
export async function loadProjectTasks(projectId: number): Promise<void> {
	const res = await call<{ tasks: Task[] }>('pm.task.list', {
		parent_project_id: projectId
	} as Record<string, unknown>);
	_taskCache.update((cache) => {
		for (const t of res.tasks) cache.set(t.id, t);
		return cache;
	});
}

// Optimistic update helper
function optimisticUpdate<K, V>(
	store: Writable<Map<K, V>>,
	key: K,
	updater: (v: V) => V
): V | undefined {
	let original: V | undefined;
	store.update((cache) => {
		original = cache.get(key);
		if (original) {
			cache.set(key, updater(original));
		}
		return cache;
	});
	return original;
}

function rollback<K, V>(store: Writable<Map<K, V>>, key: K, original: V): void {
	store.update((cache) => {
		cache.set(key, original);
		return cache;
	});
}

// Optimistic project update
export async function optimisticUpdateProject(
	id: number,
	data: Partial<Project>
): Promise<Project> {
	const original = optimisticUpdate(_projectCache, id, (p) => ({ ...p, ...data }));
	try {
		const updated = await call<Project>('pm.project.update', {
			id,
			...data
		} as Record<string, unknown>);
		_projectCache.update((cache) => {
			cache.set(id, updated);
			return cache;
		});
		return updated;
	} catch (err) {
		if (original) rollback(_projectCache, id, original);
		throw err;
	}
}

// Optimistic task update
export async function optimisticUpdateTask(id: number, data: Partial<Task>): Promise<Task> {
	const original = optimisticUpdate(_taskCache, id, (t) => ({ ...t, ...data }));
	try {
		const updated = await call<Task>('pm.task.update', { id, ...data } as Record<string, unknown>);
		_taskCache.update((cache) => {
			cache.set(id, updated);
			return cache;
		});
		return updated;
	} catch (err) {
		if (original) rollback(_taskCache, id, original);
		throw err;
	}
}

// Derived: Kanban view (tasks grouped by status)
export const kanbanView: Readable<Record<string, Task[]>> = derived(_taskCache, ($cache) => {
	const groups: Record<string, Task[]> = {
		todo: [],
		in_progress: [],
		review: [],
		done: []
	};
	for (const task of $cache.values()) {
		const status = task.status || 'todo';
		if (groups[status]) groups[status].push(task);
		else groups[status] = [task];
	}
	// Sort each group by sort_order
	for (const key of Object.keys(groups)) {
		groups[key].sort((a, b) => a.sort_order - b.sort_order);
	}
	return groups;
});

// Derived: List view (flat sorted list)
export const listView: Readable<Project[]> = derived(_projectCache, ($cache) => {
	return Array.from($cache.values()).sort((a, b) => b.last_activity_at - a.last_activity_at);
});

// Derived: Tree view (projects with nested tasks)
export interface ProjectTreeNode {
	project: Project;
	tasks: TaskTreeNode[];
}

export interface TaskTreeNode {
	task: Task;
	children: TaskTreeNode[];
}

export const treeView: Readable<ProjectTreeNode[]> = derived(
	[_projectCache, _taskCache],
	([$projects, $tasks]) => {
		const tasksByProject = new Map<number, Task[]>();
		const tasksByParent = new Map<number, Task[]>();

		for (const task of $tasks.values()) {
			if (task.parent_project_id) {
				const list = tasksByProject.get(task.parent_project_id) || [];
				list.push(task);
				tasksByProject.set(task.parent_project_id, list);
			}
			if (task.parent_task_id) {
				const list = tasksByParent.get(task.parent_task_id) || [];
				list.push(task);
				tasksByParent.set(task.parent_task_id, list);
			}
		}

		function buildTaskTree(task: Task): TaskTreeNode {
			const children = (tasksByParent.get(task.id) || [])
				.sort((a, b) => a.sort_order - b.sort_order)
				.map(buildTaskTree);
			return { task, children };
		}

		return Array.from($projects.values()).map((project) => ({
			project,
			tasks: (tasksByProject.get(project.id) || [])
				.sort((a, b) => a.sort_order - b.sort_order)
				.map(buildTaskTree)
		}));
	}
);

// Event handler for incremental cache updates
export function handlePMStoreEvent(event: {
	action: string;
	entityType: string;
	entityId: number | string;
	data: Record<string, unknown> | null;
	stateVersion: number;
}): void {
	// Gap detection
	if (event.stateVersion > clientStateVersion + STATE_VERSION_GAP_THRESHOLD) {
		hydratePMStores();
		clientStateVersion = event.stateVersion;
		return;
	}
	clientStateVersion = event.stateVersion;

	// Incremental update
	if (event.entityType === 'project' && typeof event.entityId === 'number') {
		if (event.action === 'deleted') {
			_projectCache.update((c) => {
				c.delete(event.entityId as number);
				return c;
			});
		} else if (event.data) {
			_projectCache.update((c) => {
				c.set(event.entityId as number, event.data as unknown as Project);
				return c;
			});
		}
	} else if (event.entityType === 'task' && typeof event.entityId === 'number') {
		if (event.action === 'deleted') {
			_taskCache.update((c) => {
				c.delete(event.entityId as number);
				return c;
			});
		} else if (event.data) {
			_taskCache.update((c) => {
				c.set(event.entityId as number, event.data as unknown as Task);
				return c;
			});
		}
	} else if (event.entityType === 'domain' && typeof event.entityId === 'string') {
		if (event.action === 'deleted') {
			_domainCache.update((c) => {
				c.delete(event.entityId as string);
				return c;
			});
		} else if (event.data) {
			_domainCache.update((c) => {
				c.set(event.entityId as string, event.data as unknown as Domain);
				return c;
			});
		}
	} else if (event.entityType === 'focus' && typeof event.entityId === 'string') {
		if (event.action === 'deleted') {
			_focusCache.update((c) => {
				c.delete(event.entityId as string);
				return c;
			});
		} else if (event.data) {
			_focusCache.update((c) => {
				c.set(event.entityId as string, event.data as unknown as Focus);
				return c;
			});
		}
	}
}
