import { pmGet, pmPost, pmPatch, pmDelete } from './pm-api.js';

// Re-export types for UI
export interface Comment {
	id: number;
	target_type: string;
	target_id: number;
	body: string;
	author: string;
	created_at: number;
}
export interface Block {
	blocker_id: number;
	blocked_id: number;
}
export interface Activity {
	id: number;
	project_id: number;
	actor: string;
	action: string;
	target_type: string;
	target_id: number;
	target_title: string | null;
	details: string | null;
	created_at: number;
}
export interface Attachment {
	id: number;
	target_type: string;
	target_id: number;
	file_path: string;
	file_name: string;
	description: string | null;
	added_by: string;
	created_at: number;
}

// Search result type
export interface PMSearchResult {
	entity_type: string;
	entity_id: number;
	project_id: number;
	title: string;
	snippet: string;
	rank: number;
}

// Dashboard context type (structured data for UI)
export interface DashboardContext {
	markdown: string;
	generated_at: number;
	stats: {
		activeProjects: number;
		dueSoon: number;
		blocked: number;
		recentActivity: number;
	};
	dueSoon: { type: string; id: number; title: string; due_date: string }[];
	blocked: { id: number; title: string; blocker_count: number }[];
	recentActivity: (Activity & { project_title: string })[];
}

// Domain context type (structured data for UI)
export interface DomainContext {
	domain: { id: string; name: string };
	focuses: { id: string; name: string; projectCount: number }[];
	projects: { id: number; title: string; status: string; taskCount: number }[];
}

// Project context type (structured data for UI)
export interface ProjectContext {
	project: {
		id: number;
		title: string;
		status: string;
		description: string | null;
	};
	tasks: { id: number; title: string; status: string; priority: string | null }[];
	comments: Comment[];
	activities: Activity[];
	blocks: { blocker_id: number; blocked_id: number }[];
}

// AI Context types (markdown summaries for agents)
export interface AIProjectContext {
	markdown: string;
	generated_at: number;
}

export interface AIDashboardContext {
	markdown: string;
	generated_at: number;
	stats: {
		activeProjects: number;
		dueSoon: number;
		blocked: number;
		overdue: number;
	};
}

// PM Stats type
export interface PMStats {
	projects: { total: number; byStatus: Record<string, number> };
	tasks: { total: number; byStatus: Record<string, number> };
	blocked: number;
	overdue: number;
	recentActivity: number;
	dueSoon: number;
}

interface PaginatedResponse<T> {
	items: T[];
	total: number;
}

// --- COMMENT methods ---
export async function listComments(targetType: string, targetId: number): Promise<Comment[]> {
	const res = await pmGet<PaginatedResponse<Comment>>('/api/pm/comments', {
		target_type: targetType,
		target_id: targetId,
		limit: '500'
	});
	return res.items;
}
export async function createComment(data: {
	target_type: string;
	target_id: number;
	body: string;
	author: string;
}): Promise<Comment> {
	return pmPost<Comment>('/api/pm/comments', data);
}
export async function updateComment(id: number, body: string): Promise<Comment> {
	return pmPatch<Comment>(`/api/pm/comments/${id}`, { body });
}
export async function deleteComment(id: number): Promise<void> {
	await pmDelete(`/api/pm/comments/${id}`);
}

// --- BLOCK methods ---
export async function listBlocks(
	taskId: number
): Promise<{ blocking: Block[]; blockedBy: Block[] }> {
	return pmGet<{ blocking: Block[]; blockedBy: Block[] }>('/api/pm/blocks', {
		task_id: taskId
	});
}
export async function createBlock(blockerId: number, blockedId: number): Promise<Block> {
	return pmPost<Block>('/api/pm/blocks', { blocker_id: blockerId, blocked_id: blockedId });
}
export async function deleteBlock(blockerId: number, blockedId: number): Promise<void> {
	await pmDelete('/api/pm/blocks', { blocker_id: blockerId, blocked_id: blockedId });
}

// --- ATTACHMENT methods ---
export async function listAttachments(targetType: string, targetId: number): Promise<Attachment[]> {
	const res = await pmGet<PaginatedResponse<Attachment>>('/api/pm/attachments', {
		target_type: targetType,
		target_id: targetId,
		limit: '500'
	});
	return res.items;
}
export async function createAttachment(data: {
	target_type: string;
	target_id: number;
	file_path: string;
	file_name: string;
	description?: string;
	added_by: string;
}): Promise<Attachment> {
	return pmPost<Attachment>('/api/pm/attachments', data);
}
export async function deleteAttachment(id: number): Promise<void> {
	await pmDelete(`/api/pm/attachments/${id}`);
}

// --- ACTIVITY methods ---
export async function listActivities(projectId: number, limit?: number): Promise<Activity[]> {
	const res = await pmGet<PaginatedResponse<Activity>>('/api/pm/activities', {
		project_id: projectId,
		limit: limit ?? 50
	});
	return res.items;
}

// --- CONTEXT methods (structured data) ---
export async function getDashboardContext(): Promise<DashboardContext> {
	return pmGet<DashboardContext>('/api/pm/context');
}
export async function getDomainContext(domainId: string): Promise<DomainContext> {
	return pmGet<DomainContext>(`/api/pm/context/domain/${domainId}`);
}
export async function getProjectContext(projectId: number): Promise<ProjectContext> {
	return pmGet<ProjectContext>(`/api/pm/context/project/${projectId}`);
}

// --- AI CONTEXT methods (markdown summaries) ---
export async function getAIProjectContext(projectId: number): Promise<AIProjectContext> {
	return pmGet<AIProjectContext>(`/api/pm/context/project/${projectId}`);
}
export async function getAIDashboardContext(): Promise<AIDashboardContext> {
	return pmGet<AIDashboardContext>('/api/pm/context');
}

// --- SEARCH ---
export async function searchPM(
	query: string,
	options?: {
		entityType?: string;
		projectId?: number;
		limit?: number;
		offset?: number;
	}
): Promise<PMSearchResult[]> {
	const params: Record<string, string | number | undefined> = { q: query };
	if (options?.entityType) params.entity_type = options.entityType;
	if (options?.projectId !== undefined) params.project_id = options.projectId;
	if (options?.limit !== undefined) params.limit = options.limit;
	if (options?.offset !== undefined) params.offset = options.offset;
	const res = await pmGet<{ results: PMSearchResult[] }>('/api/pm/search', params);
	return res.results;
}

// --- BULK methods ---
export async function bulkUpdateStatus(
	ids: number[],
	entityType: 'project' | 'task',
	status: string
): Promise<void> {
	await pmPost('/api/pm/bulk', { action: 'update', ids, entityType, fields: { status } });
}
export async function bulkMove(
	ids: number[],
	entityType: 'project' | 'task',
	target: Record<string, unknown>
): Promise<void> {
	await pmPost('/api/pm/bulk', { action: 'move', ids, entityType, target });
}

// --- STATS ---
export async function getPMStats(): Promise<PMStats> {
	return pmGet<PMStats>('/api/pm/stats');
}
