export const workTypes = [
	'project',
	'change',
	'decision',
	'task',
	'routine',
	'observation',
	'area'
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

export interface WorkQueue {
	nextActions: WorkItem[];
	needsOperator?: WorkItem[];
	waitingOnOperator?: WorkItem[];
	waitingOnFred?: WorkItem[];
	waitingOnAgent: WorkItem[];
	waitingOnExternal?: WorkItem[];
	needsReview: WorkItem[];
	scheduledRoutines: WorkItem[];
	staleCleanup: WorkItem[];
	blockedRisky: WorkItem[];
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
		type: 'change',
		path: 'changes',
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
		type: 'decision',
		path: 'decisions',
		label: 'Questions',
		singular: 'Question',
		title: 'Questions',
		summary: 'Choices that need an answer before related work can move with confidence.',
		primaryLabel: 'Question',
		secondaryLabel: 'Recommendation',
		tertiaryLabel: 'Impact',
		empty: 'No questions match this view.',
		tone: 'text-status-warning'
	},
	{
		type: 'task',
		path: 'tasks',
		label: 'Tasks',
		singular: 'Task',
		title: 'Tasks',
		summary: 'Actionable units with owner, due state, waiting state, and parent context.',
		primaryLabel: 'Action',
		secondaryLabel: 'Parent',
		tertiaryLabel: 'Due',
		empty: 'No tasks match this view.',
		tone: 'text-status-active'
	},
	{
		type: 'routine',
		path: 'routines',
		label: 'Routines',
		singular: 'Routine',
		title: 'Routines',
		summary: 'Recurring checks and upkeep work with cadence, next run, and latest result.',
		primaryLabel: 'Cadence',
		secondaryLabel: 'Next run',
		tertiaryLabel: 'Last result',
		empty: 'No routines match this view.',
		tone: 'text-status-active'
	},
	{
		type: 'observation',
		path: 'observations',
		label: 'Observations',
		singular: 'Observation',
		title: 'Observations',
		summary: 'A feed of captured findings, events, and evidence from active work.',
		primaryLabel: 'Finding',
		secondaryLabel: 'Source',
		tertiaryLabel: 'Captured',
		empty: 'No observations match this view.',
		tone: 'text-status-muted'
	},
	{
		type: 'area',
		path: 'areas',
		label: 'Areas',
		singular: 'Area',
		title: 'Areas',
		summary:
			'Operating domains that collect related projects, change requests, routines, and questions.',
		primaryLabel: 'Domain',
		secondaryLabel: 'Open work',
		tertiaryLabel: 'Recent activity',
		empty: 'No areas match this view.',
		tone: 'text-status-info'
	}
];

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
	return typeConfigs.find((config) => config.path === section)?.type ?? 'project';
}

export function pathForType(type: WorkItemType): string {
	return configForType(type).path;
}

export function formatStatus(status: string): string {
	return status.replace(/_/g, ' ');
}

export function sentenceCase(value: string): string {
	const formatted = value.replace(/_/g, ' ');
	return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatDate(value: number | string | null | undefined): string {
	if (!value) return 'Not set';
	const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
	if (Number.isNaN(date.valueOf())) return 'Not set';
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
	}).format(date);
}

export function formatDateTime(value: number | string | null | undefined): string {
	if (!value) return 'Not set';
	const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
	if (Number.isNaN(date.valueOf())) return 'Not set';
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(date);
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
	return `${configForType(item.type).singular} ${item.id}`;
}
