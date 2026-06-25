export const WORK_ITEM_TYPES = [
	'area',
	'project',
	'task',
	'decision',
	'routine',
	'observation',
	'change'
] as const;

export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

export const WORK_STATUSES = [
	'backlog',
	'planning',
	'ready',
	'in_progress',
	'waiting',
	'needs_review',
	'blocked',
	'scheduled',
	'complete',
	'cancelled',
	'archived'
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export type WorkPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface WorkArea {
	id: string;
	title: string;
	description: string | null;
	parent_area_id: string | null;
	status: string;
	created_at: number;
	updated_at: number;
}

export interface WorkItem {
	id: number;
	type: WorkItemType;
	area_id: string | null;
	parent_item_id: number | null;
	title: string;
	description: string | null;
	body: string | null;
	status: WorkStatus;
	owner: string | null;
	waiting_on: string | null;
	priority: WorkPriority | null;
	next_action: string | null;
	approval_required: number;
	due_date: string | null;
	scheduled_at: string | null;
	stale_after: string | null;
	result: string | null;
	legacy_project_id: number | null;
	legacy_plan_id: number | null;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}

export interface WorkEvidenceRef {
	id: number;
	work_item_id: number | null;
	observation_id: number | null;
	source_type: string;
	source_ref: string;
	summary: string | null;
	created_at: number;
}

export interface WorkMigrationMap {
	legacy_type: string;
	legacy_id: string;
	work_type: string;
	work_id: string;
	created_at: number;
}

export interface WorkQueue {
	nextActions: WorkItem[];
	needsOperator: WorkItem[];
	waitingOnOperator: WorkItem[];
	waitingOnFred: WorkItem[];
	waitingOnAgent: WorkItem[];
	waitingOnExternal: WorkItem[];
	needsReview: WorkItem[];
	scheduledRoutines: WorkItem[];
	staleCleanup: WorkItem[];
	blockedRisky: WorkItem[];
}

export interface WorkContextResponse {
	markdown: string;
	generated_at: number;
	stats: Record<string, number>;
	queue: WorkQueue;
}

export interface WorkMigrationPreview {
	generated_at: number;
	counts: Record<string, number>;
	areas: Array<{ legacy_type: string; legacy_id: string; id: string; title: string }>;
	items: Array<{
		legacy_type: string;
		legacy_id: string;
		type: WorkItemType;
		title: string;
		status: WorkStatus;
		parent_legacy_id?: string;
		area_id?: string;
	}>;
	observations: Array<{
		legacy_type: string;
		legacy_id: string;
		title: string;
		source_ref: string;
	}>;
	warnings: string[];
	self_review: string[];
}
