export const WORK_ITEM_TYPES = [
	'project',
	'milestone',
	'task',
	'open_question',
	'decision',
	'automation',
	'finding',
	'change_request'
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

export type WorkCategoryKind = 'category' | 'subcategory';

export type WorkChangeEntityType = WorkItemType | WorkCategoryKind | 'evidence' | 'blocker';

export type WorkChangeAction =
	| 'created'
	| 'updated'
	| 'deleted'
	| 'moved'
	| 'completed'
	| 'answered'
	| 'approved'
	| 'attached';

export interface WorkChange {
	field: string;
	label: string;
	from: unknown;
	to: unknown;
}

export interface WorkChangeLogEntry {
	id: number;
	occurred_at: number;
	actor: string;
	source: string;
	entity_type: WorkChangeEntityType;
	entity_id: string;
	entity_title: string | null;
	action: WorkChangeAction;
	project_id: number | null;
	parent_item_id: number | null;
	area_id: string | null;
	summary: string;
	changes: WorkChange[];
	metadata: Record<string, unknown>;
}

export interface WorkArea {
	id: string;
	title: string;
	description: string | null;
	parent_area_id: string | null;
	status: string;
	created_at: number;
	updated_at: number;
}

export interface WorkCategory {
	id: string;
	title: string;
	description: string | null;
	parent_category_id: string | null;
	status: string;
	kind: WorkCategoryKind;
	created_at: number;
	updated_at: number;
}

export interface WorkCategoryDeleteResult {
	id: string;
	deleted: boolean;
	unassigned_items: number;
	deleted_categories: number;
}

export interface WorkItem {
	id: number;
	type: WorkItemType;
	area_id: string | null;
	category_id?: string | null;
	subcategory_id?: string | null;
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
	goal?: string | null;
	definition_of_done?: string | null;
	why_it_matters?: string | null;
	scope?: string | null;
	non_scope?: string | null;
	health?: 'on_track' | 'at_risk' | 'blocked' | 'unknown' | null;
	operator?: string | null;
	start_date?: string | null;
	target_date?: string | null;
	actual_completed_date?: string | null;
	current_next_item_id?: number | null;
	last_meaningful_update_at?: number | null;
	milestone_marker?: string | null;
	task_action?: string | null;
	question_text?: string | null;
	answerer?: string | null;
	blocked_item_id?: number | null;
	proposed_answer?: string | null;
	answer?: string | null;
	answered_at?: number | null;
	decision_question?: string | null;
	options?: string[] | null;
	recommended_option?: string | null;
	consequence_of_no_decision?: string | null;
	decision?: string | null;
	decided_by?: string | null;
	decided_at?: number | null;
	change_scope?: string | null;
	systems_touched?: string[] | null;
	risk?: string | null;
	rollback_notes?: string | null;
	verification_plan?: string | null;
	approval_state?: string | null;
	execution_state?: string | null;
	trigger_type?: 'cron' | 'heartbeat' | 'webhook' | 'manual' | null;
	schedule?: string | null;
	enabled?: number | null;
	last_run_at?: number | null;
	next_run_at?: number | null;
	last_result?: string | null;
	failure_count?: number | null;
	generated_work_policy?: string | null;
	backing_ref?: string | null;
	finding_text?: string | null;
	source_refs?: string[] | null;
	legacy_project_id: number | null;
	legacy_plan_id: number | null;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}

export type WorkBlockerSource = 'work_item' | 'person' | 'system' | 'external';

export type WorkBlockerStatus = 'active' | 'resolved';

export interface WorkBlockerLink {
	id: number;
	project_id: number | null;
	blocked_item_id: number;
	blocked_item_title: string | null;
	blocked_item_type: WorkItemType | null;
	blocker_source: WorkBlockerSource;
	blocker_item_id: number | null;
	blocker_item_title: string | null;
	blocker_item_type: WorkItemType | null;
	external_label: string | null;
	reason: string | null;
	unblock_action: string | null;
	status: WorkBlockerStatus;
	created_at: number;
	updated_at: number;
	resolved_at: number | null;
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
	waitingOnAgent: WorkItem[];
	waitingOnExternal: WorkItem[];
	needsReview: WorkItem[];
	failedAutomations: WorkItem[];
	scheduledAutomations: WorkItem[];
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
	findings: Array<{
		legacy_type: string;
		legacy_id: string;
		title: string;
		source_ref: string;
	}>;
	warnings: string[];
	self_review: string[];
}
