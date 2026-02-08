// PM Module Types
// Reference: builddocs/pm-spec.md, builddocs/falcon-dash-architecture-v02.md §2.2

// --- Enums ---

export enum PmStatus {
	TODO = 'todo',
	IN_PROGRESS = 'in_progress',
	REVIEW = 'review',
	DONE = 'done',
	CANCELLED = 'cancelled',
	ARCHIVED = 'archived'
}

export enum PmPriority {
	LOW = 'low',
	NORMAL = 'normal',
	HIGH = 'high',
	URGENT = 'urgent'
}

// --- Entity Types ---

export type PmEntityType =
	| 'domain'
	| 'focus'
	| 'milestone'
	| 'project'
	| 'task'
	| 'comment'
	| 'block'
	| 'attachment'
	| 'activity';

export type PmTargetType = 'project' | 'task';

export type PmActivityAction =
	| 'created'
	| 'updated'
	| 'commented'
	| 'status_changed'
	| 'reopened'
	| 'closed';

// --- Entity Interfaces ---

export interface PmDomain {
	id: string;
	name: string;
	description?: string;
	sortOrder?: number;
	createdAt: number;
}

export interface PmFocus {
	id: string;
	domainId: string;
	name: string;
	description?: string;
	sortOrder?: number;
	createdAt: number;
}

export interface PmMilestone {
	id: number;
	name: string;
	dueDate?: string;
	description?: string;
	createdAt: number;
}

export interface PmProject {
	id: number;
	focusId: string;
	title: string;
	description?: string;
	status: PmStatus;
	milestoneId?: number;
	dueDate?: string;
	priority?: PmPriority;
	externalRef?: string;
	createdAt: number;
	updatedAt: number;
	lastActivityAt: number;
}

export interface PmTask {
	id: number;
	parentProjectId?: number;
	parentTaskId?: number;
	title: string;
	body?: string;
	status: PmStatus;
	dueDate?: string;
	priority?: PmPriority;
	milestoneId?: number;
	sortOrder?: number;
	externalRef?: string;
	createdAt: number;
	updatedAt: number;
	lastActivityAt: number;
}

export interface PmComment {
	id: number;
	targetType: PmTargetType;
	targetId: number;
	body: string;
	author: string;
	createdAt: number;
}

export interface PmBlock {
	blockerId: number;
	blockedId: number;
}

export interface PmActivity {
	id: number;
	projectId: number;
	actor: string;
	action: PmActivityAction;
	targetType: 'project' | 'task' | 'comment';
	targetId: number;
	targetTitle?: string;
	details?: string;
	createdAt: number;
}

export interface PmAttachment {
	id: number;
	targetType: PmTargetType;
	targetId: number;
	filePath: string;
	fileName: string;
	description?: string;
	addedBy: string;
	createdAt: number;
}

// --- PM Event Payload ---

export type PmEntity =
	| PmDomain
	| PmFocus
	| PmMilestone
	| PmProject
	| PmTask
	| PmComment
	| PmBlock
	| PmAttachment
	| PmActivity;

export interface PmEvent {
	action: 'created' | 'updated' | 'deleted';
	entityType: PmEntityType;
	entity: PmEntity;
	stateVersion: { pm: number };
}

// --- Stats ---

export interface PmStats {
	totalProjects: number;
	totalTasks: number;
	tasksByStatus: Record<string, number>;
	overdueCount: number;
	dueSoonCount: number;
	blockedCount: number;
	recentActivityCount: number;
}

// --- Search ---

export interface PmSearchParams {
	query: string;
	entityTypes?: PmEntityType[];
	limit?: number;
}

export interface PmSearchResultItem {
	entityType: PmEntityType;
	id: number | string;
	title: string;
	snippet?: string;
	score: number;
}

export interface PmSearchResult {
	results: PmSearchResultItem[];
	total: number;
}

// --- Bulk Operations ---

export interface PmBulkUpdateParams {
	ids: number[];
	status?: PmStatus;
	priority?: PmPriority;
	milestoneId?: number;
}

export interface PmBulkUpdateResponse {
	updated: number;
}

export interface PmBulkMoveParams {
	ids: number[];
	parentProjectId: number;
}

export interface PmBulkMoveResponse {
	moved: number;
}

// --- Domain Method Params/Responses ---

export interface PmDomainListResponse {
	domains: PmDomain[];
}

export interface PmDomainGetParams {
	id: string;
}

export interface PmDomainCreateParams {
	id: string;
	name: string;
	description?: string;
}

export interface PmDomainUpdateParams {
	id: string;
	name?: string;
	description?: string;
}

export interface PmDomainDeleteParams {
	id: string;
}

export interface PmDomainReorderParams {
	ids: string[];
}

// --- Focus Method Params/Responses ---

export interface PmFocusListParams {
	domainId?: string;
}

export interface PmFocusListResponse {
	focuses: PmFocus[];
}

export interface PmFocusGetParams {
	id: string;
}

export interface PmFocusCreateParams {
	id: string;
	domainId: string;
	name: string;
	description?: string;
}

export interface PmFocusUpdateParams {
	id: string;
	name?: string;
	description?: string;
}

export interface PmFocusMoveParams {
	id: string;
	domainId: string;
}

export interface PmFocusDeleteParams {
	id: string;
}

export interface PmFocusReorderParams {
	domainId: string;
	ids: string[];
}

// --- Milestone Method Params/Responses ---

export interface PmMilestoneListResponse {
	milestones: PmMilestone[];
}

export interface PmMilestoneGetParams {
	id: number;
}

export interface PmMilestoneCreateParams {
	name: string;
	dueDate?: string;
	description?: string;
}

export interface PmMilestoneUpdateParams {
	id: number;
	name?: string;
	dueDate?: string;
	description?: string;
}

export interface PmMilestoneDeleteParams {
	id: number;
}

// --- Project Method Params/Responses ---

export interface PmProjectListParams {
	focusId?: string;
	status?: PmStatus;
	priority?: PmPriority;
	milestoneId?: number;
}

export interface PmProjectListResponse {
	projects: PmProject[];
}

export interface PmProjectGetParams {
	id: number;
}

export interface PmProjectCreateParams {
	focusId: string;
	title: string;
	description?: string;
	status?: PmStatus;
	priority?: PmPriority;
	milestoneId?: number;
	dueDate?: string;
}

export interface PmProjectUpdateParams {
	id: number;
	title?: string;
	description?: string;
	status?: PmStatus;
	priority?: PmPriority;
	milestoneId?: number;
	dueDate?: string;
	focusId?: string;
}

export interface PmProjectDeleteParams {
	id: number;
}

// --- Task Method Params/Responses ---

export interface PmTaskListParams {
	projectId?: number;
	parentTaskId?: number;
	status?: PmStatus;
	priority?: PmPriority;
}

export interface PmTaskListResponse {
	tasks: PmTask[];
}

export interface PmTaskGetParams {
	id: number;
}

export interface PmTaskCreateParams {
	parentProjectId?: number;
	parentTaskId?: number;
	title: string;
	body?: string;
	status?: PmStatus;
	priority?: PmPriority;
	dueDate?: string;
	milestoneId?: number;
}

export interface PmTaskUpdateParams {
	id: number;
	title?: string;
	body?: string;
	status?: PmStatus;
	priority?: PmPriority;
	dueDate?: string;
	milestoneId?: number;
}

export interface PmTaskMoveParams {
	id: number;
	parentProjectId?: number;
	parentTaskId?: number;
}

export interface PmTaskReorderParams {
	parentProjectId?: number;
	parentTaskId?: number;
	ids: number[];
}

export interface PmTaskDeleteParams {
	id: number;
}

// --- Comment Method Params/Responses ---

export interface PmCommentListParams {
	targetType: PmTargetType;
	targetId: number;
}

export interface PmCommentListResponse {
	comments: PmComment[];
}

export interface PmCommentCreateParams {
	targetType: PmTargetType;
	targetId: number;
	body: string;
	author?: string;
}

export interface PmCommentUpdateParams {
	id: number;
	body: string;
}

export interface PmCommentDeleteParams {
	id: number;
}

// --- Block Method Params/Responses ---

export interface PmBlockListParams {
	taskId?: number;
}

export interface PmBlockListResponse {
	blocks: PmBlock[];
}

export interface PmBlockCreateParams {
	blockerId: number;
	blockedId: number;
}

export interface PmBlockDeleteParams {
	blockerId: number;
	blockedId: number;
}

// --- Attachment Method Params/Responses ---

export interface PmAttachmentListParams {
	targetType: PmTargetType;
	targetId: number;
}

export interface PmAttachmentListResponse {
	attachments: PmAttachment[];
}

export interface PmAttachmentCreateParams {
	targetType: PmTargetType;
	targetId: number;
	filePath: string;
	fileName: string;
	description?: string;
	addedBy?: string;
}

export interface PmAttachmentDeleteParams {
	id: number;
}

// --- Activity Method Params/Responses ---

export interface PmActivityListParams {
	projectId?: number;
	targetType?: string;
	targetId?: number;
	limit?: number;
}

export interface PmActivityListResponse {
	activities: PmActivity[];
}

// --- Context Method Params/Responses ---

export interface PmContextResponse {
	markdown: string;
}

export interface PmContextDomainParams {
	id: string;
}

export interface PmContextProjectParams {
	id: number;
}
