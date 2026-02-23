import { pmGet } from './pm-api.js';

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
		recentActivity: number;
	};
	dueSoon: { type: string; id: number; title: string; due_date: string }[];
	recentActivity: (Activity & { project_title: string })[];
}

// Domain context type (structured data for UI)
export interface DomainContext {
	domain: { id: string; name: string };
	focuses: { id: string; name: string; projectCount: number }[];
	projects: { id: number; title: string; status: string }[];
}

// Project context type (structured data for UI)
export interface ProjectContext {
	project: {
		id: number;
		title: string;
		status: string;
		description: string | null;
	};
	activities: Activity[];
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
		overdue: number;
	};
}

// PM Stats type
export interface PMStats {
	projects: { total: number; byStatus: Record<string, number> };
	overdue: number;
	recentActivity: number;
	dueSoon: number;
}

interface PaginatedResponse<T> {
	items: T[];
	total: number;
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

// --- STATS ---
export async function getPMStats(): Promise<PMStats> {
	return pmGet<PMStats>('/api/pm/stats');
}
