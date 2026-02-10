import { call } from '$lib/stores/gateway.js';

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
	activeProjects: number;
	dueSoon: { type: string; id: number; title: string; due_date: string }[];
	blocked: { id: number; title: string; blockers: number[] }[];
	recentActivity: Activity[];
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
	totalProjects: number;
	totalTasks: number;
	byStatus: Record<string, number>;
	overdue: number;
	recentActivity: number;
}

// --- COMMENT methods ---
export async function listComments(targetType: string, targetId: number): Promise<Comment[]> {
	const res = await call<{ comments: Comment[] }>('pm.comment.list', {
		targetType,
		targetId
	});
	return res.comments;
}
export async function createComment(data: {
	target_type: string;
	target_id: number;
	body: string;
	author: string;
}): Promise<Comment> {
	return call<Comment>('pm.comment.create', data as unknown as Record<string, unknown>);
}
export async function updateComment(id: number, body: string): Promise<Comment> {
	return call<Comment>('pm.comment.update', { id, body });
}
export async function deleteComment(id: number): Promise<void> {
	await call('pm.comment.delete', { id });
}

// --- BLOCK methods ---
export async function listBlocks(
	taskId: number
): Promise<{ blocking: Block[]; blockedBy: Block[] }> {
	return call<{ blocking: Block[]; blockedBy: Block[] }>('pm.block.list', {
		taskId
	});
}
export async function createBlock(blockerId: number, blockedId: number): Promise<Block> {
	return call<Block>('pm.block.create', { blockerId, blockedId });
}
export async function deleteBlock(blockerId: number, blockedId: number): Promise<void> {
	await call('pm.block.delete', { blockerId, blockedId });
}

// --- ATTACHMENT methods ---
export async function listAttachments(targetType: string, targetId: number): Promise<Attachment[]> {
	const res = await call<{ attachments: Attachment[] }>('pm.attachment.list', {
		targetType,
		targetId
	});
	return res.attachments;
}
export async function createAttachment(data: {
	target_type: string;
	target_id: number;
	file_path: string;
	file_name: string;
	description?: string;
	added_by: string;
}): Promise<Attachment> {
	return call<Attachment>('pm.attachment.create', data as unknown as Record<string, unknown>);
}
export async function deleteAttachment(id: number): Promise<void> {
	await call('pm.attachment.delete', { id });
}

// --- ACTIVITY methods ---
export async function listActivities(projectId: number, limit?: number): Promise<Activity[]> {
	const res = await call<{ activities: Activity[] }>('pm.activity.list', {
		projectId,
		limit: limit ?? 50
	});
	return res.activities;
}

// --- CONTEXT methods (structured data) ---
export async function getDashboardContext(): Promise<DashboardContext> {
	return call<DashboardContext>('pm.context.dashboard');
}
export async function getDomainContext(domainId: string): Promise<DomainContext> {
	return call<DomainContext>('pm.context.domain', { domainId });
}
export async function getProjectContext(projectId: number): Promise<ProjectContext> {
	return call<ProjectContext>('pm.context.project', { projectId });
}

// --- AI CONTEXT methods (markdown summaries) ---
export async function getAIProjectContext(projectId: number): Promise<AIProjectContext> {
	return call<AIProjectContext>('pm.context.project', { projectId });
}
export async function getAIDashboardContext(): Promise<AIDashboardContext> {
	return call<AIDashboardContext>('pm.context.dashboard');
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
	const res = await call<{ results: PMSearchResult[] }>('pm.search', {
		query,
		...options
	} as Record<string, unknown>);
	return res.results;
}

// --- BULK methods ---
export async function bulkUpdateStatus(
	ids: number[],
	entityType: 'project' | 'task',
	status: string
): Promise<void> {
	await call('pm.bulk.update', { ids, entityType, fields: { status } });
}
export async function bulkMove(
	ids: number[],
	entityType: 'project' | 'task',
	target: Record<string, unknown>
): Promise<void> {
	await call('pm.bulk.move', { ids, entityType, target });
}

// --- STATS ---
export async function getPMStats(): Promise<PMStats> {
	return call<PMStats>('pm.stats');
}
