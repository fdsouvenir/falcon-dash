import { writable, readonly, get, type Readable, type Writable } from 'svelte/store';
import { call, eventBus } from '$lib/stores/gateway.js';

export interface Project {
	id: number;
	focus_id: string;
	title: string;
	description: string | null;
	status: string;
	milestone_id: number | null;
	due_date: string | null;
	priority: string | null;
	external_ref: string | null;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}

export interface Task {
	id: number;
	parent_project_id: number | null;
	parent_task_id: number | null;
	title: string;
	body: string | null;
	status: string;
	due_date: string | null;
	priority: string | null;
	milestone_id: number | null;
	external_ref: string | null;
	sort_order: number;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}

const _projects: Writable<Project[]> = writable([]);
const _tasks: Writable<Task[]> = writable([]);
const _currentProject: Writable<Project | null> = writable(null);
const _currentTasks: Writable<Task[]> = writable([]);
const _projectsLoading: Writable<boolean> = writable(false);
const _tasksLoading: Writable<boolean> = writable(false);

export const projects: Readable<Project[]> = readonly(_projects);
export const tasks: Readable<Task[]> = readonly(_tasks);
export const currentProject: Readable<Project | null> = readonly(_currentProject);
export const currentTasks: Readable<Task[]> = readonly(_currentTasks);
export const projectsLoading: Readable<boolean> = readonly(_projectsLoading);
export const tasksLoading: Readable<boolean> = readonly(_tasksLoading);

// Project methods
export async function loadProjects(filters?: {
	focus_id?: string;
	status?: string;
	milestone_id?: number;
}): Promise<void> {
	_projectsLoading.set(true);
	try {
		const res = await call<{ projects: Project[] }>(
			'pm.project.list',
			filters as Record<string, unknown>
		);
		_projects.set(res.projects);
	} finally {
		_projectsLoading.set(false);
	}
}

export async function getProject(id: number): Promise<Project> {
	const project = await call<Project>('pm.project.get', { id });
	_currentProject.set(project);
	return project;
}

export async function createProject(data: {
	focus_id: string;
	title: string;
	description?: string;
	status?: string;
	milestone_id?: number;
	due_date?: string;
	priority?: string;
}): Promise<Project> {
	const project = await call<Project>('pm.project.create', data as Record<string, unknown>);
	await loadProjects();
	return project;
}

export async function updateProject(
	id: number,
	data: {
		title?: string;
		description?: string;
		status?: string;
		milestone_id?: number;
		due_date?: string;
		priority?: string;
		focus_id?: string;
	}
): Promise<Project> {
	const project = await call<Project>('pm.project.update', { id, ...data });
	_currentProject.set(project);
	await loadProjects();
	return project;
}

export async function deleteProject(id: number): Promise<void> {
	await call('pm.project.delete', { id });
	const currentValue = get(_currentProject);
	if (currentValue?.id === id) {
		_currentProject.set(null);
	}
	await loadProjects();
}

// Task methods
export async function loadTasks(filters?: {
	parent_project_id?: number;
	parent_task_id?: number;
	status?: string;
}): Promise<void> {
	_tasksLoading.set(true);
	try {
		const res = await call<{ tasks: Task[] }>('pm.task.list', filters as Record<string, unknown>);
		_tasks.set(res.tasks);
		// If filtering by project, also update currentTasks
		if (filters?.parent_project_id !== undefined) {
			_currentTasks.set(res.tasks);
		}
	} finally {
		_tasksLoading.set(false);
	}
}

export async function getTask(id: number): Promise<Task> {
	const task = await call<Task>('pm.task.get', { id });
	return task;
}

export async function createTask(data: {
	title: string;
	body?: string;
	parent_project_id?: number;
	parent_task_id?: number;
	status?: string;
	due_date?: string;
	priority?: string;
	milestone_id?: number;
}): Promise<Task> {
	const task = await call<Task>('pm.task.create', data as Record<string, unknown>);
	if (data.parent_project_id !== undefined) {
		await loadTasks({ parent_project_id: data.parent_project_id });
	} else {
		await loadTasks();
	}
	return task;
}

export async function updateTask(
	id: number,
	data: {
		title?: string;
		body?: string;
		status?: string;
		due_date?: string;
		priority?: string;
		milestone_id?: number;
	}
): Promise<Task> {
	const task = await call<Task>('pm.task.update', { id, ...data });
	// Refresh current tasks if we have a project context
	const currentValue = get(_currentProject);
	if (currentValue) {
		await loadTasks({ parent_project_id: currentValue.id });
	} else {
		await loadTasks();
	}
	return task;
}

export async function moveTask(
	id: number,
	target: { parent_project_id?: number; parent_task_id?: number }
): Promise<Task> {
	const task = await call<Task>('pm.task.move', { id, ...target });
	await loadTasks();
	return task;
}

export async function reorderTasks(ids: number[]): Promise<void> {
	await call('pm.task.reorder', { ids });
	// Refresh current tasks
	const currentValue = get(_currentProject);
	if (currentValue) {
		await loadTasks({ parent_project_id: currentValue.id });
	} else {
		await loadTasks();
	}
}

export async function deleteTask(id: number): Promise<void> {
	await call('pm.task.delete', { id });
	const currentValue = get(_currentProject);
	if (currentValue) {
		await loadTasks({ parent_project_id: currentValue.id });
	} else {
		await loadTasks();
	}
}

// Event subscriptions
let unsubscribers: Array<() => void> = [];

export function subscribeToPMProjectEvents(): () => void {
	unsubscribeFromPMProjectEvents();
	unsubscribers.push(
		eventBus.on('pm.project.changed', async () => {
			const currentValue = get(_currentProject);
			if (currentValue) {
				await getProject(currentValue.id);
			}
			await loadProjects();
		}),
		eventBus.on('pm.task.changed', async () => {
			const currentValue = get(_currentProject);
			if (currentValue) {
				await loadTasks({ parent_project_id: currentValue.id });
			}
		})
	);
	return () => unsubscribeFromPMProjectEvents();
}

export function unsubscribeFromPMProjectEvents(): void {
	for (const unsub of unsubscribers) unsub();
	unsubscribers = [];
}
