export const workTypes = [
	'project',
	'milestone',
	'task',
	'open_question',
	'decision',
	'change_request',
	'finding',
	'automation'
] as const;

export const workStatuses = [
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

export type WorkItemType = (typeof workTypes)[number];
export type WorkStatus = (typeof workStatuses)[number];
export type WorkPriority = 'low' | 'normal' | 'high' | 'urgent';
export type WorkChangeEntityType =
	| WorkItemType
	| 'category'
	| 'subcategory'
	| 'evidence'
	| 'blocker';
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

export interface WorkCategory {
	id: string;
	title: string;
	description: string | null;
	parent_category_id: string | null;
	status: 'active' | 'paused' | 'archived';
	kind: 'category' | 'subcategory';
	created_at: number;
	updated_at: number;
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

export interface WorkQueue {
	nextActions: WorkItem[];
	needsOperator?: WorkItem[];
	waitingOnOperator?: WorkItem[];
	waitingOnAgent: WorkItem[];
	waitingOnExternal?: WorkItem[];
	needsReview: WorkItem[];
	failedAutomations?: WorkItem[];
	scheduledAutomations: WorkItem[];
	staleCleanup: WorkItem[];
	blockedRisky: WorkItem[];
}

export type WorkReconciliationStatus =
	| 'queued'
	| 'running'
	| 'applied'
	| 'no_action'
	| 'needs_agent'
	| 'agent_running'
	| 'needs_review'
	| 'failed';

export interface WorkReconciliationRun {
	id: number;
	root_item_id: number;
	trigger_entity: string;
	trigger_id: string;
	status: WorkReconciliationStatus;
	deterministic_changes_json: string;
	ambiguities_json: string;
	deterministic_changes: string[];
	ambiguities: string[];
	session_key: string | null;
	created_at: number;
	updated_at: number;
}

export interface TypeConfig {
	type: WorkItemType;
	path: string;
	label: string;
	singular: string;
	title: string;
	summary: string;
	primaryLabel: string;
	secondaryLabel: string;
	tertiaryLabel: string;
	empty: string;
	tone: string;
}

export const resolutionTypes: WorkItemType[] = ['open_question', 'decision'];

export const resolutionConfig: TypeConfig = {
	type: 'open_question',
	path: 'needs-resolution',
	label: 'Needs resolution',
	singular: 'Resolution',
	title: 'Needs resolution',
	summary: 'Questions to answer and choices to make, grouped as one resolution queue.',
	primaryLabel: 'Resolution',
	secondaryLabel: 'Owner',
	tertiaryLabel: 'Impact',
	empty: 'No items need resolution in this view.',
	tone: 'text-status-warning'
};

export const typeConfigs: TypeConfig[] = [
	{
		type: 'project',
		path: 'projects',
		label: 'Projects',
		singular: 'Project',
		title: 'Projects',
		summary: 'Outcomes, momentum, blockers, and child work grouped around a bigger result.',
		primaryLabel: 'Outcome',
		secondaryLabel: 'Next move',
		tertiaryLabel: 'Open children',
		empty: 'No projects match this view.',
		tone: 'text-status-info'
	},
	{
		type: 'milestone',
		path: 'milestones',
		label: 'Milestones',
		singular: 'Milestone',
		title: 'Milestones',
		summary: 'Progress markers and checkpoints inside active project briefs.',
		primaryLabel: 'Marker',
		secondaryLabel: 'Project',
		tertiaryLabel: 'Target',
		empty: 'No milestones match this view.',
		tone: 'text-status-info'
	},
	{
		type: 'task',
		path: 'tasks',
		label: 'Tasks',
		singular: 'Task',
		title: 'Tasks',
		summary: 'Specific executable work with owner, due state, waiting state, and parent context.',
		primaryLabel: 'Task',
		secondaryLabel: 'Parent',
		tertiaryLabel: 'Due',
		empty: 'No tasks match this view.',
		tone: 'text-status-active'
	},
	{
		type: 'open_question',
		path: 'open-questions',
		label: 'Open questions',
		singular: 'Open question',
		title: 'Open questions',
		summary: 'Unresolved knowledge that blocks confident project movement.',
		primaryLabel: 'Question',
		secondaryLabel: 'Can answer',
		tertiaryLabel: 'Blocks',
		empty: 'No open questions match this view.',
		tone: 'text-status-warning'
	},
	{
		type: 'decision',
		path: 'decisions',
		label: 'Decisions',
		singular: 'Decision',
		title: 'Decisions',
		summary: 'Choices or approvals that need commitment, options, and a recommendation.',
		primaryLabel: 'Decision',
		secondaryLabel: 'Recommendation',
		tertiaryLabel: 'No decision cost',
		empty: 'No decisions match this view.',
		tone: 'text-status-warning'
	},
	{
		type: 'change_request',
		path: 'change-requests',
		label: 'Change requests',
		singular: 'Change request',
		title: 'Change requests',
		summary: 'Implementation or configuration work that may need approval before it moves.',
		primaryLabel: 'Scope',
		secondaryLabel: 'Next action',
		tertiaryLabel: 'Approval',
		empty: 'No change requests match this view.',
		tone: 'text-status-purple'
	},
	{
		type: 'automation',
		path: 'automations',
		label: 'Automations',
		singular: 'Automation',
		title: 'Automations',
		summary: 'Recurring or triggered work backed by cron, heartbeat, webhook, or manual runs.',
		primaryLabel: 'Trigger',
		secondaryLabel: 'Next run',
		tertiaryLabel: 'Last result',
		empty: 'No automations match this view.',
		tone: 'text-status-active'
	},
	{
		type: 'finding',
		path: 'findings',
		label: 'Findings',
		singular: 'Finding',
		title: 'Findings',
		summary: 'A feed of captured findings, events, and evidence from active work.',
		primaryLabel: 'Finding',
		secondaryLabel: 'Source',
		tertiaryLabel: 'Captured',
		empty: 'No findings match this view.',
		tone: 'text-status-muted'
	}
];

export const standaloneTypeConfigs: TypeConfig[] = typeConfigs.filter(
	(config) => config.type !== 'milestone'
);

export const navigationTypeConfigs: TypeConfig[] = [
	...standaloneTypeConfigs.filter(
		(config) => config.type !== 'open_question' && config.type !== 'decision'
	),
	resolutionConfig
].sort((a, b) => {
	const order = ['project', 'task', 'open_question', 'change_request', 'automation', 'finding'];
	return order.indexOf(a.type) - order.indexOf(b.type);
});

export function isStandaloneWorkType(type: WorkItemType): boolean {
	return type !== 'milestone';
}

export const openStatuses = new Set<WorkStatus>([
	'backlog',
	'planning',
	'ready',
	'in_progress',
	'waiting',
	'needs_review',
	'blocked',
	'scheduled'
]);

export function configForType(type: WorkItemType): TypeConfig {
	return typeConfigs.find((config) => config.type === type) ?? typeConfigs[0];
}

export function typeFromSection(section: string | undefined): WorkItemType {
	const legacySectionAliases: Record<string, WorkItemType> = {
		tasks: 'task',
		task: 'task',
		'next-steps': 'task',
		'next-step': 'task',
		routines: 'automation',
		routine: 'automation',
		observations: 'finding',
		observation: 'finding',
		changes: 'change_request',
		change: 'change_request',
		'needs-resolution': 'open_question',
		'need-resolution': 'open_question',
		resolutions: 'open_question',
		resolution: 'open_question',
		questions: 'open_question',
		question: 'open_question',
		spaces: 'project',
		space: 'project',
		areas: 'project',
		area: 'project'
	};
	if (section && legacySectionAliases[section]) return legacySectionAliases[section];
	return standaloneTypeConfigs.find((config) => config.path === section)?.type ?? 'project';
}

export function pathForType(type: WorkItemType): string {
	if (resolutionTypes.includes(type)) return resolutionConfig.path;
	return configForType(type).path;
}

export function formatStatus(status: string): string {
	return status.replace(/_/g, ' ');
}

export function sentenceCase(value: string): string {
	const formatted = value.replace(/_/g, ' ');
	return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatDate(
	value: number | string | null | undefined,
	locale?: Intl.LocalesArgument,
	now: Date = new Date()
): string {
	if (!value) return 'Not set';
	const date = workDate(value);
	if (!date) return 'Not set';
	return new Intl.DateTimeFormat(locale, {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric'
	}).format(date);
}

export function formatDateTime(value: number | string | null | undefined): string {
	if (!value) return 'Not set';
	const date = workDate(value);
	if (!date) return 'Not set';
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(date);
}

export function isWorkDateOverdue(
	value: number | string | null | undefined,
	now: Date = new Date()
): boolean {
	if (!value) return false;
	const date = workDate(value);
	if (!date) return false;
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
		const today = new Date(now);
		today.setHours(0, 0, 0, 0);
		return date.valueOf() < today.valueOf();
	}
	return date.valueOf() < now.valueOf();
}

export function scheduleDateForItem(
	value: Pick<
		WorkItem,
		'type' | 'due_date' | 'target_date' | 'scheduled_at' | 'next_run_at' | 'stale_after'
	>
): number | string | null {
	if (value.type === 'automation') {
		return (
			value.next_run_at ??
			value.scheduled_at ??
			value.due_date ??
			value.target_date ??
			value.stale_after
		);
	}
	return (
		value.due_date ??
		value.target_date ??
		value.scheduled_at ??
		value.next_run_at ??
		value.stale_after
	);
}

function workDate(value: number | string): Date | null {
	let date: Date;
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
		const [year, month, day] = value.split('-').map(Number);
		date = new Date(year, month - 1, day);
		if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
			return null;
		}
	} else {
		date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
	}
	return Number.isNaN(date.valueOf()) ? null : date;
}

export function statusTone(status: WorkStatus): string {
	if (status === 'in_progress' || status === 'ready') return 'text-status-active';
	if (status === 'needs_review' || status === 'waiting') return 'text-status-warning';
	if (status === 'blocked') return 'text-status-danger';
	if (status === 'scheduled') return 'text-status-purple';
	if (status === 'complete') return 'text-status-info';
	return 'text-status-muted';
}

export function priorityTone(priority: WorkPriority | null): string {
	if (priority === 'urgent') return 'text-status-danger';
	if (priority === 'high') return 'text-status-warning';
	if (priority === 'low') return 'text-status-muted';
	return 'text-status-info';
}

export function waitingLabel(value: string | null): string {
	if (!value) return 'No blocker';
	if (value === 'fred' || value === 'operator' || value === 'me') return 'Operator';
	if (value === 'agent') return 'Agent';
	if (value === 'system') return 'System';
	if (value === 'external') return 'External';
	return sentenceCase(value);
}

export function itemDisplayId(item: WorkItem): string {
	if (resolutionTypes.includes(item.type)) return `Needs resolution ${item.id}`;
	return `${configForType(item.type).singular} ${item.id}`;
}
