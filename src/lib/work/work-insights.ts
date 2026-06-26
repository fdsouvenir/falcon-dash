import { openStatuses, type WorkItem, type WorkItemType, type WorkStatus } from './work-ui.js';

export type ProjectHealthLabel =
	| 'Blocked'
	| 'Overdue'
	| 'Needs decision'
	| 'Needs attention'
	| 'No date'
	| 'On track';

export type ProjectHealth = {
	label: ProjectHealthLabel;
	tone: string;
	rank: number;
};

export type RiskFlag = {
	key: string;
	label: string;
	detail: string;
	tone: string;
};

export type QuestionBriefSection = {
	id: string;
	title: string;
	content: string;
	defaultOpen: boolean;
	category: 'decision' | 'context' | 'risks' | 'approval' | 'history';
};

export type WorkFocusDefinition = {
	key: string;
	label: string;
	type: WorkItemType;
	primary: boolean;
	description: string;
	statusMode?: WorkStatus | 'open' | 'all';
};

export type ProjectPortfolioMetric = {
	key: string;
	label: string;
	value: number;
	href: string;
	tone: string;
	description: string;
};

export type ProjectPortfolioPulse = {
	openProjects: number;
	metrics: ProjectPortfolioMetric[];
	healthDistribution: Array<{
		label: ProjectHealthLabel;
		value: number;
		tone: string;
	}>;
};

const openWorkTypes: Array<[WorkItemType, string, string]> = [
	['task', 'task', 'tasks'],
	['decision', 'question', 'questions'],
	['change', 'change', 'changes'],
	['routine', 'routine', 'routines'],
	['observation', 'observation', 'observations']
];

const defaultOpenTitles = [
	'objective',
	'question',
	'current state',
	'current verified state',
	'recommendation',
	'approval gate'
];

const defaultCollapsedTitles = [
	'scope',
	'out of scope',
	'acceptance criteria',
	'review',
	'snapshot',
	'legacy version history',
	'version history'
];

const healthLabels: ProjectHealthLabel[] = [
	'Blocked',
	'Overdue',
	'Needs decision',
	'Needs attention',
	'No date',
	'On track'
];

const actionableChildTypes = new Set<WorkItemType>(['task', 'decision', 'change', 'routine']);

export const workFocusDefinitions: WorkFocusDefinition[] = [
	{
		type: 'project',
		key: 'blocked',
		label: 'Blocked',
		primary: true,
		description: 'Projects blocked directly or by child work'
	},
	{
		type: 'project',
		key: 'overdue',
		label: 'Overdue',
		primary: true,
		description: 'Projects or child work past a date'
	},
	{
		type: 'project',
		key: 'needs-decision',
		label: 'Needs decision',
		primary: true,
		description: 'Projects waiting on operator review or an open question'
	},
	{
		type: 'project',
		key: 'no-next-move',
		label: 'No next move',
		primary: true,
		description: 'Projects without a next action or actionable child work'
	},
	{
		type: 'project',
		key: 'stale',
		label: 'Stale',
		primary: true,
		description: 'Projects with no activity for 14 days'
	},
	{
		type: 'project',
		key: 'no-date',
		label: 'No date',
		primary: false,
		description: 'Projects with no project or child date'
	},
	{
		type: 'project',
		key: 'needs-attention',
		label: 'Needs attention',
		primary: false,
		description: 'Projects with urgent or waiting context'
	},
	{
		type: 'project',
		key: 'on-track',
		label: 'On track',
		primary: false,
		description: 'Projects with an on-track health label'
	},
	{
		type: 'change',
		key: 'needs-approval',
		label: 'Needs approval',
		primary: true,
		description: 'Change requests waiting for approval or review'
	},
	{
		type: 'change',
		key: 'waiting-operator',
		label: 'Waiting on you',
		primary: true,
		description: 'Change requests waiting on the operator'
	},
	{
		type: 'change',
		key: 'waiting-agent',
		label: 'Waiting on agent',
		primary: true,
		description: 'Change requests waiting on agent follow-through'
	},
	{
		type: 'change',
		key: 'blocked',
		label: 'Blocked',
		primary: true,
		description: 'Change requests marked blocked'
	},
	{
		type: 'change',
		key: 'recent',
		label: 'Recent',
		primary: true,
		description: 'Change requests updated in the last 7 days'
	},
	{
		type: 'decision',
		key: 'needs-answer',
		label: 'Needs answer',
		primary: true,
		description: 'Questions waiting on operator input'
	},
	{
		type: 'decision',
		key: 'needs-review',
		label: 'Needs review',
		primary: true,
		description: 'Questions marked for review'
	},
	{
		type: 'decision',
		key: 'waiting-agent',
		label: 'Waiting on agent',
		primary: true,
		description: 'Questions waiting on agent follow-through'
	},
	{
		type: 'decision',
		key: 'high-impact',
		label: 'High impact',
		primary: true,
		description: 'Questions with high or urgent priority'
	},
	{
		type: 'decision',
		key: 'answered',
		label: 'Answered',
		primary: true,
		description: 'Closed or answered questions',
		statusMode: 'all'
	},
	{
		type: 'task',
		key: 'due-today',
		label: 'Due today',
		primary: true,
		description: 'Tasks due today or earlier'
	},
	{
		type: 'task',
		key: 'due-this-week',
		label: 'Due this week',
		primary: true,
		description: 'Tasks due in the next 7 days'
	},
	{
		type: 'task',
		key: 'overdue',
		label: 'Overdue',
		primary: true,
		description: 'Tasks past their due date'
	},
	{
		type: 'task',
		key: 'blocked',
		label: 'Blocked',
		primary: true,
		description: 'Tasks marked blocked'
	},
	{
		type: 'task',
		key: 'waiting',
		label: 'Waiting',
		primary: true,
		description: 'Tasks waiting on someone or something'
	},
	{
		type: 'task',
		key: 'no-parent',
		label: 'No parent',
		primary: false,
		description: 'Tasks not attached to a parent project or change'
	},
	{
		type: 'routine',
		key: 'scheduled-soon',
		label: 'Scheduled soon',
		primary: true,
		description: 'Routines scheduled in the next 14 days'
	},
	{
		type: 'routine',
		key: 'overdue-run',
		label: 'Overdue run',
		primary: true,
		description: 'Routines with a missed scheduled run'
	},
	{
		type: 'routine',
		key: 'blocked',
		label: 'Blocked',
		primary: true,
		description: 'Routines marked blocked'
	},
	{
		type: 'routine',
		key: 'no-cadence',
		label: 'No cadence',
		primary: true,
		description: 'Routines without a cadence value'
	},
	{
		type: 'routine',
		key: 'recent-result',
		label: 'Recent result',
		primary: true,
		description: 'Routines updated in the last 7 days'
	},
	{
		type: 'observation',
		key: 'needs-triage',
		label: 'Needs triage',
		primary: true,
		description: 'Observations waiting on review or operator triage'
	},
	{
		type: 'observation',
		key: 'linked-to-work',
		label: 'Linked to work',
		primary: true,
		description: 'Observations attached to another Work item'
	},
	{
		type: 'observation',
		key: 'unlinked',
		label: 'Unlinked',
		primary: true,
		description: 'Observations without a parent Work item'
	},
	{
		type: 'observation',
		key: 'recent',
		label: 'Recent',
		primary: true,
		description: 'Observations captured in the last 7 days'
	},
	{
		type: 'observation',
		key: 'source',
		label: 'Source',
		primary: false,
		description: 'Observations filtered by source owner or area'
	}
];

export function focusDefinitionsForType(
	type: WorkItemType,
	options: { primaryOnly?: boolean } = {}
): WorkFocusDefinition[] {
	return workFocusDefinitions.filter(
		(definition) => definition.type === type && (!options.primaryOnly || definition.primary)
	);
}

export function focusDefinitionForType(
	type: WorkItemType,
	focus: string | null | undefined
): WorkFocusDefinition | null {
	if (!focus) return null;
	return (
		workFocusDefinitions.find(
			(definition) => definition.type === type && definition.key === focus
		) ?? null
	);
}

export function projectPortfolioPulse(
	items: WorkItem[],
	now = Date.now(),
	basePath = '/work/projects'
): ProjectPortfolioPulse {
	const projects = items.filter((item) => item.type === 'project' && openStatuses.has(item.status));
	const metricInput: Array<[string, string, string, string, string]> = [
		['open', 'Open projects', `${basePath}?status=open`, 'text-primary', 'Active outcomes'],
		[
			'blocked',
			'Blocked',
			`${basePath}?focus=blocked`,
			'text-status-danger',
			'Blocked directly or by child work'
		],
		[
			'overdue',
			'Overdue',
			`${basePath}?focus=overdue`,
			'text-status-danger',
			'Project or child date has passed'
		],
		[
			'needs-decision',
			'Needs decision',
			`${basePath}?focus=needs-decision`,
			'text-status-warning',
			'Waiting on operator judgment'
		],
		[
			'no-next-move',
			'No next move',
			`${basePath}?focus=no-next-move`,
			'text-status-warning',
			'Missing a clear next action'
		],
		[
			'stale',
			'Stale',
			`${basePath}?focus=stale`,
			'text-on-surface-variant',
			'No activity in 14 days'
		]
	];

	return {
		openProjects: projects.length,
		metrics: metricInput.map(([key, label, href, tone, description]) => ({
			key,
			label,
			href,
			tone,
			description,
			value:
				key === 'open'
					? projects.length
					: projects.filter((project) => matchesProjectFocus(project, key, items, now)).length
		})),
		healthDistribution: healthLabels.map((label) => ({
			label,
			value: projects.filter(
				(project) => projectHealth(project, projectChildren(project, items), now).label === label
			).length,
			tone: projectHealthTone(label)
		}))
	};
}

export function matchesWorkFocus(
	item: WorkItem,
	focus: string | null | undefined,
	items: WorkItem[],
	now = Date.now(),
	options: { source?: string | null } = {}
): boolean {
	const definition = focusDefinitionForType(item.type, focus);
	if (!definition) return true;
	if (item.type === 'project') return matchesProjectFocus(item, definition.key, items, now);
	if (item.type === 'change') return matchesChangeFocus(item, definition.key, now);
	if (item.type === 'decision') return matchesDecisionFocus(item, definition.key);
	if (item.type === 'task') return matchesTaskFocus(item, definition.key, now);
	if (item.type === 'routine') return matchesRoutineFocus(item, definition.key, now);
	if (item.type === 'observation')
		return matchesObservationFocus(item, definition.key, now, options);
	return true;
}

export function literalBlockersFor(item: WorkItem, relatedItems: WorkItem[]): WorkItem[] {
	return uniqueItems(relatedItems)
		.filter((candidate) => candidate.id !== item.id)
		.filter((candidate) => openStatuses.has(candidate.status))
		.filter((candidate) => candidate.status === 'blocked')
		.sort((a, b) => a.last_activity_at - b.last_activity_at || a.id - b.id);
}

export function riskFlagsFor(
	item: WorkItem,
	relatedItems: WorkItem[],
	now = Date.now()
): RiskFlag[] {
	const related = uniqueItems(relatedItems).filter((candidate) => candidate.id !== item.id);
	const blockers = literalBlockersFor(item, related);
	const flags: RiskFlag[] = [];

	if (item.status === 'blocked') {
		flags.push({
			key: 'blocked-self',
			label: 'Blocked',
			detail: 'This item is marked blocked.',
			tone: 'text-status-danger'
		});
	}
	if (blockers.length > 0) {
		flags.push({
			key: 'blocked-related',
			label: 'Blocked work',
			detail: `${blockers.length} related ${blockers.length === 1 ? 'item is' : 'items are'} blocked.`,
			tone: 'text-status-danger'
		});
	}
	if (isItemOverdue(item, now)) {
		flags.push({
			key: 'overdue-self',
			label: 'Overdue',
			detail: 'The date on this item has passed.',
			tone: 'text-status-danger'
		});
	}

	const overdueRelated = related.filter((candidate) => isItemOverdue(candidate, now));
	if (overdueRelated.length > 0) {
		flags.push({
			key: 'overdue-related',
			label: 'Related overdue',
			detail: `${overdueRelated.length} related ${overdueRelated.length === 1 ? 'item has' : 'items have'} a past date.`,
			tone: 'text-status-warning'
		});
	}
	if (item.priority === 'urgent') {
		flags.push({
			key: 'urgent',
			label: 'Urgent',
			detail: 'Priority is set to urgent.',
			tone: 'text-status-warning'
		});
	}
	if (item.status === 'needs_review') {
		flags.push({
			key: 'needs-review-self',
			label: 'Needs review',
			detail: 'This item is waiting for review or approval.',
			tone: 'text-status-warning'
		});
	}

	const needsDecision = related.filter(
		(candidate) =>
			openStatuses.has(candidate.status) &&
			(candidate.status === 'needs_review' ||
				candidate.waiting_on === 'operator' ||
				(candidate.type === 'decision' && candidate.status !== 'complete'))
	);
	if (needsDecision.length > 0) {
		flags.push({
			key: 'needs-decision-related',
			label: 'Needs decision',
			detail: `${needsDecision.length} related ${needsDecision.length === 1 ? 'item needs' : 'items need'} operator review.`,
			tone: 'text-status-warning'
		});
	}
	if (item.waiting_on) {
		flags.push({
			key: `waiting-${item.waiting_on}`,
			label: `Waiting on ${item.waiting_on}`,
			detail: 'Progress is waiting on an owner or dependency.',
			tone: item.waiting_on === 'operator' ? 'text-status-warning' : 'text-status-muted'
		});
	}

	return uniqueFlags(flags);
}

export function projectHealth(
	project: WorkItem,
	children: WorkItem[],
	now = Date.now()
): ProjectHealth {
	if (project.status === 'blocked' || children.some((child) => child.status === 'blocked')) {
		return { label: 'Blocked', tone: 'text-status-danger', rank: 0 };
	}
	if (isItemOverdue(project, now) || children.some((child) => isItemOverdue(child, now))) {
		return { label: 'Overdue', tone: 'text-status-danger', rank: 1 };
	}

	const needsDecision =
		project.status === 'needs_review' ||
		project.waiting_on === 'operator' ||
		children.some(
			(child) =>
				openStatuses.has(child.status) &&
				(child.status === 'needs_review' ||
					child.waiting_on === 'operator' ||
					(child.type === 'decision' && child.status !== 'complete'))
		);
	if (needsDecision) return { label: 'Needs decision', tone: 'text-status-warning', rank: 2 };

	const needsAttention =
		project.priority === 'urgent' ||
		Boolean(project.waiting_on) ||
		children.some(
			(child) =>
				openStatuses.has(child.status) && (child.priority === 'urgent' || Boolean(child.waiting_on))
		);
	if (needsAttention) return { label: 'Needs attention', tone: 'text-status-warning', rank: 3 };

	if (!projectUpcomingItem(project, children)) {
		return { label: 'No date', tone: 'text-status-muted', rank: 4 };
	}

	return { label: 'On track', tone: 'text-status-active', rank: 5 };
}

export function projectOpenWork(project: WorkItem, children: WorkItem[]): string {
	const parts = openWorkTypes
		.map(([type, singular, plural]) => {
			const count = children.filter(
				(child) =>
					child.parent_item_id === project.id &&
					child.type === type &&
					openStatuses.has(child.status)
			).length;
			if (count === 0) return null;
			return `${count} ${count === 1 ? singular : plural}`;
		})
		.filter(Boolean);
	return parts.length ? parts.join(' · ') : 'No tracked next steps';
}

export function projectNextMove(project: WorkItem, children: WorkItem[]): string {
	const blockers = literalBlockersFor(project, children);
	if (blockers[0]) return `Clear: ${blockers[0].title}`;

	const decision = children.find(
		(child) =>
			openStatuses.has(child.status) &&
			(child.type === 'decision' ||
				child.status === 'needs_review' ||
				child.waiting_on === 'operator')
	);
	if (decision) return `Decide: ${decision.title}`;

	const dated = projectUpcomingItem(project, children);
	if (dated && dated.id !== project.id) return `Move next dated work: ${dated.title}`;

	const task = children.find((child) => openStatuses.has(child.status) && child.type === 'task');
	return firstText(project.next_action, task?.next_action, task?.title, 'No operator action set');
}

export function projectUpcomingItem(project: WorkItem, children: WorkItem[]): WorkItem | null {
	const candidates = [project, ...children].filter(
		(item) =>
			openStatuses.has(item.status) &&
			(dateValue(item.due_date) !== Number.MAX_SAFE_INTEGER ||
				dateValue(item.scheduled_at) !== Number.MAX_SAFE_INTEGER)
	);
	return (
		[...candidates].sort(
			(a, b) =>
				Math.min(dateValue(a.due_date), dateValue(a.scheduled_at)) -
				Math.min(dateValue(b.due_date), dateValue(b.scheduled_at))
		)[0] ?? null
	);
}

export function isItemOverdue(item: WorkItem, now = Date.now()): boolean {
	if (!openStatuses.has(item.status)) return false;
	const value = Math.min(dateValue(item.due_date), dateValue(item.scheduled_at));
	return value !== Number.MAX_SAFE_INTEGER && value < startOfDay(now);
}

export function isProjectStale(project: WorkItem, children: WorkItem[], now = Date.now()): boolean {
	if (!openStatuses.has(project.status)) return false;
	const latestActivity = Math.max(
		project.last_activity_at,
		...children.map((child) => child.last_activity_at)
	);
	return latestActivity * 1000 < now - 14 * 24 * 60 * 60 * 1000;
}

export function projectHasNoNextMove(project: WorkItem, children: WorkItem[]): boolean {
	if (!openStatuses.has(project.status)) return false;
	if (project.next_action?.trim()) return false;
	return !children.some(
		(child) => openStatuses.has(child.status) && actionableChildTypes.has(child.type)
	);
}

export function matchesProjectFocus(
	project: WorkItem,
	focus: string | null | undefined,
	items: WorkItem[],
	now = Date.now()
): boolean {
	if (!focus || focus === 'open') return openStatuses.has(project.status);
	const children = projectChildren(project, items);
	const health = projectHealth(project, children, now);
	if (focus === 'blocked') {
		return project.status === 'blocked' || children.some((child) => child.status === 'blocked');
	}
	if (focus === 'overdue') {
		return isItemOverdue(project, now) || children.some((child) => isItemOverdue(child, now));
	}
	if (focus === 'needs-decision') return projectNeedsDecision(project, children);
	if (focus === 'no-next-move') return projectHasNoNextMove(project, children);
	if (focus === 'stale') return isProjectStale(project, children, now);
	if (focus === 'no-date') return !projectUpcomingItem(project, children);
	if (focus === 'needs-attention') return health.label === 'Needs attention';
	if (focus === 'on-track') return health.label === 'On track';
	return true;
}

export function parseQuestionSections(markdown: string): QuestionBriefSection[] {
	const source = markdown.trim();
	if (!source) {
		return [
			{
				id: 'context',
				title: 'Context',
				content: 'No question context recorded yet.',
				defaultOpen: true,
				category: 'context'
			}
		];
	}

	const matches = [...source.matchAll(/^##\s+(.+?)\s*$/gm)];
	if (matches.length === 0) {
		return [
			{
				id: 'context',
				title: 'Context',
				content: source,
				defaultOpen: true,
				category: 'context'
			}
		];
	}

	const sections: QuestionBriefSection[] = [];
	const firstMatch = matches[0];
	const preamble = source.slice(0, firstMatch.index).trim();
	if (preamble) {
		sections.push({
			id: 'summary',
			title: 'Summary',
			content: preamble,
			defaultOpen: true,
			category: 'context'
		});
	}

	matches.forEach((match, index) => {
		const title = match[1].trim();
		const start = (match.index ?? 0) + match[0].length;
		const end = matches[index + 1]?.index ?? source.length;
		sections.push({
			id: slugify(title),
			title,
			content: source.slice(start, end).trim() || 'No details recorded.',
			defaultOpen: shouldOpenQuestionSection(title, index, matches.length),
			category: questionSectionCategory(title)
		});
	});

	const hasPreferredOpen = sections.some((section) =>
		defaultOpenTitles.includes(normalizeTitle(section.title))
	);
	if (!hasPreferredOpen) {
		return sections.map((section, index) => ({
			...section,
			defaultOpen: index < 2 && !isCollapsedTitle(section.title)
		}));
	}

	return sections;
}

function matchesChangeFocus(item: WorkItem, focus: string, now: number): boolean {
	if (focus === 'needs-approval') {
		return (
			item.approval_required === 1 ||
			item.status === 'needs_review' ||
			item.waiting_on === 'operator'
		);
	}
	if (focus === 'waiting-operator') return item.waiting_on === 'operator';
	if (focus === 'waiting-agent') return item.waiting_on === 'agent';
	if (focus === 'blocked') return item.status === 'blocked';
	if (focus === 'recent') return isRecentActivity(item, 7, now);
	return true;
}

function matchesDecisionFocus(item: WorkItem, focus: string): boolean {
	if (focus === 'needs-answer') {
		return (
			openStatuses.has(item.status) &&
			(item.waiting_on === 'operator' || item.status === 'needs_review')
		);
	}
	if (focus === 'needs-review') return item.status === 'needs_review';
	if (focus === 'waiting-agent') return item.waiting_on === 'agent';
	if (focus === 'high-impact') return item.priority === 'high' || item.priority === 'urgent';
	if (focus === 'answered')
		return item.status === 'complete' || item.status === 'cancelled' || item.status === 'archived';
	return true;
}

function matchesTaskFocus(item: WorkItem, focus: string, now: number): boolean {
	if (focus === 'due-today') {
		const value = dateValue(item.due_date);
		return value !== Number.MAX_SAFE_INTEGER && value < startOfDay(now) + 24 * 60 * 60 * 1000;
	}
	if (focus === 'due-this-week') return isWithinDays(item.due_date, 7, now);
	if (focus === 'overdue') return isItemOverdue(item, now);
	if (focus === 'blocked') return item.status === 'blocked';
	if (focus === 'waiting') return Boolean(item.waiting_on) || item.status === 'waiting';
	if (focus === 'no-parent') return item.parent_item_id === null;
	return true;
}

function matchesRoutineFocus(item: WorkItem, focus: string, now: number): boolean {
	if (focus === 'scheduled-soon') return isWithinDays(item.scheduled_at, 14, now);
	if (focus === 'overdue-run') return isItemOverdue(item, now);
	if (focus === 'blocked') return item.status === 'blocked';
	if (focus === 'no-cadence') return !item.stale_after?.trim();
	if (focus === 'recent-result')
		return Boolean(item.result?.trim()) && isRecentActivity(item, 7, now);
	return true;
}

function matchesObservationFocus(
	item: WorkItem,
	focus: string,
	now: number,
	options: { source?: string | null }
): boolean {
	if (focus === 'needs-triage') {
		return item.status === 'needs_review' || item.waiting_on === 'operator';
	}
	if (focus === 'linked-to-work') return item.parent_item_id !== null;
	if (focus === 'unlinked') return item.parent_item_id === null;
	if (focus === 'recent') return isRecentActivity(item, 7, now);
	if (focus === 'source') {
		if (!options.source) return true;
		return observationSource(item) === options.source;
	}
	return true;
}

function projectNeedsDecision(project: WorkItem, children: WorkItem[]): boolean {
	return (
		project.status === 'needs_review' ||
		project.waiting_on === 'operator' ||
		children.some(
			(child) =>
				openStatuses.has(child.status) &&
				(child.status === 'needs_review' ||
					child.waiting_on === 'operator' ||
					(child.type === 'decision' && child.status !== 'complete'))
		)
	);
}

function projectChildren(project: WorkItem, items: WorkItem[]): WorkItem[] {
	return items.filter((item) => item.parent_item_id === project.id);
}

function projectHealthTone(label: ProjectHealthLabel): string {
	if (label === 'Blocked' || label === 'Overdue') return 'text-status-danger';
	if (label === 'Needs decision' || label === 'Needs attention') return 'text-status-warning';
	if (label === 'On track') return 'text-status-active';
	return 'text-on-surface-variant';
}

function isWithinDays(value: string | null | undefined, days: number, now: number): boolean {
	const parsed = dateValue(value);
	if (parsed === Number.MAX_SAFE_INTEGER) return false;
	const today = startOfDay(now);
	return parsed >= today && parsed < today + days * 24 * 60 * 60 * 1000;
}

function isRecentActivity(item: WorkItem, days: number, now: number): boolean {
	const ageMs = now - item.last_activity_at * 1000;
	return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function observationSource(item: WorkItem): string {
	return firstText(item.owner, item.area_id, 'Work');
}

function shouldOpenQuestionSection(title: string, index: number, total: number): boolean {
	if (index >= 6) return false;
	if (isCollapsedTitle(title)) return false;
	const normalized = normalizeTitle(title);
	if (defaultOpenTitles.includes(normalized)) return true;
	return total <= 2 && index < 2;
}

function questionSectionCategory(title: string): QuestionBriefSection['category'] {
	const normalized = normalizeTitle(title);
	if (normalized.includes('approval')) return 'approval';
	if (normalized.includes('risk') || normalized.includes('out of scope')) return 'risks';
	if (
		normalized.includes('history') ||
		normalized.includes('snapshot') ||
		normalized.includes('review')
	) {
		return 'history';
	}
	if (normalized.includes('question') || normalized.includes('recommendation')) return 'decision';
	return 'context';
}

function isCollapsedTitle(title: string): boolean {
	const normalized = normalizeTitle(title);
	return defaultCollapsedTitles.some((collapsed) => normalized.includes(collapsed));
}

function normalizeTitle(title: string): string {
	return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return slug || 'section';
}

function uniqueItems(source: WorkItem[]): WorkItem[] {
	const seen = new Set<number>();
	return source.filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
}

function uniqueFlags(source: RiskFlag[]): RiskFlag[] {
	const seen = new Set<string>();
	return source.filter((flag) => {
		if (seen.has(flag.key)) return false;
		seen.add(flag.key);
		return true;
	});
}

function dateValue(value: string | null | undefined): number {
	if (!value) return Number.MAX_SAFE_INTEGER;
	const parsed = new Date(value).valueOf();
	return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function startOfDay(value: number): number {
	const date = new Date(value);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).valueOf();
}

function firstText(...values: Array<string | null | undefined>): string {
	const value = values.find((entry) => entry !== null && entry !== undefined && entry.trim());
	return value === undefined || value === null ? 'Not set' : value;
}
