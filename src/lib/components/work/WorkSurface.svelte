<script lang="ts">
	import { resolve } from '$app/paths';
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import {
		configForType,
		formatDate,
		formatDateTime,
		formatStatus,
		itemDisplayId,
		openStatuses,
		pathForType,
		priorityTone,
		sentenceCase,
		statusTone,
		typeConfigs,
		typeFromSection,
		waitingLabel,
		workStatuses,
		type TypeConfig,
		type WorkItem,
		type WorkItemType,
		type WorkPriority,
		type WorkQueue,
		type WorkStatus
	} from '$lib/work/work-ui.js';
	import {
		ArrowRight,
		CalendarClock,
		CheckCircle2,
		Clock,
		RefreshCw,
		Save,
		Search
	} from '@lucide/svelte';
	import { onMount } from 'svelte';

	type Mode = 'overview' | 'section' | 'detail';

	let {
		mode = 'overview',
		section,
		id
	}: {
		mode?: Mode;
		section?: string;
		id?: number;
	} = $props();

	type Draft = {
		title: string;
		description: string;
		body: string;
		status: WorkStatus;
		owner: string;
		waiting_on: string;
		priority: WorkPriority;
		next_action: string;
		due_date: string;
		scheduled_at: string;
		stale_after: string;
		result: string;
		approval_required: boolean;
	};

	type OverviewAnchor = '#needs-you' | '#at-risk' | '#due-next' | '#recent';

	type OverviewSignal = {
		label: string;
		value: number;
		breakdown: string;
		anchor: OverviewAnchor;
		tone: string;
		previewLabel: string;
		preview: string;
	};

	type OverviewGroup = {
		title: string;
		description: string;
		items: WorkItem[];
		empty: string;
	};

	type TimelineGroup = {
		title: string;
		items: WorkItem[];
	};

	type ProjectHealth = {
		label: 'On track' | 'Needs attention' | 'Blocked' | 'No date';
		tone: string;
		rank: number;
	};

	type DetailSection = {
		title: string;
		text: string;
	};

	type DetailFact = {
		label: string;
		value: string;
		tone?: string;
	};

	const waitingOptions = [
		{ value: '', label: 'No blocker' },
		{ value: 'operator', label: 'Operator' },
		{ value: 'agent', label: 'Agent' },
		{ value: 'external', label: 'External' },
		{ value: 'system', label: 'System' }
	];

	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let saveMessage = $state<string | null>(null);
	let items = $state<WorkItem[]>([]);
	let queue = $state<WorkQueue | null>(null);
	let search = $state('');
	let statusFilter = $state<WorkStatus | 'open' | 'all'>('open');
	let selectedId = $state<number | null>(null);
	let draft = $state<Draft>(emptyDraft());

	const visibleTypeConfigs: TypeConfig[] = typeConfigs.filter((config) => config.type !== 'area');

	const activeType = $derived(typeFromSection(section));
	const activeConfig = $derived(configForType(activeType));
	const title = $derived(mode === 'overview' ? 'Work' : activeConfig.title);
	const description = $derived(
		mode === 'overview'
			? 'Active outcomes, blockers, reviews, and recent Work activity.'
			: activeConfig.summary
	);

	const openItems = $derived(items.filter((item) => openStatuses.has(item.status)));
	const typeItems = $derived(items.filter((item) => item.type === activeType));
	const recentItems = $derived(
		[...items].sort((a, b) => b.last_activity_at - a.last_activity_at).slice(0, 14)
	);
	const filteredItems = $derived.by(() => {
		const source = mode === 'overview' ? items : typeItems;
		const query = search.trim().toLowerCase();
		return sortForType(activeType, source).filter((item) => {
			const matchesSearch =
				!query ||
				item.title.toLowerCase().includes(query) ||
				item.description?.toLowerCase().includes(query) ||
				item.body?.toLowerCase().includes(query) ||
				item.next_action?.toLowerCase().includes(query);
			const matchesStatus =
				statusFilter === 'all' ||
				(statusFilter === 'open' ? openStatuses.has(item.status) : item.status === statusFilter);
			return matchesSearch && matchesStatus;
		});
	});
	const selectedItem = $derived.by(() => {
		if (mode === 'detail') return items.find((item) => item.id === id) ?? null;
		const selected = items.find((item) => item.id === selectedId);
		if (selected?.type === activeType) return selected;
		return filteredItems[0] ?? null;
	});

	const needsOperator = $derived(
		queue?.needsOperator ?? queue?.waitingOnOperator ?? queue?.waitingOnFred ?? []
	);
	const needsYourCallItems = $derived.by(() =>
		uniqueItems([...needsOperator, ...(queue?.needsReview ?? [])]).filter(isOpen)
	);
	const blockedItems = $derived.by(() =>
		uniqueItems([
			...(queue?.blockedRisky ?? []),
			...openItems.filter((item) => item.status === 'blocked' || item.priority === 'urgent')
		]).filter(isOpen)
	);
	const waitingExternalItems = $derived.by(() =>
		(queue?.waitingOnExternal ?? []).filter(
			(item) => isOpen(item) && !blockedItems.some((blocked) => blocked.id === item.id)
		)
	);
	const waitingAgentItems = $derived.by(() =>
		(queue?.waitingOnAgent ?? []).filter(
			(item) =>
				isOpen(item) &&
				!blockedItems.some((blocked) => blocked.id === item.id) &&
				!waitingExternalItems.some((external) => external.id === item.id)
		)
	);
	const atRiskItems = $derived.by(() =>
		uniqueItems([...blockedItems, ...waitingExternalItems, ...waitingAgentItems]).filter(isOpen)
	);
	const attentionItems = $derived.by(() =>
		uniqueItems([
			...needsOperator,
			...(queue?.needsReview ?? []),
			...(queue?.blockedRisky ?? []),
			...(queue?.waitingOnExternal ?? []),
			...(queue?.waitingOnAgent ?? [])
		]).slice(0, 12)
	);
	const needsYourCallGroups = $derived.by<OverviewGroup[]>(() => {
		return [
			{
				title: 'Questions',
				description: 'Choices that need an answer before related work can move',
				items: needsYourCallItems.filter((item) => item.type === 'decision'),
				empty: 'No open questions waiting on you'
			},
			{
				title: 'Change requests',
				description: 'Implementation or configuration work asking for review',
				items: needsYourCallItems.filter((item) => item.type === 'change'),
				empty: 'No change requests waiting on you'
			},
			{
				title: 'Observations to triage',
				description: 'Captured findings that need operator judgment',
				items: needsYourCallItems.filter((item) => item.type === 'observation'),
				empty: 'No observations need triage'
			},
			{
				title: 'Other asks',
				description: 'Tasks, routines, or projects waiting for operator input',
				items: needsYourCallItems.filter(
					(item) => !['decision', 'change', 'observation'].includes(item.type)
				),
				empty: 'No other work is waiting on you'
			}
		];
	});
	const atRiskGroups = $derived.by<OverviewGroup[]>(() => {
		return [
			{
				title: 'Blocked',
				description: 'Work that cannot move without clearing a blocker',
				items: blockedItems,
				empty: 'No blocked or urgent work'
			},
			{
				title: 'Waiting external',
				description: 'A person, vendor, or outside system is holding progress',
				items: waitingExternalItems,
				empty: 'No outside dependencies'
			},
			{
				title: 'Waiting on agent',
				description: 'Agent-owned follow-through is still open',
				items: waitingAgentItems,
				empty: 'No agent follow-up is waiting'
			}
		];
	});
	const activeProjects = $derived.by(() =>
		sortProjectsByHealth(openItems.filter((item) => item.type === 'project')).slice(0, 8)
	);
	const recentChangedItems = $derived.by(() =>
		recentItems.filter((item) => isRecent(item.last_activity_at, 7))
	);
	const dueSoonItems = $derived.by(() =>
		openItems
			.filter((item) => item.type === 'task' && onTimeline(item.due_date, 14))
			.sort((a, b) => dateValue(a.due_date) - dateValue(b.due_date))
	);
	const scheduledSoonItems = $derived.by(() =>
		openItems
			.filter((item) => item.type === 'routine' && onTimeline(item.scheduled_at, 14))
			.sort((a, b) => dateValue(a.scheduled_at) - dateValue(b.scheduled_at))
	);
	const dueNextItems = $derived.by(() =>
		uniqueItems([...dueSoonItems, ...scheduledSoonItems]).sort(
			(a, b) => itemTimelineDate(a) - itemTimelineDate(b)
		)
	);
	const dueNextGroups = $derived.by<TimelineGroup[]>(() => [
		{
			title: 'Today',
			items: dueNextItems.filter((item) => timelineBucket(item) === 'today')
		},
		{
			title: 'This week',
			items: dueNextItems.filter((item) => timelineBucket(item) === 'this-week')
		},
		{
			title: 'Next week',
			items: dueNextItems.filter((item) => timelineBucket(item) === 'next-week')
		},
		{
			title: 'Later',
			items: dueNextItems.filter((item) => timelineBucket(item) === 'later')
		}
	]);
	const overviewSignals = $derived.by<OverviewSignal[]>(() => {
		return [
			{
				label: 'Needs your call',
				value: needsYourCallItems.length,
				breakdown: typeBreakdown(needsYourCallItems, 'No operator asks'),
				anchor: '#needs-you',
				tone: 'text-status-warning',
				previewLabel: 'Oldest waiting',
				preview: labelledPreview(oldestItem(needsYourCallItems), 'Nothing is waiting on you')
			},
			{
				label: 'At risk',
				value: atRiskItems.length,
				breakdown: riskBreakdown(),
				anchor: '#at-risk',
				tone: 'text-status-danger',
				previewLabel: 'Highest risk',
				preview: labelledPreview(highestRiskItem(atRiskItems), 'No urgent blockers')
			},
			{
				label: 'Due next',
				value: dueNextItems.length,
				breakdown: typeBreakdown(dueNextItems, 'No near-term dates'),
				anchor: '#due-next',
				tone: 'text-status-active',
				previewLabel: 'Next due',
				preview: labelledPreview(dueNextItems[0], 'No near-term dates')
			},
			{
				label: 'Changed recently',
				value: recentChangedItems.length,
				breakdown: typeBreakdown(recentChangedItems, 'No recent updates'),
				anchor: '#recent',
				tone: 'text-primary',
				previewLabel: 'Latest update',
				preview: labelledPreview(recentChangedItems[0], 'No recent updates')
			}
		];
	});

	$effect(() => {
		if (selectedItem) draft = draftFromItem(selectedItem);
	});

	$effect(() => {
		if (id) selectedId = id;
	});

	$effect(() => {
		if (activeType === 'observation' && statusFilter === 'open') statusFilter = 'all';
	});

	onMount(() => {
		void loadWork();
	});

	async function loadWork() {
		loading = true;
		error = null;
		saveMessage = null;
		try {
			const [itemsRes, queueRes] = await Promise.all([
				fetch('/api/work/items?limit=500&includeClosed=true'),
				fetch('/api/work/queue')
			]);
			if (!itemsRes.ok) throw new Error(`Items request failed: ${itemsRes.status}`);
			if (!queueRes.ok) throw new Error(`Queue request failed: ${queueRes.status}`);
			const itemsJson = await itemsRes.json();
			const queueJson = await queueRes.json();
			items = itemsJson.items ?? [];
			queue = queueJson.queue ?? null;
			selectedId = id ?? queue?.nextActions[0]?.id ?? items[0]?.id ?? null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load Work';
		} finally {
			loading = false;
		}
	}

	async function saveSelected(event: SubmitEvent) {
		event.preventDefault();
		if (!selectedItem) return;
		saving = true;
		error = null;
		saveMessage = null;
		try {
			const response = await fetch(`/api/work/items/${selectedItem.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payloadFromStateDraft(draft))
			});
			if (!response.ok) throw new Error(`Save failed: ${response.status}`);
			const updated = (await response.json()) as WorkItem;
			items = items.map((item) => (item.id === updated.id ? updated : item));
			saveMessage = 'Saved';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to save Work item';
		} finally {
			saving = false;
		}
	}

	function emptyDraft(): Draft {
		return {
			title: '',
			description: '',
			body: '',
			status: 'planning',
			owner: '',
			waiting_on: '',
			priority: 'normal',
			next_action: '',
			due_date: '',
			scheduled_at: '',
			stale_after: '',
			result: '',
			approval_required: false
		};
	}

	function draftFromItem(item: WorkItem): Draft {
		return {
			title: item.title,
			description: item.description ?? '',
			body: item.body ?? '',
			status: item.status,
			owner: item.owner ?? '',
			waiting_on: item.waiting_on ?? '',
			priority: item.priority ?? 'normal',
			next_action: item.next_action ?? '',
			due_date: item.due_date ?? '',
			scheduled_at: item.scheduled_at ?? '',
			stale_after: item.stale_after ?? '',
			result: item.result ?? '',
			approval_required: Boolean(item.approval_required)
		};
	}

	function payloadFromStateDraft(value: Draft) {
		return {
			status: value.status,
			waiting_on: value.waiting_on || null,
			priority: value.priority,
			actor: 'operator'
		};
	}

	function typeCount(type: WorkItemType): number {
		return items.filter((item) => item.type === type && openStatuses.has(item.status)).length;
	}

	function isOpen(item: WorkItem): boolean {
		return openStatuses.has(item.status);
	}

	function isRecent(value: number, days: number): boolean {
		const ageMs = Date.now() - value * 1000;
		return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
	}

	function childrenFor(item: WorkItem): WorkItem[] {
		return items.filter((candidate) => candidate.parent_item_id === item.id);
	}

	function openChildrenFor(item: WorkItem): WorkItem[] {
		return sortForType(item.type, childrenFor(item).filter(isOpen));
	}

	function siblingsFor(item: WorkItem): WorkItem[] {
		if (!item.parent_item_id) return [];
		return items.filter(
			(candidate) => candidate.parent_item_id === item.parent_item_id && candidate.id !== item.id
		);
	}

	function relatedItemsFor(item: WorkItem): WorkItem[] {
		const parent = parentFor(item);
		const source =
			item.type === 'project'
				? openChildrenFor(item)
				: uniqueItems([...(parent ? [parent] : []), ...childrenFor(item), ...siblingsFor(item)]);
		return source.sort(
			(a, b) =>
				statusRank(a.status) - statusRank(b.status) || b.last_activity_at - a.last_activity_at
		);
	}

	function blockersFor(item: WorkItem): WorkItem[] {
		const parent = parentFor(item);
		const source = uniqueItems([
			item,
			...childrenFor(item),
			...(parent ? childrenFor(parent) : [])
		]);
		return source
			.filter((candidate) => candidate.status === 'blocked' || candidate.priority === 'urgent')
			.sort(
				(a, b) =>
					statusRank(a.status) - statusRank(b.status) ||
					priorityRank(a.priority) - priorityRank(b.priority)
			);
	}

	function childCount(item: WorkItem, type?: WorkItemType): number {
		return childrenFor(item).filter(
			(child) => openStatuses.has(child.status) && (!type || child.type === type)
		).length;
	}

	function projectOpenWork(project: WorkItem): string {
		const parts = [
			[childCount(project, 'task'), 'task'],
			[childCount(project, 'change'), 'change'],
			[childCount(project, 'decision'), 'question']
		]
			.filter(([count]) => Number(count) > 0)
			.map(([count, label]) => `${count} ${label}${Number(count) === 1 ? '' : 's'}`);
		return parts.length ? parts.join(' · ') : 'No tracked next steps';
	}

	function projectUpcomingItem(project: WorkItem): WorkItem | null {
		const candidates = [project, ...childrenFor(project)].filter(
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

	function projectUpcoming(project: WorkItem): string {
		const upcoming = projectUpcomingItem(project);
		if (!upcoming) return 'No date on the calendar';
		const date = upcoming.due_date ?? upcoming.scheduled_at;
		const prefix = upcoming.id === project.id ? 'Project' : typeLabel(upcoming);
		return `${prefix} · ${formatDate(date)}`;
	}

	function projectDateValue(project: WorkItem): number {
		const upcoming = projectUpcomingItem(project);
		if (!upcoming) return Number.MAX_SAFE_INTEGER;
		return Math.min(dateValue(upcoming.due_date), dateValue(upcoming.scheduled_at));
	}

	function projectHealth(project: WorkItem): ProjectHealth {
		if (blockerCount(project) > 0 || project.status === 'blocked') {
			return { label: 'Blocked', tone: 'text-status-danger', rank: 0 };
		}

		const needsAttention =
			project.status === 'needs_review' ||
			project.waiting_on === 'operator' ||
			childrenFor(project).some(
				(item) =>
					isOpen(item) &&
					(item.status === 'needs_review' ||
						item.waiting_on === 'operator' ||
						(item.type === 'decision' && item.status !== 'complete'))
			);
		if (needsAttention) {
			return { label: 'Needs attention', tone: 'text-status-warning', rank: 1 };
		}

		if (projectDateValue(project) === Number.MAX_SAFE_INTEGER) {
			return { label: 'No date', tone: 'text-status-muted', rank: 2 };
		}

		return { label: 'On track', tone: 'text-status-active', rank: 3 };
	}

	function healthPillClass(label: ProjectHealth['label']): string {
		if (label === 'Blocked')
			return 'border-status-danger/35 bg-status-danger-bg text-status-danger';
		if (label === 'Needs attention')
			return 'border-status-warning/35 bg-status-warning-bg text-status-warning';
		if (label === 'On track')
			return 'border-status-active/35 bg-status-active-bg text-status-active';
		return 'border-outline-variant/60 bg-status-muted-bg text-on-surface-variant';
	}

	function signalAccentClass(anchor: OverviewAnchor): string {
		if (anchor === '#needs-you') return 'bg-status-warning';
		if (anchor === '#at-risk') return 'bg-status-danger';
		if (anchor === '#due-next') return 'bg-status-active';
		return 'bg-primary';
	}

	function sortProjectsByHealth(source: WorkItem[]): WorkItem[] {
		return [...source].sort((a, b) => {
			const healthDiff = projectHealth(a).rank - projectHealth(b).rank;
			if (healthDiff !== 0) return healthDiff;
			const dateDiff = projectDateValue(a) - projectDateValue(b);
			if (dateDiff !== 0) return dateDiff;
			return b.last_activity_at - a.last_activity_at;
		});
	}

	function projectOperatorMove(project: WorkItem): string {
		const blocked = childrenFor(project).find(
			(item) =>
				openStatuses.has(item.status) && (item.status === 'blocked' || item.priority === 'urgent')
		);
		if (blocked) return `Clear: ${blocked.title}`;
		const question = childrenFor(project).find(
			(item) => openStatuses.has(item.status) && item.type === 'decision'
		);
		if (question) return `Decide: ${question.title}`;
		const task = childrenFor(project).find(
			(item) => openStatuses.has(item.status) && item.type === 'task'
		);
		return firstText(project.next_action, task?.next_action, task?.title, 'No operator action set');
	}

	function blockerCount(item: WorkItem): number {
		const childBlockers = childrenFor(item).filter(
			(child) => child.status === 'blocked' || child.priority === 'urgent'
		).length;
		return childBlockers + (item.status === 'blocked' || item.priority === 'urgent' ? 1 : 0);
	}

	function firstText(...values: Array<string | number | null | undefined>): string {
		const value = values.find(
			(entry) => entry !== null && entry !== undefined && `${entry}`.trim()
		);
		return value === undefined || value === null ? 'Not set' : `${value}`;
	}

	function routeFor(item: WorkItem): `/work/${string}/${string}` {
		return `/work/${pathForType(item.type)}/${item.id}`;
	}

	function uniqueItems(source: WorkItem[]): WorkItem[] {
		const seen: number[] = [];
		return source.filter((item) => {
			if (seen.includes(item.id)) return false;
			seen.push(item.id);
			return true;
		});
	}

	function typeLabel(item: WorkItem): string {
		return configForType(item.type).singular;
	}

	function attentionReason(item: WorkItem): string {
		if (item.status === 'needs_review') return 'Needs review';
		if (item.status === 'blocked') return 'Blocked';
		if (item.priority === 'urgent') return 'Urgent';
		if (item.waiting_on) return `Waiting on ${waitingLabel(item.waiting_on)}`;
		return sentenceCase(formatStatus(item.status));
	}

	function labelledPreview(item: WorkItem | null | undefined, fallback: string): string {
		if (!item) return fallback;
		return `${typeLabel(item)} · ${item.title}`;
	}

	function oldestItem(source: WorkItem[]): WorkItem | null {
		return [...source].sort((a, b) => a.last_activity_at - b.last_activity_at)[0] ?? null;
	}

	function highestRiskItem(source: WorkItem[]): WorkItem | null {
		return (
			[...source].sort((a, b) => {
				return (
					statusRank(a.status) - statusRank(b.status) ||
					priorityRank(a.priority) - priorityRank(b.priority) ||
					a.last_activity_at - b.last_activity_at
				);
			})[0] ?? null
		);
	}

	function pluralize(count: number, singular: string, plural = `${singular}s`): string {
		return `${count} ${count === 1 ? singular : plural}`;
	}

	function typeBreakdown(source: WorkItem[], fallback: string): string {
		if (source.length === 0) return fallback;
		const typeOrder: Array<[WorkItemType, string, string]> = [
			['decision', 'question', 'questions'],
			['change', 'change request', 'change requests'],
			['observation', 'observation', 'observations'],
			['task', 'task', 'tasks'],
			['routine', 'routine', 'routines'],
			['project', 'project', 'projects']
		];
		const parts = typeOrder
			.map(([type, singular, plural]) => {
				const count = source.filter((item) => item.type === type).length;
				return count ? pluralize(count, singular, plural) : null;
			})
			.filter(Boolean);
		return parts.join(' · ');
	}

	function riskBreakdown(): string {
		const parts = [
			blockedItems.length ? `${blockedItems.length} blocked` : null,
			waitingExternalItems.length
				? pluralize(waitingExternalItems.length, 'external wait', 'external waits')
				: null,
			waitingAgentItems.length
				? pluralize(waitingAgentItems.length, 'agent follow-up', 'agent follow-ups')
				: null
		].filter(Boolean);
		return parts.length ? parts.join(' · ') : 'No urgent blockers';
	}

	function itemTimelineDate(item: WorkItem): number {
		if (item.type === 'routine') return dateValue(item.scheduled_at);
		return dateValue(item.due_date);
	}

	function onTimeline(value: string | null | undefined, days: number): boolean {
		const parsed = dateValue(value);
		if (parsed === Number.MAX_SAFE_INTEGER) return false;
		const now = Date.now();
		const horizon = now + days * 24 * 60 * 60 * 1000;
		const staleFloor = now - 7 * 24 * 60 * 60 * 1000;
		return parsed >= staleFloor && parsed <= horizon;
	}

	function startOfToday(): number {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), now.getDate()).valueOf();
	}

	function timelineBucket(item: WorkItem): 'today' | 'this-week' | 'next-week' | 'later' {
		const value = itemTimelineDate(item);
		const today = startOfToday();
		const tomorrow = today + 24 * 60 * 60 * 1000;
		const week = today + 7 * 24 * 60 * 60 * 1000;
		const nextWeek = today + 14 * 24 * 60 * 60 * 1000;
		if (value < tomorrow) return 'today';
		if (value < week) return 'this-week';
		if (value < nextWeek) return 'next-week';
		return 'later';
	}

	function timelineDateLabel(item: WorkItem): string {
		const label = item.type === 'routine' ? 'Next run' : 'Due';
		return `${label} ${formatDate(item.type === 'routine' ? item.scheduled_at : item.due_date)}`;
	}

	function inspect(item: WorkItem) {
		selectedId = item.id;
	}

	function parentFor(item: WorkItem): WorkItem | null {
		return items.find((candidate) => candidate.id === item.parent_item_id) ?? null;
	}

	function priorityRank(priority: WorkPriority | null): number {
		if (priority === 'urgent') return 0;
		if (priority === 'high') return 1;
		if (priority === 'normal') return 2;
		if (priority === 'low') return 3;
		return 2;
	}

	function statusRank(status: WorkStatus): number {
		if (status === 'blocked') return 0;
		if (status === 'needs_review') return 1;
		if (status === 'ready') return 2;
		if (status === 'in_progress') return 3;
		if (status === 'waiting') return 4;
		if (status === 'scheduled') return 5;
		if (status === 'planning') return 6;
		if (status === 'backlog') return 7;
		return 8;
	}

	function sortForType(type: WorkItemType, source: WorkItem[]): WorkItem[] {
		return [...source].sort((a, b) => {
			if (type === 'observation') return b.last_activity_at - a.last_activity_at;
			if (type === 'routine') {
				const dateDiff = dateValue(a.scheduled_at) - dateValue(b.scheduled_at);
				if (dateDiff !== 0) return dateDiff;
			}
			if (type === 'task') {
				const dateDiff = dateValue(a.due_date) - dateValue(b.due_date);
				if (dateDiff !== 0) return dateDiff;
			}
			return (
				statusRank(a.status) - statusRank(b.status) ||
				priorityRank(a.priority) - priorityRank(b.priority) ||
				b.last_activity_at - a.last_activity_at
			);
		});
	}

	function dateValue(value: string | null | undefined): number {
		if (!value) return Number.MAX_SAFE_INTEGER;
		const parsed = new Date(value).valueOf();
		return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
	}

	function withinDays(value: string | null | undefined, days: number): boolean {
		const parsed = dateValue(value);
		if (parsed === Number.MAX_SAFE_INTEGER) return false;
		const now = Date.now();
		const horizon = now + days * 24 * 60 * 60 * 1000;
		return parsed >= now && parsed <= horizon;
	}

	function metricFor(type: WorkItemType, label: string): number {
		if (label === 'Attention') return attentionItems.filter((item) => item.type === type).length;
		if (label === 'Blocked')
			return typeItems.filter((item) => item.status === 'blocked' || item.priority === 'urgent')
				.length;
		if (label === 'Waiting') return typeItems.filter((item) => item.waiting_on).length;
		if (label === 'Due soon')
			return typeItems.filter((item) => withinDays(item.due_date, 14)).length;
		if (label === 'Scheduled')
			return typeItems.filter((item) => withinDays(item.scheduled_at, 14)).length;
		return typeCount(type);
	}

	function pageMetricLabels(type: WorkItemType): string[] {
		if (type === 'project') return ['Active', 'Attention', 'Blocked'];
		if (type === 'change') return ['Open', 'Attention', 'Waiting'];
		if (type === 'decision') return ['Open', 'Attention', 'Waiting'];
		if (type === 'task') return ['Open', 'Due soon', 'Blocked'];
		if (type === 'routine') return ['Open', 'Scheduled', 'Attention'];
		if (type === 'observation') return ['Open', 'Attention', 'Waiting'];
		return ['Open', 'Attention', 'Waiting'];
	}

	function compactDetail(item: WorkItem): string {
		if (item.type === 'decision') return firstText(item.next_action, item.body, item.description);
		if (item.type === 'change') return firstText(item.next_action, item.description, item.body);
		if (item.type === 'task') return firstText(item.next_action, item.description, item.body);
		if (item.type === 'routine') return firstText(item.result, item.next_action, item.description);
		if (item.type === 'observation')
			return firstText(item.description, item.body, item.next_action);
		return firstText(item.next_action, item.description, item.body);
	}

	function detailLead(item: WorkItem): string {
		if (item.type === 'project')
			return firstText(item.description, item.body, 'No outcome narrative recorded yet.');
		if (item.type === 'change')
			return firstText(item.description, item.body, 'No change scope recorded yet.');
		if (item.type === 'decision')
			return firstText(item.body, item.description, 'No question context recorded yet.');
		if (item.type === 'task')
			return firstText(item.next_action, item.description, 'No action text recorded yet.');
		if (item.type === 'routine')
			return firstText(item.description, item.body, 'No routine purpose recorded yet.');
		if (item.type === 'observation')
			return firstText(item.description, item.body, 'No observation text recorded yet.');
		return compactDetail(item);
	}

	function detailSections(item: WorkItem): DetailSection[] {
		if (item.type === 'project') {
			return [
				{ title: 'Outcome', text: detailLead(item) },
				{ title: 'Next move', text: firstText(item.next_action, projectOperatorMove(item)) }
			];
		}
		if (item.type === 'change') {
			return [
				{ title: 'Scope', text: firstText(item.description, item.body, 'No scope recorded yet.') },
				{ title: 'Next action', text: firstText(item.next_action, 'No next action recorded yet.') }
			];
		}
		if (item.type === 'decision') {
			return [
				{ title: 'Question', text: firstText(item.body, item.description, item.title) },
				{
					title: 'Recommendation',
					text: firstText(item.next_action, 'No recommendation recorded yet.')
				}
			];
		}
		if (item.type === 'task') {
			return [
				{ title: 'Action', text: firstText(item.next_action, item.description, item.title) },
				{
					title: 'Context',
					text: firstText(item.body, item.description, 'No added context recorded yet.')
				}
			];
		}
		if (item.type === 'routine') {
			return [
				{ title: 'Routine purpose', text: firstText(item.description, item.body, item.title) },
				{ title: 'Latest result', text: firstText(item.result, 'No latest result recorded yet.') }
			];
		}
		if (item.type === 'observation') {
			return [
				{ title: 'Finding', text: firstText(item.description, item.body, item.title) },
				{ title: 'Triage note', text: firstText(item.next_action, 'No triage note recorded yet.') }
			];
		}
		return [{ title: 'Summary', text: compactDetail(item) }];
	}

	function quickFacts(item: WorkItem): DetailFact[] {
		const parent = parentFor(item);
		if (item.type === 'project') {
			return [
				{ label: 'Health', value: projectHealth(item).label, tone: projectHealth(item).tone },
				{ label: 'Next date', value: projectUpcoming(item) },
				{ label: 'Open work', value: projectOpenWork(item) },
				{
					label: 'Blockers',
					value: `${blockerCount(item)}`,
					tone: blockerCount(item) ? 'text-status-danger' : 'text-status-muted'
				}
			];
		}
		if (item.type === 'change') {
			return [
				{
					label: 'Approval',
					value: item.approval_required ? 'Required' : 'Not required',
					tone: item.approval_required ? 'text-status-warning' : 'text-status-muted'
				},
				{ label: 'Waiting', value: waitingLabel(item.waiting_on) },
				{ label: 'Parent', value: parent ? itemDisplayId(parent) : 'No parent' },
				{ label: 'Updated', value: formatDateTime(item.last_activity_at) }
			];
		}
		if (item.type === 'decision') {
			return [
				{
					label: 'Impact',
					value: sentenceCase(item.priority ?? 'normal'),
					tone: priorityTone(item.priority)
				},
				{ label: 'Waiting', value: waitingLabel(item.waiting_on) },
				{ label: 'Parent', value: parent ? itemDisplayId(parent) : 'No parent' },
				{ label: 'Updated', value: formatDateTime(item.last_activity_at) }
			];
		}
		if (item.type === 'task') {
			return [
				{ label: 'Due', value: formatDate(item.due_date) },
				{ label: 'Parent', value: parent ? itemDisplayId(parent) : 'No parent' },
				{ label: 'Waiting', value: waitingLabel(item.waiting_on) },
				{ label: 'Updated', value: formatDateTime(item.last_activity_at) }
			];
		}
		if (item.type === 'routine') {
			return [
				{ label: 'Next run', value: formatDateTime(item.scheduled_at) },
				{ label: 'Cadence', value: firstText(item.stale_after, 'Not set') },
				{ label: 'Waiting', value: waitingLabel(item.waiting_on) },
				{ label: 'Updated', value: formatDateTime(item.last_activity_at) }
			];
		}
		if (item.type === 'observation') {
			return [
				{ label: 'Captured', value: formatDateTime(item.created_at) },
				{ label: 'Source', value: firstText(item.owner, item.area_id, 'Work') },
				{ label: 'Parent', value: parent ? itemDisplayId(parent) : 'No parent' },
				{ label: 'Updated', value: formatDateTime(item.last_activity_at) }
			];
		}
		return [
			{ label: 'Waiting', value: waitingLabel(item.waiting_on) },
			{ label: 'Updated', value: formatDateTime(item.last_activity_at) }
		];
	}

	function detailStatusLine(item: WorkItem): string {
		const parts = [
			formatStatus(item.status),
			sentenceCase(item.priority ?? 'normal'),
			waitingLabel(item.waiting_on)
		];
		return parts.join(' · ');
	}

	function relationHeading(item: WorkItem): string {
		if (item.type === 'project') return 'Open project work';
		if (parentFor(item)) return 'Related project work';
		return 'Related work';
	}

	function relationDescription(item: WorkItem): string {
		if (item.type === 'project') return 'Child work attached to this project.';
		if (parentFor(item)) return 'Parent project and nearby sibling work.';
		return 'Attached child work and surrounding context.';
	}

	function emptyRelationText(item: WorkItem): string {
		if (item.type === 'project') return 'No child work is attached to this project.';
		return 'No related Work items are attached.';
	}

	function selectedRowClass(item: WorkItem): string {
		return selectedItem?.id === item.id ? 'bg-surface-2/80 ring-1 ring-inset ring-primary/35' : '';
	}
</script>

<svelte:head>
	<title>{title} - Falcon Dash</title>
</svelte:head>

<FalconModuleShell active="Work" eyebrow="Falcon Dash / Work" {title} {description}>
	<div class="min-h-full bg-surface-0 px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
		{#if loading}
			<div class="falcon-soft-panel p-5 text-sm text-on-surface-variant">Loading Work...</div>
		{:else if error && items.length === 0}
			<div
				class="falcon-soft-panel border-status-danger/40 bg-status-danger-bg p-5 text-sm text-status-danger"
			>
				{error}
			</div>
		{:else}
			<div class="mx-auto flex max-w-[1500px] flex-col gap-3">
				<section
					class="sticky top-2 z-30 overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-1/95 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur"
				>
					<nav class="flex gap-1 overflow-x-auto px-2 py-1.5">
						<a
							href={resolve('/work')}
							class="falcon-focus rounded-md px-3 py-1.5 text-sm font-semibold transition {mode ===
							'overview'
								? 'bg-primary text-primary-foreground'
								: 'text-on-surface-variant hover:bg-surface-2 hover:text-on-surface'}"
						>
							Overview
						</a>
						{#each visibleTypeConfigs as config (config.type)}
							<a
								href={resolve(`/work/${config.path}`)}
								class="falcon-focus rounded-md px-3 py-1.5 text-sm font-semibold transition {activeType ===
									config.type && mode !== 'overview'
									? 'bg-primary text-primary-foreground'
									: 'text-on-surface-variant hover:bg-surface-2 hover:text-on-surface'}"
							>
								{config.label}
							</a>
						{/each}
					</nav>
				</section>

				{#if mode === 'section'}
					<section class="falcon-soft-panel grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
						<div class="min-w-0">
							<h2 class="text-2xl font-semibold leading-tight text-on-surface sm:text-3xl">
								{activeConfig.title}
							</h2>
							<p class="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
								{activeConfig.summary}
							</p>
						</div>
						<div class="grid grid-cols-3 gap-2 lg:w-[24rem]">
							{#each pageMetricLabels(activeType) as metric (metric)}
								<div class="falcon-subtle-panel p-3">
									<p class="text-xs text-on-surface-variant">{metric}</p>
									<p class="mt-1 text-2xl font-semibold text-on-surface">
										{metricFor(activeType, metric)}
									</p>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if mode === 'overview'}
					<section
						class="falcon-soft-panel overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.14)]"
						aria-label="Executive signals"
					>
						<div
							class="grid divide-y divide-outline-variant/45 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4"
						>
							{#each overviewSignals as signal (signal.label)}
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									href={resolve('/work') + signal.anchor}
									data-testid={`overview-signal-${signal.anchor.slice(1)}`}
									class="falcon-focus group relative min-h-28 p-4 transition hover:bg-surface-2/55"
								>
									<span
										class="absolute inset-x-4 top-0 h-0.5 rounded-full {signalAccentClass(
											signal.anchor
										)}"
									></span>
									<div class="flex items-baseline justify-between gap-4">
										<p class="text-sm font-semibold text-on-surface">{signal.label}</p>
										<p class="text-3xl font-semibold leading-none {signal.tone}">
											{signal.value}
										</p>
									</div>
									<p class="mt-3 line-clamp-2 min-h-9 text-sm leading-5 text-on-surface-variant">
										{signal.breakdown}
									</p>
									<div class="mt-3 flex min-w-0 items-center gap-2 text-xs">
										<span class="shrink-0 font-semibold text-on-surface-variant">
											{signal.previewLabel}
										</span>
										<span class="min-w-0 truncate text-on-surface">{signal.preview}</span>
									</div>
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/each}
						</div>
					</section>

					<section
						id="project-health"
						data-testid="project-health"
						tabindex="-1"
						class="scroll-mt-24 overflow-hidden rounded-lg border border-outline-variant/65 bg-surface-1 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
					>
						<div
							class="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant/55 bg-surface-2/35 px-4 py-3"
						>
							<div>
								<h3 class="text-xl font-semibold leading-tight text-on-surface">Project health</h3>
								<p class="mt-1 max-w-2xl text-sm leading-5 text-on-surface-variant">
									Active outcomes sorted by risk, next date, and recent movement.
								</p>
							</div>
							<a
								href={resolve('/work/projects')}
								class="falcon-focus inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-primary transition hover:bg-surface-2"
							>
								All projects <ArrowRight class="h-4 w-4" />
							</a>
						</div>
						<div
							class="hidden border-b border-outline-variant/45 bg-surface-0/35 px-4 py-2 text-xs font-semibold text-on-surface-variant lg:grid lg:grid-cols-[minmax(16rem,1.25fr)_9rem_minmax(10rem,0.8fr)_minmax(16rem,1fr)_minmax(10rem,0.75fr)] lg:gap-4"
						>
							<span>Project</span>
							<span>Health</span>
							<span>Next date</span>
							<span>Next move</span>
							<span>Open work</span>
						</div>
						<div class="divide-y divide-outline-variant/35">
							{#each activeProjects as project (project.id)}
								{@const health = projectHealth(project)}
								<a
									href={resolve(routeFor(project))}
									data-testid="project-health-row"
									class="grid gap-3 px-4 py-4 transition hover:bg-surface-2/55 lg:grid-cols-[minmax(16rem,1.25fr)_9rem_minmax(10rem,0.8fr)_minmax(16rem,1fr)_minmax(10rem,0.75fr)] lg:items-center lg:gap-4"
								>
									<div class="min-w-0">
										<div class="flex min-w-0 flex-wrap items-center gap-2">
											<span class="truncate font-semibold text-on-surface">{project.title}</span>
											<span class="text-xs text-on-surface-variant">{itemDisplayId(project)}</span>
										</div>
										<p class="mt-1 line-clamp-2 text-sm leading-5 text-on-surface-variant/90">
											{firstText(project.description, project.body, 'Outcome not written yet')}
										</p>
									</div>
									<div>
										<p class="text-xs text-on-surface-variant lg:hidden">Health</p>
										<span
											class="mt-1 inline-flex rounded-md border px-2 py-1 text-xs font-semibold {healthPillClass(
												health.label
											)}"
										>
											{health.label}
										</span>
									</div>
									<div>
										<p class="text-xs text-on-surface-variant lg:hidden">Next date</p>
										<p class="mt-1 text-sm font-semibold leading-5 text-on-surface">
											{projectUpcoming(project)}
										</p>
									</div>
									<div>
										<p class="text-xs text-on-surface-variant lg:hidden">Next move</p>
										<p class="mt-1 line-clamp-2 text-sm leading-5 text-on-surface">
											{projectOperatorMove(project)}
										</p>
									</div>
									<div>
										<p class="text-xs text-on-surface-variant lg:hidden">Open work</p>
										<p class="mt-1 text-sm font-semibold leading-5 text-on-surface">
											{projectOpenWork(project)}
										</p>
									</div>
								</a>
							{:else}
								<p class="p-4 text-sm text-on-surface-variant">No active projects.</p>
							{/each}
						</div>
					</section>

					<section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
						<div
							id="needs-you"
							data-testid="needs-you-section"
							tabindex="-1"
							class="scroll-mt-24 overflow-hidden rounded-lg border border-outline-variant/55 bg-surface-1"
						>
							<div class="border-b border-outline-variant/45 px-4 py-3">
								<div>
									<h3 class="text-lg font-semibold text-on-surface">Needs your call</h3>
									<p class="mt-1 text-sm text-on-surface-variant">
										Grouped by the kind of judgment or approval being asked for.
									</p>
								</div>
							</div>
							<div class="divide-y divide-outline-variant/35">
								{#each needsYourCallGroups as group (group.title)}
									<div class="grid gap-0 md:grid-cols-[11rem_minmax(0,1fr)]">
										<div class="border-b border-outline-variant/25 px-4 py-3 md:border-b-0">
											<div>
												<div class="flex items-center justify-between gap-3 md:block">
													<h4 class="text-sm font-semibold text-on-surface">{group.title}</h4>
													<span class="text-sm font-semibold text-on-surface md:hidden">
														{group.items.length}
													</span>
												</div>
												<p class="mt-0.5 text-xs leading-5 text-on-surface-variant">
													{group.description}
												</p>
											</div>
										</div>
										<div
											class="divide-y divide-outline-variant/30 md:border-l md:border-outline-variant/35"
										>
											{#each group.items.slice(0, 4) as item (item.id)}
												<a
													href={resolve(routeFor(item))}
													class="grid gap-2 px-4 py-3 transition hover:bg-surface-2/50 md:grid-cols-[minmax(0,1fr)_8rem] md:items-center"
												>
													<div class="min-w-0">
														<div class="flex flex-wrap items-center gap-2 text-xs">
															<span class={statusTone(item.status)}>{attentionReason(item)}</span>
															<span class="text-on-surface-variant">{itemDisplayId(item)}</span>
														</div>
														<p class="mt-1 truncate text-sm font-semibold text-on-surface">
															{item.title}
														</p>
														<p class="mt-1 line-clamp-1 text-xs leading-5 text-on-surface-variant">
															{compactDetail(item)}
														</p>
													</div>
													<span class="hidden text-right text-xs text-on-surface-variant md:block">
														{typeLabel(item)}
													</span>
												</a>
											{:else}
												<p class="p-3 text-sm text-on-surface-variant">{group.empty}</p>
											{/each}
										</div>
									</div>
								{:else}
									<p class="p-4 text-sm text-on-surface-variant">
										Nothing currently needs your decision.
									</p>
								{/each}
							</div>
						</div>

						<div
							id="at-risk"
							data-testid="at-risk-section"
							tabindex="-1"
							class="scroll-mt-24 overflow-hidden rounded-lg border border-outline-variant/55 bg-surface-1"
						>
							<div class="border-b border-outline-variant/45 px-4 py-3">
								<h3 class="text-lg font-semibold text-on-surface">At risk and waiting</h3>
								<p class="mt-1 text-sm text-on-surface-variant">
									Blocked work and dependencies that can stall real-world progress.
								</p>
							</div>
							<div class="divide-y divide-outline-variant/35">
								{#each atRiskGroups as group (group.title)}
									<div class="grid gap-0 md:grid-cols-[11rem_minmax(0,1fr)]">
										<div class="border-b border-outline-variant/25 px-4 py-3 md:border-b-0">
											<div>
												<div class="flex items-center justify-between gap-3 md:block">
													<h4 class="text-sm font-semibold text-on-surface">{group.title}</h4>
													<span class="text-sm font-semibold text-on-surface md:hidden">
														{group.items.length}
													</span>
												</div>
												<p class="mt-0.5 text-xs leading-5 text-on-surface-variant">
													{group.description}
												</p>
											</div>
										</div>
										<div
											class="divide-y divide-outline-variant/30 md:border-l md:border-outline-variant/35"
										>
											{#each group.items.slice(0, 4) as item (item.id)}
												<a
													href={resolve(routeFor(item))}
													class="grid gap-2 px-4 py-3 transition hover:bg-surface-2/50 md:grid-cols-[minmax(0,1fr)_8rem] md:items-center"
												>
													<div class="min-w-0">
														<div class="flex flex-wrap items-center gap-2 text-xs">
															<span class={statusTone(item.status)}>
																{attentionReason(item)}
															</span>
															<span class="text-on-surface-variant">{itemDisplayId(item)}</span>
														</div>
														<p class="mt-1 truncate text-sm font-semibold text-on-surface">
															{item.title}
														</p>
														<p class="mt-1 line-clamp-1 text-xs leading-5 text-on-surface-variant">
															{compactDetail(item)}
														</p>
													</div>
													<span class="hidden text-right text-xs text-on-surface-variant md:block">
														{typeLabel(item)}
													</span>
												</a>
											{:else}
												<p class="p-3 text-sm text-on-surface-variant">{group.empty}</p>
											{/each}
										</div>
									</div>
								{:else}
									<p class="p-4 text-sm text-on-surface-variant">
										Nothing currently needs your attention.
									</p>
								{/each}
							</div>
						</div>
					</section>

					<section
						id="due-next"
						data-testid="due-next-section"
						tabindex="-1"
						class="scroll-mt-24 overflow-hidden rounded-lg border border-outline-variant/55 bg-surface-1"
					>
						<div class="border-b border-outline-variant/45 px-4 py-3">
							<h3 class="text-lg font-semibold text-on-surface">Due next</h3>
							<p class="mt-1 text-sm text-on-surface-variant">
								Tasks and routine checks on the near-term calendar.
							</p>
						</div>
						<div
							class="grid divide-y divide-outline-variant/35 lg:grid-cols-4 lg:divide-x lg:divide-y-0"
						>
							{#each dueNextGroups as group (group.title)}
								<div class="min-w-0">
									<div class="flex items-baseline justify-between gap-3 px-4 py-3">
										<h4 class="text-sm font-semibold text-on-surface">{group.title}</h4>
										<p class="text-xs text-on-surface-variant">
											{pluralize(group.items.length, 'item')}
										</p>
									</div>
									<div class="divide-y divide-outline-variant/30">
										{#each group.items.slice(0, 4) as item (item.id)}
											<a
												href={resolve(routeFor(item))}
												class="block px-4 py-3 transition hover:bg-surface-2/50"
											>
												<div class="flex min-w-0 flex-wrap items-center gap-2 text-xs">
													<span class="text-on-surface-variant">{typeLabel(item)}</span>
													<span class="text-xs {statusTone(item.status)}">
														{formatStatus(item.status)}
													</span>
												</div>
												<p
													class="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-on-surface"
												>
													{item.title}
												</p>
												<p class="mt-1 text-xs leading-5 text-on-surface-variant">
													{timelineDateLabel(item)}
												</p>
											</a>
										{:else}
											<p class="px-4 py-3 text-sm text-on-surface-variant">
												No items in this window.
											</p>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</section>

					<section
						id="recent"
						data-testid="recent-section"
						tabindex="-1"
						class="scroll-mt-24 overflow-hidden rounded-lg border border-outline-variant/45 bg-surface-1/70"
					>
						<div
							class="flex items-center justify-between border-b border-outline-variant/40 px-4 py-3"
						>
							<div>
								<h3 class="text-lg font-semibold text-on-surface">Recent activity</h3>
								<p class="mt-1 text-sm text-on-surface-variant">Newest Work updates in order.</p>
							</div>
							<Clock class="h-5 w-5 text-on-surface-variant" />
						</div>
						<div class="divide-y divide-outline-variant/30" data-testid="recent-activity-list">
							{#each recentItems.slice(0, 12) as item (item.id)}
								<a
									href={resolve(routeFor(item))}
									class="grid gap-3 px-4 py-3 transition hover:bg-surface-2/45 md:grid-cols-[8rem_1fr_auto]"
								>
									<div class="text-xs text-on-surface-variant">
										{formatDateTime(item.last_activity_at)}
									</div>
									<div class="min-w-0">
										<div class="flex flex-wrap items-center gap-2 text-xs">
											<span class="text-on-surface-variant">{typeLabel(item)}</span>
											<span class="text-xs {statusTone(item.status)}">
												{formatStatus(item.status)}
											</span>
										</div>
										<p class="mt-1 truncate text-sm font-semibold text-on-surface">{item.title}</p>
									</div>
									<div class="text-xs text-on-surface-variant md:text-right">
										{itemDisplayId(item)}
									</div>
								</a>
							{/each}
						</div>
					</section>
				{:else if mode === 'detail'}
					{#if selectedItem}
						<section
							class="overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-1 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
							data-testid="work-detail-page"
						>
							<div class="border-b border-outline-variant/55 bg-surface-2/35 px-4 py-4 sm:px-5">
								<a
									href={resolve(`/work/${activeConfig.path}`)}
									class="falcon-focus inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-primary transition hover:bg-surface-2"
								>
									<ArrowRight class="h-4 w-4 rotate-180" />
									Back to {activeConfig.label.toLowerCase()}
								</a>
								<div class="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-start">
									<div class="min-w-0">
										<div class="flex flex-wrap items-center gap-2">
											<span class="falcon-chip px-2 py-1 text-xs">
												{itemDisplayId(selectedItem)}
											</span>
											<span class="text-sm {statusTone(selectedItem.status)}">
												{formatStatus(selectedItem.status)}
											</span>
											<span class="text-sm {priorityTone(selectedItem.priority)}">
												{sentenceCase(selectedItem.priority ?? 'normal')}
											</span>
										</div>
										<h2
											class="mt-3 max-w-5xl text-3xl font-semibold leading-tight text-on-surface sm:text-4xl"
										>
											{selectedItem.title}
										</h2>
										<p class="mt-3 max-w-4xl text-sm leading-6 text-on-surface-variant">
											{detailLead(selectedItem)}
										</p>
									</div>
									<form class="falcon-subtle-panel space-y-3 p-4" onsubmit={saveSelected}>
										<div class="flex items-center justify-between gap-3">
											<h3 class="text-sm font-semibold text-on-surface">State</h3>
											{#if saveMessage}<span class="text-xs text-status-active">{saveMessage}</span
												>{/if}
										</div>
										<div class="grid grid-cols-2 gap-2">
											<label class="grid gap-1 text-xs text-on-surface-variant">
												Status
												<select
													bind:value={draft.status}
													class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
												>
													{#each workStatuses as status (status)}
														<option value={status}>{sentenceCase(formatStatus(status))}</option>
													{/each}
												</select>
											</label>
											<label class="grid gap-1 text-xs text-on-surface-variant">
												Priority
												<select
													bind:value={draft.priority}
													class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
												>
													<option value="low">Low</option>
													<option value="normal">Normal</option>
													<option value="high">High</option>
													<option value="urgent">Urgent</option>
												</select>
											</label>
										</div>
										<label class="grid gap-1 text-xs text-on-surface-variant">
											Waiting on
											<select
												bind:value={draft.waiting_on}
												class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
											>
												{#each waitingOptions as option (option.value)}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
										</label>
										<button
											type="submit"
											disabled={saving}
											class="falcon-focus inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
										>
											<Save class="h-4 w-4" />
											{saving ? 'Saving...' : 'Save state'}
										</button>
										{#if error}<p class="text-sm text-status-danger">{error}</p>{/if}
									</form>
								</div>
							</div>

							<div class="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
								<div class="min-w-0 space-y-5">
									<div class="grid gap-3 md:grid-cols-4">
										{#each quickFacts(selectedItem) as fact (fact.label)}
											<div class="rounded-md border border-outline-variant/45 bg-surface-0/45 p-3">
												<p class="text-xs text-on-surface-variant">{fact.label}</p>
												<p
													class="mt-1 line-clamp-2 text-sm font-semibold text-on-surface {fact.tone ??
														''}"
												>
													{fact.value}
												</p>
											</div>
										{/each}
									</div>

									<div class="rounded-lg border border-outline-variant/45 bg-surface-0/35">
										{#each detailSections(selectedItem) as section (section.title)}
											<div class="border-b border-outline-variant/35 p-4 last:border-b-0">
												<h3 class="text-sm font-semibold text-on-surface">{section.title}</h3>
												<p
													class="mt-2 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant"
												>
													{section.text}
												</p>
											</div>
										{/each}
									</div>

									{#if blockersFor(selectedItem).length}
										<section
											class="rounded-lg border border-status-danger/35 bg-status-danger-bg/45"
										>
											<div class="border-b border-status-danger/25 px-4 py-3">
												<h3 class="text-sm font-semibold text-status-danger">Blockers</h3>
												<p class="mt-1 text-xs text-on-surface-variant">
													Urgent or blocked work attached to this record.
												</p>
											</div>
											<div class="divide-y divide-status-danger/20">
												{#each blockersFor(selectedItem) as blocker (blocker.id)}
													<a
														href={resolve(routeFor(blocker))}
														class="block px-4 py-3 transition hover:bg-status-danger-bg"
													>
														<div class="flex flex-wrap items-center gap-2 text-xs">
															<span class="text-status-danger">{attentionReason(blocker)}</span>
															<span class="text-on-surface-variant">{itemDisplayId(blocker)}</span>
														</div>
														<p class="mt-1 text-sm font-semibold text-on-surface">
															{blocker.title}
														</p>
														<p class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
															{compactDetail(blocker)}
														</p>
													</a>
												{/each}
											</div>
										</section>
									{/if}

									<section class="rounded-lg border border-outline-variant/45 bg-surface-0/25">
										<div class="border-b border-outline-variant/35 px-4 py-3">
											<h3 class="text-sm font-semibold text-on-surface">
												{relationHeading(selectedItem)}
											</h3>
											<p class="mt-1 text-xs text-on-surface-variant">
												{relationDescription(selectedItem)}
											</p>
										</div>
										<div class="divide-y divide-outline-variant/30">
											{#each relatedItemsFor(selectedItem) as related (related.id)}
												<a
													href={resolve(routeFor(related))}
													class="grid gap-2 px-4 py-3 transition hover:bg-surface-2/45 md:grid-cols-[minmax(0,1fr)_8rem]"
												>
													<div class="min-w-0">
														<div class="flex flex-wrap items-center gap-2 text-xs">
															<span class="text-on-surface-variant">{typeLabel(related)}</span>
															<span class={statusTone(related.status)}>
																{formatStatus(related.status)}
															</span>
															<span class="text-on-surface-variant">{itemDisplayId(related)}</span>
														</div>
														<p class="mt-1 truncate text-sm font-semibold text-on-surface">
															{related.title}
														</p>
														<p class="mt-1 line-clamp-1 text-xs leading-5 text-on-surface-variant">
															{compactDetail(related)}
														</p>
													</div>
													<p class="text-xs text-on-surface-variant md:text-right">
														{formatDateTime(related.last_activity_at)}
													</p>
												</a>
											{:else}
												<p class="px-4 py-3 text-sm text-on-surface-variant">
													{emptyRelationText(selectedItem)}
												</p>
											{/each}
										</div>
									</section>
								</div>

								<aside class="space-y-4">
									<div class="rounded-lg border border-outline-variant/45 bg-surface-0/35 p-4">
										<h3 class="text-sm font-semibold text-on-surface">Record</h3>
										<div class="mt-3 space-y-3 text-sm">
											<div>
												<p class="text-xs text-on-surface-variant">Type</p>
												<p class="mt-1 font-semibold text-on-surface">{typeLabel(selectedItem)}</p>
											</div>
											<div>
												<p class="text-xs text-on-surface-variant">Current state</p>
												<p class="mt-1 font-semibold text-on-surface">
													{detailStatusLine(selectedItem)}
												</p>
											</div>
											<div>
												<p class="text-xs text-on-surface-variant">Owner/source</p>
												<p class="mt-1 font-semibold text-on-surface">
													{firstText(selectedItem.owner, selectedItem.area_id, 'Not set')}
												</p>
											</div>
											<div>
												<p class="text-xs text-on-surface-variant">Created</p>
												<p class="mt-1 font-semibold text-on-surface">
													{formatDateTime(selectedItem.created_at)}
												</p>
											</div>
										</div>
									</div>
								</aside>
							</div>
						</section>
					{:else}
						<section class="falcon-soft-panel p-5">
							<h2 class="text-lg font-semibold text-on-surface">Work item not found</h2>
							<p class="mt-2 text-sm text-on-surface-variant">
								This record is not available in the current Work database.
							</p>
							<a
								href={resolve(`/work/${activeConfig.path}`)}
								class="mt-4 inline-flex text-sm font-semibold text-primary hover:text-primary/80"
							>
								Back to {activeConfig.label.toLowerCase()}
							</a>
						</section>
					{/if}
				{:else}
					<section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
						<div class="falcon-soft-panel overflow-hidden">
							<div class="border-b border-outline-variant/60 p-4">
								<div class="grid gap-2 md:grid-cols-[1fr_auto_auto]">
									<label class="relative block">
										<Search
											class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-on-surface-variant"
										/>
										<input
											type="search"
											bind:value={search}
											placeholder={`Search ${activeConfig.label.toLowerCase()}...`}
											class="falcon-focus min-h-10 w-full rounded-md border border-outline-variant/70 bg-surface-0 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant"
										/>
									</label>
									<select
										bind:value={statusFilter}
										class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-0 px-3 text-sm text-on-surface"
									>
										<option value="open">Open status</option>
										{#each workStatuses as status (status)}
											<option value={status}>{sentenceCase(formatStatus(status))}</option>
										{/each}
										<option value="all">All status</option>
									</select>
									<button
										type="button"
										onclick={loadWork}
										class="falcon-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-outline-variant/70 px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-2"
									>
										<RefreshCw class="h-4 w-4" />
										Refresh
									</button>
								</div>
							</div>

							{#if activeType === 'project'}
								<div class="divide-y divide-outline-variant/50">
									{#each filteredItems as project (project.id)}
										<button
											type="button"
											onclick={() => inspect(project)}
											data-testid="work-section-row"
											aria-pressed={selectedItem?.id === project.id}
											class="block w-full p-4 text-left transition hover:bg-surface-2/70 {selectedRowClass(
												project
											)}"
										>
											<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
												<div class="min-w-0">
													<div class="flex flex-wrap items-center gap-2">
														<span class="text-base font-semibold text-on-surface"
															>{project.title}</span
														>
														<span class="falcon-chip px-2 py-0.5 text-xs">
															{itemDisplayId(project)}
														</span>
														<span class="text-xs {statusTone(project.status)}"
															>{formatStatus(project.status)}</span
														>
													</div>
													<p class="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
														{firstText(
															project.description,
															project.body,
															'Outcome not written yet'
														)}
													</p>
													<p class="mt-3 text-sm font-semibold text-on-surface">
														Your next move: {projectOperatorMove(project)}
													</p>
												</div>
												<div class="grid gap-2 sm:grid-cols-[1fr_1fr_7rem]">
													<div class="falcon-subtle-panel px-3 py-3">
														<p class="text-xs text-on-surface-variant">Coming up</p>
														<p class="mt-1 line-clamp-2 text-sm font-semibold text-on-surface">
															{projectUpcoming(project)}
														</p>
													</div>
													<div class="falcon-subtle-panel px-3 py-3">
														<p class="text-xs text-on-surface-variant">Open work</p>
														<p class="mt-1 line-clamp-2 text-sm font-semibold text-on-surface">
															{projectOpenWork(project)}
														</p>
													</div>
													<div class="falcon-subtle-panel px-2 py-3">
														<p
															class="text-lg font-semibold {blockerCount(project)
																? 'text-status-danger'
																: 'text-status-muted'}"
														>
															{blockerCount(project)}
														</p>
														<p class="mt-1 text-[0.7rem] text-on-surface-variant">blockers</p>
													</div>
												</div>
											</div>
										</button>
									{:else}
										<p class="p-4 text-sm text-on-surface-variant">{activeConfig.empty}</p>
									{/each}
								</div>
							{:else if activeType === 'change'}
								<div class="divide-y divide-outline-variant/50">
									{#each filteredItems as change (change.id)}
										<button
											type="button"
											onclick={() => inspect(change)}
											data-testid="work-section-row"
											aria-pressed={selectedItem?.id === change.id}
											class="grid w-full gap-3 p-4 text-left transition hover:bg-surface-2/70 lg:grid-cols-[minmax(0,1fr)_11rem_9rem] {selectedRowClass(
												change
											)}"
										>
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<span class="text-base font-semibold text-on-surface">{change.title}</span
													>
													<span class="falcon-chip px-2 py-0.5 text-xs"
														>{itemDisplayId(change)}</span
													>
												</div>
												<p class="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
													{firstText(change.description, change.body, 'Scope not set')}
												</p>
												<p class="mt-2 text-sm font-semibold text-on-surface">
													Next: {firstText(change.next_action, 'No next action set')}
												</p>
											</div>
											<div>
												<p class="text-xs text-on-surface-variant">Approval</p>
												<p
													class="mt-1 text-sm font-semibold {change.approval_required
														? 'text-status-warning'
														: 'text-status-muted'}"
												>
													{change.approval_required ? 'Required' : 'Not required'}
												</p>
												<p class="mt-2 text-xs {statusTone(change.status)}">
													{formatStatus(change.status)}
												</p>
											</div>
											<div>
												<p class="text-xs text-on-surface-variant">Waiting</p>
												<p class="mt-1 text-sm font-semibold text-on-surface">
													{waitingLabel(change.waiting_on)}
												</p>
												<p class="mt-2 text-xs {priorityTone(change.priority)}">
													{sentenceCase(change.priority ?? 'normal')}
												</p>
											</div>
										</button>
									{:else}
										<p class="p-4 text-sm text-on-surface-variant">{activeConfig.empty}</p>
									{/each}
								</div>
							{:else if activeType === 'decision'}
								<div class="grid gap-3 p-3">
									{#each filteredItems as question (question.id)}
										<button
											type="button"
											onclick={() => inspect(question)}
											data-testid="work-section-row"
											aria-pressed={selectedItem?.id === question.id}
											class="falcon-subtle-panel block w-full p-4 text-left transition hover:border-primary/35 hover:bg-surface-2/70 {selectedRowClass(
												question
											)}"
										>
											<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
												<div class="min-w-0">
													<div class="flex flex-wrap items-center gap-2">
														<span class="text-base font-semibold text-on-surface"
															>{question.title}</span
														>
														<span class="falcon-chip px-2 py-0.5 text-xs">
															{itemDisplayId(question)}
														</span>
														<span class="text-xs {statusTone(question.status)}">
															{formatStatus(question.status)}
														</span>
													</div>
													<p class="mt-2 text-xs font-semibold text-on-surface-variant">
														Recommended answer
													</p>
													<p class="mt-1 line-clamp-2 text-sm leading-6 text-on-surface">
														{firstText(question.next_action, 'No recommendation recorded')}
													</p>
													<p class="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
														{firstText(
															question.body,
															question.description,
															'No context written yet'
														)}
													</p>
												</div>
												<div class="falcon-subtle-panel p-3">
													<p class="text-xs text-on-surface-variant">Impact</p>
													<p class="mt-1 text-sm font-semibold {priorityTone(question.priority)}">
														{sentenceCase(question.priority ?? 'normal')}
													</p>
													<p class="mt-3 text-xs text-on-surface-variant">Waiting</p>
													<p class="mt-1 text-sm font-semibold text-on-surface">
														{waitingLabel(question.waiting_on)}
													</p>
												</div>
											</div>
										</button>
									{:else}
										<p class="p-4 text-sm text-on-surface-variant">{activeConfig.empty}</p>
									{/each}
								</div>
							{:else if activeType === 'task'}
								<div class="divide-y divide-outline-variant/50">
									{#each filteredItems as task (task.id)}
										<button
											type="button"
											onclick={() => inspect(task)}
											data-testid="work-section-row"
											aria-pressed={selectedItem?.id === task.id}
											class="grid w-full gap-3 p-4 text-left transition hover:bg-surface-2/70 lg:grid-cols-[1.4rem_minmax(0,1fr)_10rem_10rem] {selectedRowClass(
												task
											)}"
										>
											<div class="pt-1">
												<CheckCircle2
													class="h-5 w-5 {task.status === 'complete'
														? 'text-status-active'
														: 'text-on-surface-variant'}"
												/>
											</div>
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<span class="text-base font-semibold text-on-surface">{task.title}</span>
													<span class="falcon-chip px-2 py-0.5 text-xs">{itemDisplayId(task)}</span>
													<span class="text-xs {statusTone(task.status)}"
														>{formatStatus(task.status)}</span
													>
												</div>
												<p class="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
													{firstText(task.next_action, task.description, 'No action written yet')}
												</p>
											</div>
											<div>
												<p class="text-xs text-on-surface-variant">Parent</p>
												<p class="mt-1 line-clamp-2 text-sm font-semibold text-on-surface">
													{parentFor(task) ? itemDisplayId(parentFor(task)!) : 'No parent'}
												</p>
											</div>
											<div>
												<p class="text-xs text-on-surface-variant">Due</p>
												<p class="mt-1 text-sm font-semibold text-on-surface">
													{formatDate(task.due_date)}
												</p>
												<p class="mt-2 text-xs {priorityTone(task.priority)}">
													{sentenceCase(task.priority ?? 'normal')}
												</p>
											</div>
										</button>
									{:else}
										<p class="p-4 text-sm text-on-surface-variant">{activeConfig.empty}</p>
									{/each}
								</div>
							{:else if activeType === 'routine'}
								<div class="grid gap-3 p-3">
									{#each filteredItems as routine (routine.id)}
										<button
											type="button"
											onclick={() => inspect(routine)}
											data-testid="work-section-row"
											aria-pressed={selectedItem?.id === routine.id}
											class="falcon-subtle-panel block w-full p-4 text-left transition hover:border-primary/35 hover:bg-surface-2/70 {selectedRowClass(
												routine
											)}"
										>
											<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_11rem_11rem]">
												<div class="min-w-0">
													<div class="flex flex-wrap items-center gap-2">
														<span class="text-base font-semibold text-on-surface"
															>{routine.title}</span
														>
														<span class="falcon-chip px-2 py-0.5 text-xs">
															{itemDisplayId(routine)}
														</span>
														<span class="text-xs {statusTone(routine.status)}">
															{formatStatus(routine.status)}
														</span>
													</div>
													<p class="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
														{firstText(routine.description, routine.body, 'Routine scope not set')}
													</p>
													<p class="mt-2 text-sm font-semibold text-on-surface">
														Last result: {firstText(routine.result, 'No result recorded')}
													</p>
												</div>
												<div>
													<p class="text-xs text-on-surface-variant">Next run</p>
													<p class="mt-1 text-sm font-semibold text-on-surface">
														{formatDateTime(routine.scheduled_at)}
													</p>
													<CalendarClock class="mt-3 h-5 w-5 text-primary" />
												</div>
												<div>
													<p class="text-xs text-on-surface-variant">Cadence</p>
													<p class="mt-1 text-sm font-semibold text-on-surface">
														{firstText(routine.stale_after, 'Not set')}
													</p>
													<p class="mt-2 text-xs {priorityTone(routine.priority)}">
														{sentenceCase(routine.priority ?? 'normal')}
													</p>
												</div>
											</div>
										</button>
									{:else}
										<p class="p-4 text-sm text-on-surface-variant">{activeConfig.empty}</p>
									{/each}
								</div>
							{:else if activeType === 'observation'}
								<div class="divide-y divide-outline-variant/50">
									{#each filteredItems as observation (observation.id)}
										<button
											type="button"
											onclick={() => inspect(observation)}
											data-testid="work-section-row"
											aria-pressed={selectedItem?.id === observation.id}
											class="grid w-full gap-3 p-4 text-left transition hover:bg-surface-2/70 md:grid-cols-[8rem_minmax(0,1fr)_9rem] {selectedRowClass(
												observation
											)}"
										>
											<div class="text-xs text-on-surface-variant">
												{formatDateTime(observation.last_activity_at)}
											</div>
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<span class="text-base font-semibold text-on-surface">
														{observation.title}
													</span>
													<span class="falcon-chip px-2 py-0.5 text-xs">
														{itemDisplayId(observation)}
													</span>
												</div>
												<p class="mt-2 line-clamp-3 text-sm leading-6 text-on-surface-variant">
													{firstText(observation.description, observation.body, 'No finding text')}
												</p>
											</div>
											<div>
												<p class="text-xs text-on-surface-variant">Source</p>
												<p class="mt-1 line-clamp-2 text-sm font-semibold text-on-surface">
													{firstText(observation.owner, observation.area_id, 'Work')}
												</p>
												<p class="mt-2 text-xs {statusTone(observation.status)}">
													{formatStatus(observation.status)}
												</p>
											</div>
										</button>
									{:else}
										<p class="p-4 text-sm text-on-surface-variant">{activeConfig.empty}</p>
									{/each}
								</div>
							{:else}
								<div class="divide-y divide-outline-variant/50">
									{#each filteredItems as item (item.id)}
										<button
											type="button"
											onclick={() => inspect(item)}
											data-testid="work-section-row"
											aria-pressed={selectedItem?.id === item.id}
											class="block w-full p-4 text-left transition hover:bg-surface-2/70 {selectedRowClass(
												item
											)}"
										>
											<p class="text-base font-semibold text-on-surface">{item.title}</p>
											<p class="mt-2 text-sm text-on-surface-variant">{compactDetail(item)}</p>
										</button>
									{:else}
										<p class="p-4 text-sm text-on-surface-variant">{activeConfig.empty}</p>
									{/each}
								</div>
							{/if}
						</div>

						<aside class="falcon-soft-panel overflow-hidden">
							{#if selectedItem}
								<div class="border-b border-outline-variant/60 p-4">
									<div class="flex flex-wrap items-center gap-2">
										<p class="text-xs font-semibold text-on-surface-variant">
											{itemDisplayId(selectedItem)}
										</p>
										<span class="text-xs {statusTone(selectedItem.status)}">
											{formatStatus(selectedItem.status)}
										</span>
									</div>
									<h3 class="mt-2 text-lg font-semibold leading-6 text-on-surface">
										{selectedItem.title}
									</h3>
									<p class="mt-2 line-clamp-4 text-sm leading-6 text-on-surface-variant">
										{detailLead(selectedItem)}
									</p>
									<a
										href={resolve(routeFor(selectedItem))}
										class="falcon-focus mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
									>
										Open full page <ArrowRight class="h-4 w-4" />
									</a>
								</div>
								<div class="grid grid-cols-2 gap-2 border-b border-outline-variant/50 p-4">
									{#each quickFacts(selectedItem).slice(0, 4) as fact (fact.label)}
										<div class="rounded-md border border-outline-variant/45 bg-surface-0/45 p-3">
											<p class="text-xs text-on-surface-variant">{fact.label}</p>
											<p
												class="mt-1 line-clamp-2 text-sm font-semibold text-on-surface {fact.tone ??
													''}"
											>
												{fact.value}
											</p>
										</div>
									{/each}
								</div>
								<form class="space-y-4 p-4" onsubmit={saveSelected} data-testid="work-quick-state">
									<div>
										<h4 class="text-sm font-semibold text-on-surface">Quick state</h4>
										<p class="mt-1 text-xs leading-5 text-on-surface-variant">
											Update lightweight state only. Narrative fields stay agent-managed.
										</p>
									</div>
									<label class="grid gap-1 text-xs text-on-surface-variant">
										Status
										<select
											bind:value={draft.status}
											class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
										>
											{#each workStatuses as status (status)}
												<option value={status}>{sentenceCase(formatStatus(status))}</option>
											{/each}
										</select>
									</label>
									<div class="grid grid-cols-2 gap-2">
										<label class="grid gap-1 text-xs text-on-surface-variant">
											Priority
											<select
												bind:value={draft.priority}
												class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
											>
												<option value="low">Low</option>
												<option value="normal">Normal</option>
												<option value="high">High</option>
												<option value="urgent">Urgent</option>
											</select>
										</label>
										<label class="grid gap-1 text-xs text-on-surface-variant">
											Waiting on
											<select
												bind:value={draft.waiting_on}
												class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
											>
												{#each waitingOptions as option (option.value)}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
										</label>
									</div>
									<button
										type="submit"
										disabled={saving}
										class="falcon-focus inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
									>
										<Save class="h-4 w-4" />
										{saving ? 'Saving...' : 'Save state'}
									</button>
									{#if saveMessage}
										<p class="text-sm text-status-active">{saveMessage}</p>
									{/if}
									{#if error}
										<p class="text-sm text-status-danger">{error}</p>
									{/if}
								</form>
							{:else}
								<p class="p-4 text-sm text-on-surface-variant">Select a Work item.</p>
							{/if}
						</aside>
					</section>
				{/if}
			</div>
		{/if}
	</div>
</FalconModuleShell>
