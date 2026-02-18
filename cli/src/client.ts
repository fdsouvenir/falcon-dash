import { getBaseUrl } from './config.js';

export interface Domain {
	id: number;
	name: string;
	description?: string | null;
	sort_order: number;
	created_at: number;
	updated_at: number;
}
export interface Focus {
	id: number;
	domain_id: number;
	name: string;
	description?: string | null;
	sort_order: number;
	created_at: number;
	updated_at: number;
}
export interface Project {
	id: number;
	focus_id: number;
	title: string;
	description?: string | null;
	status: string;
	priority?: string | null;
	due_date?: string | null;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}
export interface Task {
	id: number;
	parent_project_id?: number | null;
	parent_task_id?: number | null;
	title: string;
	description?: string | null;
	status: string;
	priority?: string | null;
	due_date?: string | null;
	sort_order: number;
	created_at: number;
	updated_at: number;
}
export interface Comment {
	id: number;
	target_type: string;
	target_id: number;
	author: string;
	body: string;
	created_at: number;
	updated_at: number;
}
export interface Block {
	blocker_id: number;
	blocked_id: number;
	created_at: number;
}
export interface Milestone {
	id: number;
	project_id: number;
	title: string;
	due_date?: string | null;
	status: string;
	created_at: number;
	updated_at: number;
}
export interface SearchResult {
	type: string;
	id: number;
	title: string;
	snippet?: string;
}
export interface PMStats {
	[key: string]: unknown;
}
export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

class PMClient {
	private async request<T>(path: string, options?: RequestInit): Promise<T> {
		const url = `${getBaseUrl()}${path}`;
		const res = await fetch(url, {
			...options,
			headers: { 'Content-Type': 'application/json', ...options?.headers }
		});
		if (!res.ok) {
			const text = await res.text();
			let msg: string;
			try {
				msg = JSON.parse(text).error ?? text;
			} catch {
				msg = text;
			}
			throw new Error(`${res.status}: ${msg}`);
		}
		return res.json() as Promise<T>;
	}

	// Domains
	async listDomains(page = 1, limit = 50) {
		return this.request<PaginatedResponse<Domain>>(`/domains?page=${page}&limit=${limit}`);
	}
	async getDomain(id: number) {
		return this.request<Domain>(`/domains/${id}`);
	}
	async createDomain(data: { name: string; description?: string }) {
		return this.request<Domain>('/domains', { method: 'POST', body: JSON.stringify(data) });
	}
	async updateDomain(id: number, data: Partial<Domain>) {
		return this.request<Domain>(`/domains/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
	}
	async deleteDomain(id: number) {
		return this.request<{ success: boolean }>(`/domains/${id}`, { method: 'DELETE' });
	}
	async reorderDomains(ids: number[]) {
		return this.request<{ success: boolean }>('/domains/reorder', {
			method: 'POST',
			body: JSON.stringify({ ids })
		});
	}

	// Focuses
	async listFocuses(domainId?: number, page = 1, limit = 50) {
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		if (domainId) params.set('domain_id', String(domainId));
		return this.request<PaginatedResponse<Focus>>(`/focuses?${params}`);
	}
	async getFocus(id: number) {
		return this.request<Focus>(`/focuses/${id}`);
	}
	async createFocus(data: { domain_id: number; name: string; description?: string }) {
		return this.request<Focus>('/focuses', { method: 'POST', body: JSON.stringify(data) });
	}
	async updateFocus(id: number, data: Partial<Focus>) {
		return this.request<Focus>(`/focuses/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}
	async deleteFocus(id: number) {
		return this.request<{ success: boolean }>(`/focuses/${id}`, { method: 'DELETE' });
	}
	async reorderFocuses(ids: number[]) {
		return this.request<{ success: boolean }>('/focuses/reorder', {
			method: 'POST',
			body: JSON.stringify({ ids })
		});
	}
	async moveFocus(id: number, domainId: number) {
		return this.request<Focus>(`/focuses/${id}/move`, {
			method: 'POST',
			body: JSON.stringify({ domain_id: domainId })
		});
	}

	// Milestones
	async listMilestones(projectId?: number) {
		const params = projectId ? `?project_id=${projectId}` : '';
		return this.request<Milestone[]>(`/milestones${params}`);
	}
	async getMilestone(id: number) {
		return this.request<Milestone>(`/milestones/${id}`);
	}
	async createMilestone(data: {
		project_id: number;
		title: string;
		due_date?: string;
		status?: string;
	}) {
		return this.request<Milestone>('/milestones', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}
	async updateMilestone(id: number, data: Partial<Milestone>) {
		return this.request<Milestone>(`/milestones/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}
	async deleteMilestone(id: number) {
		return this.request<{ success: boolean }>(`/milestones/${id}`, { method: 'DELETE' });
	}

	// Projects
	async listProjects(focusId?: number, status?: string, page = 1, limit = 50) {
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		if (focusId) params.set('focus_id', String(focusId));
		if (status) params.set('status', status);
		return this.request<PaginatedResponse<Project>>(`/projects?${params}`);
	}
	async getProject(id: number) {
		return this.request<Project>(`/projects/${id}`);
	}
	async createProject(data: {
		focus_id: number;
		title: string;
		description?: string;
		status?: string;
		priority?: string;
	}) {
		return this.request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });
	}
	async updateProject(id: number, data: Partial<Project>) {
		return this.request<Project>(`/projects/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}
	async deleteProject(id: number) {
		return this.request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' });
	}

	// Tasks
	async listTasks(
		projectId?: number,
		parentTaskId?: number,
		status?: string,
		page = 1,
		limit = 50
	) {
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		if (projectId) params.set('parent_project_id', String(projectId));
		if (parentTaskId) params.set('parent_task_id', String(parentTaskId));
		if (status) params.set('status', status);
		return this.request<PaginatedResponse<Task>>(`/tasks?${params}`);
	}
	async getTask(id: number) {
		return this.request<Task>(`/tasks/${id}`);
	}
	async createTask(data: {
		parent_project_id?: number;
		parent_task_id?: number;
		title: string;
		description?: string;
		status?: string;
		priority?: string;
	}) {
		return this.request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) });
	}
	async updateTask(id: number, data: Partial<Task>) {
		return this.request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
	}
	async deleteTask(id: number) {
		return this.request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
	}
	async moveTask(id: number, target: { parent_project_id?: number; parent_task_id?: number }) {
		return this.request<Task>(`/tasks/${id}/move`, {
			method: 'POST',
			body: JSON.stringify(target)
		});
	}
	async reorderTasks(ids: number[]) {
		return this.request<{ success: boolean }>('/tasks/reorder', {
			method: 'POST',
			body: JSON.stringify({ ids })
		});
	}

	// Comments
	async listComments(targetType?: string, targetId?: number) {
		const params = new URLSearchParams();
		if (targetType) params.set('target_type', targetType);
		if (targetId) params.set('target_id', String(targetId));
		return this.request<Comment[]>(`/comments?${params}`);
	}
	async createComment(data: {
		target_type: string;
		target_id: number;
		author: string;
		body: string;
	}) {
		return this.request<Comment>('/comments', { method: 'POST', body: JSON.stringify(data) });
	}
	async updateComment(id: number, data: { body: string }) {
		return this.request<Comment>(`/comments/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}
	async deleteComment(id: number) {
		return this.request<{ success: boolean }>(`/comments/${id}`, { method: 'DELETE' });
	}

	// Blocks
	async listBlocks(taskId: number) {
		return this.request<Block[]>(`/blocks?task_id=${taskId}`);
	}
	async createBlock(blockerId: number, blockedId: number) {
		return this.request<Block>('/blocks', {
			method: 'POST',
			body: JSON.stringify({ blocker_id: blockerId, blocked_id: blockedId })
		});
	}
	async deleteBlock(blockerId: number, blockedId: number) {
		return this.request<{ success: boolean }>('/blocks', {
			method: 'DELETE',
			body: JSON.stringify({ blocker_id: blockerId, blocked_id: blockedId })
		});
	}

	// Search
	async search(query: string, type?: string) {
		const params = new URLSearchParams({ q: query });
		if (type) params.set('type', type);
		return this.request<{ results: SearchResult[] }>(`/search?${params}`);
	}

	// Stats
	async getStats() {
		return this.request<PMStats>('/stats');
	}

	// Context
	async getDashboardContext() {
		return this.request<{
			markdown: string;
			generated_at: number;
			stats: Record<string, number>;
		}>('/context');
	}
	async getDomainContext(id: number) {
		return this.request<{
			markdown: string;
			generated_at: number;
			stats: Record<string, number>;
		}>(`/context/domain/${id}`);
	}
	async getProjectContext(id: number) {
		return this.request<{
			markdown: string;
			generated_at: number;
			stats: Record<string, number>;
		}>(`/context/project/${id}`);
	}
	async generateContext() {
		return this.request<{ filesWritten: number; timestamp: number }>('/context/generate', {
			method: 'POST'
		});
	}

	// Bulk
	async bulkUpdate(entityType: string, ids: number[], fields: Record<string, unknown>) {
		return this.request<{ updated: number }>('/bulk', {
			method: 'POST',
			body: JSON.stringify({ action: 'update', entityType, ids, fields })
		});
	}
}

export const client = new PMClient();
