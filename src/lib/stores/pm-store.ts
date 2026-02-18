import { writable, derived, readonly, type Readable, type Writable } from 'svelte/store';
import { pmGet } from './pm-api.js';
import type { Project } from './pm-projects.js';
import type { Task } from './pm-projects.js';
import type { Domain, Focus } from './pm-domains.js';

// Feature detection via HTTP
const _pmAvailable: Writable<boolean> = writable(false);
export const pmAvailable: Readable<boolean> = readonly(_pmAvailable);

export async function checkPMAvailability(): Promise<void> {
	try {
		await pmGet('/api/pm/stats');
		_pmAvailable.set(true);
	} catch {
		_pmAvailable.set(false);
	}
}

// Internal caches
const _domainCache: Writable<Map<string, Domain>> = writable(new Map());
const _focusCache: Writable<Map<string, Focus>> = writable(new Map());
const _projectCache: Writable<Map<number, Project>> = writable(new Map());
const _taskCache: Writable<Map<number, Task>> = writable(new Map());

interface PaginatedResponse<T> {
	items: T[];
	total: number;
}

// Hydrate all caches
export async function hydratePMStores(): Promise<void> {
	try {
		const [domainsRes, focusesRes, projectsRes] = await Promise.all([
			pmGet<PaginatedResponse<Domain>>('/api/pm/domains', { limit: '500' }),
			pmGet<PaginatedResponse<Focus>>('/api/pm/focuses', { limit: '500' }),
			pmGet<PaginatedResponse<Project>>('/api/pm/projects', { limit: '500' })
		]);

		const domainMap = new Map<string, Domain>();
		for (const d of domainsRes.items) domainMap.set(d.id, d);
		_domainCache.set(domainMap);

		const focusMap = new Map<string, Focus>();
		for (const f of focusesRes.items) focusMap.set(f.id, f);
		_focusCache.set(focusMap);

		const projectMap = new Map<number, Project>();
		for (const p of projectsRes.items) projectMap.set(p.id, p);
		_projectCache.set(projectMap);
	} catch (err) {
		console.error('[PM] Failed to hydrate PM stores:', err);
		_pmAvailable.set(false);
	}
}

// Load tasks for a specific project
export async function loadProjectTasks(projectId: number): Promise<void> {
	const res = await pmGet<PaginatedResponse<Task>>('/api/pm/tasks', {
		parent_project_id: projectId,
		limit: '500'
	});
	_taskCache.update((cache) => {
		for (const t of res.items) cache.set(t.id, t);
		return cache;
	});
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
