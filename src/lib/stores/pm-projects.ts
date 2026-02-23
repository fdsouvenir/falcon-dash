import { writable, readonly, get, type Readable, type Writable } from 'svelte/store';
import { pmGet, pmPost, pmPatch, pmDelete } from './pm-api.js';

export interface Project {
	id: number;
	focus_id: string;
	title: string;
	description: string | null;
	body: string | null;
	status: string;
	due_date: string | null;
	priority: string | null;
	external_ref: string | null;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}

interface PaginatedResponse<T> {
	items: T[];
	total: number;
}

const _projects: Writable<Project[]> = writable([]);
const _currentProject: Writable<Project | null> = writable(null);
const _projectsLoading: Writable<boolean> = writable(false);

export const projects: Readable<Project[]> = readonly(_projects);
export const currentProject: Readable<Project | null> = readonly(_currentProject);
export const projectsLoading: Readable<boolean> = readonly(_projectsLoading);

// Project methods
export async function loadProjects(filters?: {
	focus_id?: string;
	status?: string;
}): Promise<void> {
	_projectsLoading.set(true);
	try {
		const params: Record<string, string | number | undefined> = { limit: '500' };
		if (filters?.focus_id) params.focus_id = filters.focus_id;
		if (filters?.status) params.status = filters.status;
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
	body?: string;
	status?: string;
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
		body?: string;
		status?: string;
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
