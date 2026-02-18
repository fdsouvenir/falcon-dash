import { writable, readonly, get, type Readable, type Writable } from 'svelte/store';
import { pmGet, pmPost, pmPatch, pmDelete } from './pm-api.js';

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

interface PaginatedResponse<T> {
	items: T[];
	total: number;
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
		const params: Record<string, string | number | undefined> = { limit: '500' };
		if (filters?.focus_id) params.focus_id = filters.focus_id;
		if (filters?.status) params.status = filters.status;
		if (filters?.milestone_id !== undefined) params.milestone_id = filters.milestone_id;
		const res = await pmGet<PaginatedResponse<Project>>('/api/pm/projects', params);
		_projects.set(res.items);
	} finally {
		_projectsLoading.set(false);
	}
}

export async function getProject(id: number): Promise<Project> {
	const project = await pmGet<Project>(`/api/pm/projects/${id}`);
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
	const project = await pmPost<Project>('/api/pm/projects', data);
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
	const project = await pmPatch<Project>(`/api/pm/projects/${id}`, data);
	_currentProject.set(project);
	await loadProjects();
	return project;
}

export async function deleteProject(id: number): Promise<void> {
	await pmDelete(`/api/pm/projects/${id}`);
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
		const params: Record<string, string | number | undefined> = { limit: '500' };
		if (filters?.parent_project_id !== undefined)
			params.parent_project_id = filters.parent_project_id;
		if (filters?.parent_task_id !== undefined) params.parent_task_id = filters.parent_task_id;
		if (filters?.status) params.status = filters.status;
		const res = await pmGet<PaginatedResponse<Task>>('/api/pm/tasks', params);
		_tasks.set(res.items);
		if (filters?.parent_project_id !== undefined) {
			_currentTasks.set(res.items);
		}
	} finally {
		_tasksLoading.set(false);
	}
}

export async function getTask(id: number): Promise<Task> {
	return pmGet<Task>(`/api/pm/tasks/${id}`);
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
	const task = await pmPost<Task>('/api/pm/tasks', data);
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
	const task = await pmPatch<Task>(`/api/pm/tasks/${id}`, data);
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
	const task = await pmPost<Task>(`/api/pm/tasks/${id}/move`, target);
	await loadTasks();
	return task;
}

export async function reorderTasks(ids: number[]): Promise<void> {
	await pmPost('/api/pm/tasks/reorder', { ids });
	const currentValue = get(_currentProject);
	if (currentValue) {
		await loadTasks({ parent_project_id: currentValue.id });
	} else {
		await loadTasks();
	}
}

export async function deleteTask(id: number): Promise<void> {
	await pmDelete(`/api/pm/tasks/${id}`);
	const currentValue = get(_currentProject);
	if (currentValue) {
		await loadTasks({ parent_project_id: currentValue.id });
	} else {
		await loadTasks();
	}
}
