<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
	import ProjectLedger from '$lib/components/work/ProjectLedger.svelte';
	import WorkSettings from '$lib/components/work/WorkSettings.svelte';
	import {
		clearWorkDataCache,
		loadCachedWorkBlockers,
		loadCachedWorkChangeLog,
		loadCachedWorkItem,
		loadCachedWorkItems,
		loadCachedWorkQueue
	} from '$lib/work/work-data-cache.js';
	import {
		focusDefinitionForType,
		focusDefinitionsForType,
		literalBlockersFor,
		matchesWorkFocus,
		parseQuestionSections,
		projectHealth as deriveProjectHealth,
		projectCurrentNextItem,
		projectNextMove,
		projectOpenWork as deriveProjectOpenWork,
		projectUpcomingItem as deriveProjectUpcomingItem,
		currentNextBlocked,
		riskFlagsFor,
		type ProjectHealth,
		type QuestionBriefSection,
		type RiskFlag
	} from '$lib/work/work-insights.js';
	import {
		configForType,
		formatDate,
		formatDateTime,
		formatStatus,
		itemDisplayId,
		isStandaloneWorkType,
		openStatuses,
		pathForType,
		priorityTone,
		sentenceCase,
		standaloneTypeConfigs,
		statusTone,
		typeFromSection,
		waitingLabel,
		workStatuses,
		workTypes,
		type TypeConfig,
		type WorkBlockerLink,
		type WorkChangeEntityType,
		type WorkChangeLogEntry,
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
		Search,
		Settings,
		X
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

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

	const workTypesForChanges: readonly WorkItemType[] = workTypes;

	type Draft = {
		title: string;
		description: string;
		body: string;
		status: WorkStatus;
		owner: string;
		waiting_on: string;
		category_id: string;
		subcategory_id: string;
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
	let blockerLinks = $state<WorkBlockerLink[]>([]);
	let changeLog = $state<WorkChangeLogEntry[]>([]);
	let queue = $state<WorkQueue | null>(null);
	let search = $state('');
	let statusFilter = $state<WorkStatus | 'open' | 'all'>('open');
	let focusFilter = $state('');
	let sourceFilter = $state('');
	let selectedId = $state<number | null>(null);
	let draft = $state<Draft>(emptyDraft());
	let showQuickPane = $state(false);

	const workListLimit = 300;

	const visibleTypeConfigs: TypeConfig[] = standaloneTypeConfigs;

	const isSettings = $derived(mode === 'section' && section === 'settings');
	const activeType = $derived(typeFromSection(section));
	const activeConfig = $derived(configForType(activeType));
	const title = $derived(
		isSettings ? 'Work settings' : mode === 'overview' ? 'Work' : activeConfig.title
	);
	const description = $derived(
		isSettings
			? 'Categories, subcategories, and Work setup.'
			: mode === 'overview'
				? 'Active outcomes, blockers, reviews, and recent Work activity.'
				: activeConfig.summary
	);

	const openItems = $derived(
		items.filter((item) => isStandaloneWorkType(item.type) && openStatuses.has(item.status))
	);
	const typeItems = $derived(items.filter((item) => item.type === activeType));
	const recentItems = $derived(
		items
			.filter((item) => isStandaloneWorkType(item.type))
			.sort((a, b) => b.last_activity_at - a.last_activity_at)
			.slice(0, 14)
	);
	const primaryFocusDefinitions = $derived(
		focusDefinitionsForType(activeType, { primaryOnly: true })
	);
	const secondaryFocusDefinitions = $derived(
		focusDefinitionsForType(activeType).filter((definition) => !definition.primary)
	);
	const activeFocusDefinition = $derived(focusDefinitionForType(activeType, focusFilter));
	const findingSourceOptions = $derived.by(() => {
		const sources: string[] = [];
		for (const item of typeItems) {
			if (item.type !== 'finding') continue;
			const source = findingSourceLabel(item);
			if (!sources.includes(source)) sources.push(source);
		}
		return sources.sort((a, b) => a.localeCompare(b));
	});
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
			const matchesFocus = matchesWorkFocus(item, focusFilter, items, Date.now(), {
				source: sourceFilter || null
			});
			return matchesSearch && matchesStatus && matchesFocus;
		});
	});
	const selectedItem = $derived.by(() => {
		if (mode === 'detail') return items.find((item) => item.id === id) ?? null;
		const selected = items.find((item) => item.id === selectedId);
		if (
			selected?.type === activeType &&
			filteredItems.some((candidate) => candidate.id === selected.id)
		) {
			return selected;
		}
		return filteredItems[0] ?? null;
	});

	const needsOperator = $derived(
		(queue?.needsOperator ?? queue?.waitingOnOperator ?? []).filter((item) =>
			isStandaloneWorkType(item.type)
		)
	);
	const needsYourCallItems = $derived.by(() =>
		uniqueItems([...needsOperator, ...(queue?.needsReview ?? [])]).filter(isOpen)
	);
	const blockedItems = $derived.by(() =>
		uniqueItems([
			...(queue?.blockedRisky ?? []),
			...openItems.filter((item) => item.status === 'blocked')
		]).filter((item) => isOpen(item) && item.status === 'blocked')
	);
	const urgentRiskItems = $derived.by(() =>
		openItems.filter(
			(item) =>
				item.priority === 'urgent' && !blockedItems.some((blocked) => blocked.id === item.id)
		)
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
		uniqueItems([
			...blockedItems,
			...urgentRiskItems,
			...waitingExternalItems,
			...waitingAgentItems
		]).filter(isOpen)
	);
	const needsYourCallGroups = $derived.by<OverviewGroup[]>(() => {
		return [
			{
				title: 'Questions and decisions',
				description: 'Unknowns and commitments that need operator judgment',
				items: needsYourCallItems.filter(
					(item) => item.type === 'open_question' || item.type === 'decision'
				),
				empty: 'No open questions waiting on you'
			},
			{
				title: 'Change requests',
				description: 'Implementation or configuration work asking for review',
				items: needsYourCallItems.filter((item) => item.type === 'change_request'),
				empty: 'No change requests waiting on you'
			},
			{
				title: 'Findings to triage',
				description: 'Captured findings that need operator judgment',
				items: needsYourCallItems.filter((item) => item.type === 'finding'),
				empty: 'No findings need triage'
			},
			{
				title: 'Other asks',
				description: 'Tasks, automations, or projects waiting for operator input',
				items: needsYourCallItems.filter(
					(item) => !['open_question', 'decision', 'change_request', 'finding'].includes(item.type)
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
				empty: 'No blocked work'
			},
			{
				title: 'Urgent',
				description: 'High-priority work that needs attention but is not blocked',
				items: urgentRiskItems,
				empty: 'No urgent work'
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
			.filter((item) => item.type === 'automation' && onTimeline(item.scheduled_at, 14))
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
				tone: 'text-status-warning'
			},
			{
				label: 'At risk',
				value: atRiskItems.length,
				breakdown: riskBreakdown(),
				anchor: '#at-risk',
				tone: 'text-status-danger'
			},
			{
				label: 'Due next',
				value: dueNextItems.length,
				breakdown: typeBreakdown(dueNextItems, 'No near-term dates'),
				anchor: '#due-next',
				tone: 'text-status-active'
			},
			{
				label: 'Changed recently',
				value: recentChangedItems.length,
				breakdown: typeBreakdown(recentChangedItems, 'No recent updates'),
				anchor: '#recent',
				tone: 'text-primary'
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
		if (mode !== 'section' || isSettings) return;
		const params = page.url.searchParams;
		const nextSearch = params.get('q') ?? '';
		const nextStatus = statusFilterFromParam(
			params.get('status'),
			defaultStatusForType(activeType)
		);
		const nextFocus = focusDefinitionForType(activeType, params.get('focus'))?.key ?? '';
		const nextSource = params.get('source') ?? '';
		if (search !== nextSearch) search = nextSearch;
		if (statusFilter !== nextStatus) statusFilter = nextStatus;
		if (focusFilter !== nextFocus) focusFilter = nextFocus;
		if (sourceFilter !== nextSource) sourceFilter = nextSource;
	});

	onMount(() => {
		const cleanupQuickPaneQuery = setupQuickPaneQuery();
		void loadWork();
		return cleanupQuickPaneQuery;
	});

	async function loadWork() {
		loading = true;
		error = null;
		saveMessage = null;
		try {
			if (isSettings) {
				items = [];
				blockerLinks = [];
				changeLog = [];
				queue = null;
				return;
			}
			if (mode === 'overview') {
				const [loadedItems, loadedQueue, loadedChangeLog, loadedBlockers] = await Promise.all([
					loadItems(workItemsUrl({ limit: workListLimit })),
					loadQueue(),
					loadChangeLog(workChangeLogUrl({ limit: 24 })),
					loadBlockers(workBlockersUrl({ limit: 500 }))
				]);
				items = loadedItems;
				queue = loadedQueue;
				changeLog = loadedChangeLog;
				blockerLinks = loadedBlockers;
				selectedId = id ?? queue?.nextActions[0]?.id ?? items[0]?.id ?? null;
				return;
			}

			if (mode === 'detail' && id) {
				const item = await loadItem(id);
				items = mergeItems(items, [item]);
				selectedId = item.id;
				await ensureItemContext(item);
				changeLog = await loadChangeLog(changeLogUrlForItem(item));
				blockerLinks =
					item.type === 'project'
						? await loadBlockers(workBlockersUrl({ project_id: item.id }))
						: [];
				return;
			}

			const routeStatus = statusFilterFromParam(
				page.url.searchParams.get('status'),
				defaultStatusForType(activeType)
			);
			const includeClosed = statusNeedsClosedRecords(routeStatus, activeType);
			const loadedItems = await loadItems(
				activeType === 'project'
					? workItemsUrl({ includeClosed, limit: workListLimit })
					: workItemsUrl({ type: activeType, includeClosed, limit: workListLimit })
			);
			items =
				activeType === 'project'
					? loadedItems
					: mergeItems(
							items.filter((item) => item.type !== activeType),
							loadedItems
						);
			blockerLinks =
				activeType === 'project' ? await loadBlockers(workBlockersUrl({ limit: 500 })) : [];
			const loadedTypeItems = loadedItems.filter((item) => item.type === activeType);
			selectedId = id ?? loadedTypeItems[0]?.id ?? null;
			const selected = selectedId ? items.find((item) => item.id === selectedId) : null;
			if (selected) await ensureItemContext(selected);
			changeLog = [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load Work';
		} finally {
			loading = false;
		}
	}

	async function loadItems(url: string): Promise<WorkItem[]> {
		return loadCachedWorkItems(url);
	}

	async function loadItem(itemId: number): Promise<WorkItem> {
		return loadCachedWorkItem(itemId);
	}

	async function loadQueue(): Promise<WorkQueue> {
		return loadCachedWorkQueue();
	}

	async function loadChangeLog(url: string): Promise<WorkChangeLogEntry[]> {
		return loadCachedWorkChangeLog(url);
	}

	async function loadBlockers(url: string): Promise<WorkBlockerLink[]> {
		return loadCachedWorkBlockers(url);
	}

	async function ensureItemContext(item: WorkItem) {
		const directChildren = await loadItems(
			workItemsUrl({ parent_item_id: item.id, limit: workListLimit })
		);
		const requests = [Promise.resolve(directChildren)];
		if (item.type === 'project') {
			for (const milestone of directChildren.filter((child) => child.type === 'milestone')) {
				requests.push(
					loadItems(workItemsUrl({ parent_item_id: milestone.id, limit: workListLimit }))
				);
			}
		}
		if (item.parent_item_id) {
			requests.push(
				loadItems(workItemsUrl({ parent_item_id: item.parent_item_id, limit: workListLimit }))
			);
			if (!items.some((candidate) => candidate.id === item.parent_item_id)) {
				requests.push(loadItem(item.parent_item_id).then((parent) => [parent]));
			}
		}
		const groups = await Promise.all(requests);
		items = mergeItems(items, groups.flat());
	}

	function mergeItems(current: WorkItem[], incoming: WorkItem[]): WorkItem[] {
		const merged = [...current];
		for (const item of incoming) {
			const index = merged.findIndex((candidate) => candidate.id === item.id);
			if (index === -1) merged.push(item);
			else merged[index] = item;
		}
		return merged;
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
			clearWorkDataCache(updated.id);
			if (mode === 'overview') queue = await loadQueue();
			await refreshVisibleChangeLog(updated);
			await refreshVisibleBlockers(updated);
			saveMessage = 'Saved';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to save Work item';
		} finally {
			saving = false;
		}
	}

	function handleProjectChildCreated(item: WorkItem) {
		items = mergeItems(items, [item]);
		clearWorkDataCache(item.id);
		void refreshVisibleChangeLog(selectedItem ?? item);
		void refreshVisibleBlockers(selectedItem ?? item);
	}

	function emptyDraft(): Draft {
		return {
			title: '',
			description: '',
			body: '',
			status: 'planning',
			owner: '',
			waiting_on: '',
			category_id: '',
			subcategory_id: '',
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
			category_id: item.category_id ?? '',
			subcategory_id: item.subcategory_id ?? '',
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
			category_id: value.category_id || null,
			subcategory_id: value.subcategory_id || null,
			area_id: value.subcategory_id || value.category_id || null,
			priority: value.priority,
			actor: 'operator'
		};
	}

	function isOpen(item: WorkItem): boolean {
		return isStandaloneWorkType(item.type) && openStatuses.has(item.status);
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
		return source
			.filter((candidate) => isStandaloneWorkType(candidate.type))
			.sort(
				(a, b) =>
					statusRank(a.status) - statusRank(b.status) || b.last_activity_at - a.last_activity_at
			);
	}

	function blockersFor(item: WorkItem): WorkItem[] {
		return literalBlockersFor(item, insightRelatedItemsFor(item));
	}

	function healthReasonsFor(item: WorkItem): RiskFlag[] {
		return riskFlagsFor(item, insightRelatedItemsFor(item));
	}

	function insightRelatedItemsFor(item: WorkItem): WorkItem[] {
		const parent = parentFor(item);
		return uniqueItems([...(parent ? [parent] : []), ...childrenFor(item), ...siblingsFor(item)]);
	}

	function projectOpenWork(project: WorkItem): string {
		return deriveProjectOpenWork(project, childrenFor(project));
	}

	function projectUpcomingItem(project: WorkItem): WorkItem | null {
		return deriveProjectUpcomingItem(project, childrenFor(project));
	}

	function projectUpcoming(project: WorkItem): string {
		const upcoming = projectUpcomingItem(project);
		if (!upcoming) return 'No date on the calendar';
		const date = upcoming.due_date ?? upcoming.scheduled_at;
		const prefix = upcoming.id === project.id ? 'Project' : typeLabel(upcoming);
		const overdue = dateValue(date) < startOfToday();
		return overdue
			? `Overdue · ${prefix} · ${formatDate(date)}`
			: `${prefix} · ${formatDate(date)}`;
	}

	function projectHealth(project: WorkItem): ProjectHealth {
		return deriveProjectHealth(project, childrenFor(project));
	}

	function signalAccentClass(anchor: OverviewAnchor): string {
		if (anchor === '#needs-you') return 'bg-status-warning';
		if (anchor === '#at-risk') return 'bg-status-danger';
		if (anchor === '#due-next') return 'bg-status-active';
		return 'bg-primary';
	}

	function projectOperatorMove(project: WorkItem): string {
		return projectNextMove(project, childrenFor(project));
	}

	function blockerCount(item: WorkItem): number {
		if (item.type === 'project') return projectCurrentBlockerLinks(item).length;
		return blockersFor(item).length;
	}

	function projectBlockerLinks(project: WorkItem): WorkBlockerLink[] {
		return blockerLinks.filter(
			(link) => link.status === 'active' && link.project_id === project.id
		);
	}

	function projectCurrentItem(project: WorkItem): WorkItem | null {
		return projectCurrentNextItem(project, childrenFor(project));
	}

	function projectCurrentBlockerLinks(project: WorkItem): WorkBlockerLink[] {
		const current = projectCurrentItem(project);
		if (!current) return [];
		return projectBlockerLinks(project).filter((link) => link.blocked_item_id === current.id);
	}

	function projectLaterBlockerLinks(project: WorkItem): WorkBlockerLink[] {
		const current = projectCurrentItem(project);
		return projectBlockerLinks(project).filter((link) => link.blocked_item_id !== current?.id);
	}

	function blockerCountLabel(project: WorkItem): string {
		const current = projectCurrentItem(project);
		const currentCount = projectCurrentBlockerLinks(project).length;
		if ((current && currentNextBlocked(current)) || currentCount) return 'Next up blocked';
		const laterCount = projectLaterBlockerLinks(project).length;
		return laterCount ? `${laterCount} later holding up` : 'Clear';
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

	function routeForChange(entry: WorkChangeLogEntry): string | null {
		const type = entry.entity_type;
		if (!isWorkItemEntity(type)) {
			return type === 'category' || type === 'subcategory' ? '/work/settings' : null;
		}
		if (type === 'milestone') {
			return entry.project_id ? `/work/projects/${entry.project_id}` : '/work/projects';
		}
		const id = Number(entry.entity_id);
		return Number.isFinite(id) ? `/work/${pathForType(type)}/${id}` : null;
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

	function changeEntityLabel(entry: WorkChangeLogEntry): string {
		if (isWorkItemEntity(entry.entity_type)) return configForType(entry.entity_type).singular;
		return sentenceCase(entry.entity_type);
	}

	function changeActionLabel(action: string): string {
		return sentenceCase(action);
	}

	function changeTitle(entry: WorkChangeLogEntry): string {
		return entry.entity_title ?? `${changeEntityLabel(entry)} ${entry.entity_id}`;
	}

	function isWorkItemEntity(type: WorkChangeEntityType): type is WorkItemType {
		return workTypesForChanges.includes(type as WorkItemType);
	}

	function attentionReason(item: WorkItem): string {
		if (item.status === 'needs_review') return 'Needs review';
		if (item.status === 'blocked') return 'Blocked';
		if (item.priority === 'urgent') return 'Urgent';
		if (item.waiting_on) return `Waiting on ${waitingLabel(item.waiting_on)}`;
		return sentenceCase(formatStatus(item.status));
	}

	function pluralize(count: number, singular: string, plural = `${singular}s`): string {
		return `${count} ${count === 1 ? singular : plural}`;
	}

	function typeBreakdown(source: WorkItem[], fallback: string): string {
		if (source.length === 0) return fallback;
		const typeOrder: Array<[WorkItemType, string, string]> = [
			['open_question', 'open question', 'open questions'],
			['decision', 'decision', 'decisions'],
			['change_request', 'change request', 'change requests'],
			['finding', 'finding', 'findings'],
			['task', 'task', 'tasks'],
			['automation', 'automation', 'automations'],
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
			urgentRiskItems.length ? `${urgentRiskItems.length} urgent` : null,
			waitingExternalItems.length
				? pluralize(waitingExternalItems.length, 'external wait', 'external waits')
				: null,
			waitingAgentItems.length
				? pluralize(waitingAgentItems.length, 'agent follow-up', 'agent follow-ups')
				: null
		].filter(Boolean);
		return parts.length ? parts.join(' · ') : 'No risk flags';
	}

	function itemTimelineDate(item: WorkItem): number {
		if (item.type === 'automation') return dateValue(item.scheduled_at);
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
		const label = item.type === 'automation' ? 'Next run' : 'Due';
		return `${label} ${formatDate(item.type === 'automation' ? item.scheduled_at : item.due_date)}`;
	}

	function defaultStatusForType(type: WorkItemType): WorkStatus | 'open' | 'all' {
		return type === 'finding' ? 'all' : 'open';
	}

	function statusFilterFromParam(
		value: string | null,
		fallback: WorkStatus | 'open' | 'all'
	): WorkStatus | 'open' | 'all' {
		if (value === 'open' || value === 'all') return value;
		if (workStatuses.includes(value as WorkStatus)) return value as WorkStatus;
		return fallback;
	}

	function updateSectionQuery(
		updates: Partial<{
			q: string;
			status: WorkStatus | 'open' | 'all';
			focus: string;
			source: string;
		}>
	) {
		if (mode !== 'section') return;
		const params = new SvelteURLSearchParams(page.url.searchParams);
		const defaultStatus = defaultStatusForType(activeType);
		if ('q' in updates) setQueryValue(params, 'q', updates.q?.trim() ?? '');
		if ('focus' in updates) setQueryValue(params, 'focus', updates.focus ?? '');
		if ('source' in updates) setQueryValue(params, 'source', updates.source ?? '');
		if ('status' in updates) {
			const value = updates.status ?? defaultStatus;
			if (value === defaultStatus) params.delete('status');
			else params.set('status', value);
		}
		if (params.get('focus') !== 'source') params.delete('source');
		const query = params.toString();
		void goto(resolve(`/work/${activeConfig.path}${query ? `?${query}` : ''}`), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function setQueryValue(params: URLSearchParams, key: string, value: string) {
		if (value) params.set(key, value);
		else params.delete(key);
	}

	function handleSearchInput(event: Event) {
		const value = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : '';
		search = value;
		updateSectionQuery({ q: value });
	}

	function setStatusFilter(value: WorkStatus | 'open' | 'all') {
		statusFilter = value;
		updateSectionQuery({ status: value });
		if (statusNeedsClosedRecords(value, activeType)) void loadWork();
	}

	function toggleFocusFilter(key: string) {
		const nextFocus = focusFilter === key ? '' : key;
		const definition = focusDefinitionForType(activeType, nextFocus);
		focusFilter = nextFocus;
		if (!nextFocus) {
			sourceFilter = '';
			updateSectionQuery({ focus: '', source: '' });
			return;
		}
		const status = definition?.statusMode ?? statusFilter;
		if (definition?.statusMode) statusFilter = definition.statusMode;
		updateSectionQuery({
			focus: nextFocus,
			status,
			source: nextFocus === 'source' ? sourceFilter : ''
		});
		if (statusNeedsClosedRecords(status, activeType)) void loadWork();
	}

	function setSourceFilter(value: string) {
		sourceFilter = value;
		if (value && focusFilter !== 'source') focusFilter = 'source';
		if (!value && focusFilter === 'source') focusFilter = '';
		updateSectionQuery({ focus: value ? 'source' : focusFilter, source: value });
	}

	function clearListFilters() {
		search = '';
		statusFilter = defaultStatusForType(activeType);
		focusFilter = '';
		sourceFilter = '';
		updateSectionQuery({ q: '', status: statusFilter, focus: '', source: '' });
	}

	function hasActiveListFilters(): boolean {
		return (
			Boolean(search.trim()) ||
			Boolean(focusFilter) ||
			Boolean(sourceFilter) ||
			statusFilter !== defaultStatusForType(activeType)
		);
	}

	function findingSourceLabel(item: WorkItem): string {
		return firstText(item.owner, item.subcategory_id, item.category_id, 'Work');
	}

	function inspect(item: WorkItem) {
		selectedId = item.id;
	}

	function setupQuickPaneQuery(): () => void {
		const query = window.matchMedia('(min-width: 1280px)');
		showQuickPane = query.matches;
		const update = (event: MediaQueryListEvent) => {
			showQuickPane = event.matches;
		};
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	}

	function handleSectionRowClick(item: WorkItem) {
		if (showQuickPane) {
			inspect(item);
			return;
		}
		openDetail(item);
	}

	function handleProjectRowClick(item: WorkItem) {
		if (showQuickPane) return;
		openDetail(item);
	}

	function handleSectionRowDoubleClick(item: WorkItem) {
		if (!showQuickPane) return;
		openDetail(item);
	}

	function openDetail(item: WorkItem) {
		void goto(resolve(routeFor(item)));
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
			if (type === 'finding') return b.last_activity_at - a.last_activity_at;
			if (type === 'automation') {
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

	function compactDetail(item: WorkItem): string {
		if (item.type === 'open_question' || item.type === 'decision')
			return firstText(item.next_action, item.body, item.description);
		if (item.type === 'change_request')
			return firstText(item.next_action, item.description, item.body);
		if (item.type === 'task') return firstText(item.next_action, item.description, item.body);
		if (item.type === 'automation')
			return firstText(item.result, item.next_action, item.description);
		if (item.type === 'finding') return firstText(item.description, item.body, item.next_action);
		return firstText(item.next_action, item.description, item.body);
	}

	function detailLead(item: WorkItem): string {
		if (item.type === 'project')
			return firstText(item.description, item.body, 'No outcome narrative recorded yet.');
		if (item.type === 'change_request')
			return firstText(item.description, item.body, 'No change scope recorded yet.');
		if (item.type === 'open_question' || item.type === 'decision')
			return firstText(item.body, item.description, 'No question context recorded yet.');
		if (item.type === 'task')
			return firstText(item.next_action, item.description, 'No task detail recorded yet.');
		if (item.type === 'automation')
			return firstText(item.description, item.body, 'No automation purpose recorded yet.');
		if (item.type === 'finding')
			return firstText(item.description, item.body, 'No finding text recorded yet.');
		return compactDetail(item);
	}

	function detailSections(item: WorkItem): DetailSection[] {
		if (item.type === 'project') {
			return [
				{ title: 'Outcome', text: detailLead(item) },
				{ title: 'Next move', text: firstText(item.next_action, projectOperatorMove(item)) }
			];
		}
		if (item.type === 'change_request') {
			return [
				{ title: 'Scope', text: firstText(item.description, item.body, 'No scope recorded yet.') },
				{ title: 'Next action', text: firstText(item.next_action, 'No next action recorded yet.') }
			];
		}
		if (item.type === 'open_question' || item.type === 'decision') {
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
				{ title: 'Task', text: firstText(item.next_action, item.description, item.title) },
				{
					title: 'Context',
					text: firstText(item.body, item.description, 'No added context recorded yet.')
				}
			];
		}
		if (item.type === 'automation') {
			return [
				{ title: 'Automation purpose', text: firstText(item.description, item.body, item.title) },
				{ title: 'Latest result', text: firstText(item.result, 'No latest result recorded yet.') }
			];
		}
		if (item.type === 'finding') {
			return [
				{ title: 'Finding', text: firstText(item.description, item.body, item.title) },
				{ title: 'Triage note', text: firstText(item.next_action, 'No triage note recorded yet.') }
			];
		}
		return [{ title: 'Summary', text: compactDetail(item) }];
	}

	function questionMarkdownContent(item: WorkItem): string {
		return firstText(item.body, item.description, 'No question context recorded yet.');
	}

	function questionSections(item: WorkItem): QuestionBriefSection[] {
		return parseQuestionSections(questionMarkdownContent(item));
	}

	function questionPrimaryAnswer(item: WorkItem): string {
		if (item.next_action?.trim()) return item.next_action;
		const sections = questionSections(item);
		const preferred = sections.find((section) =>
			['question', 'recommendation', 'approval'].some((word) =>
				section.title.toLowerCase().includes(word)
			)
		);
		return preferred?.content ?? detailLead(item);
	}

	function questionCategoryLabel(category: QuestionBriefSection['category']): string {
		if (category === 'decision') return 'Decision';
		if (category === 'risks') return 'Risks';
		if (category === 'approval') return 'Approval';
		if (category === 'history') return 'History';
		return 'Context';
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
					value: blockerCountLabel(item),
					tone: blockerCount(item) ? 'text-status-danger' : 'text-status-muted'
				}
			];
		}
		if (item.type === 'change_request') {
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
		if (item.type === 'open_question' || item.type === 'decision') {
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
		if (item.type === 'automation') {
			return [
				{ label: 'Next run', value: formatDateTime(item.scheduled_at) },
				{ label: 'Cadence', value: firstText(item.stale_after, 'Not set') },
				{ label: 'Waiting', value: waitingLabel(item.waiting_on) },
				{ label: 'Updated', value: formatDateTime(item.last_activity_at) }
			];
		}
		if (item.type === 'finding') {
			return [
				{ label: 'Captured', value: formatDateTime(item.created_at) },
				{
					label: 'Source',
					value: firstText(item.owner, item.subcategory_id, item.category_id, 'Work')
				},
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

	function workItemsUrl({
		type,
		parent_item_id,
		includeClosed = false,
		limit = workListLimit
	}: {
		type?: WorkItemType;
		parent_item_id?: number;
		includeClosed?: boolean;
		limit?: number;
	}): string {
		const params = new SvelteURLSearchParams();
		if (type) params.set('type', type);
		if (parent_item_id !== undefined) params.set('parent_item_id', String(parent_item_id));
		if (includeClosed) params.set('includeClosed', 'true');
		params.set('limit', String(limit));
		return `/api/work/items?${params.toString()}`;
	}

	function workChangeLogUrl({
		project_id,
		entity_type,
		entity_id,
		limit = 24
	}: {
		project_id?: number;
		entity_type?: WorkChangeEntityType;
		entity_id?: string | number;
		limit?: number;
	}): string {
		const params = new SvelteURLSearchParams();
		if (project_id !== undefined) params.set('project_id', String(project_id));
		if (entity_type) params.set('entity_type', entity_type);
		if (entity_id !== undefined) params.set('entity_id', String(entity_id));
		params.set('limit', String(limit));
		return `/api/work/change-log?${params.toString()}`;
	}

	function workBlockersUrl({
		project_id,
		blocked_item_id,
		blocker_item_id,
		state = 'active',
		limit = 100
	}: {
		project_id?: number;
		blocked_item_id?: number;
		blocker_item_id?: number;
		state?: 'active' | 'resolved' | 'all';
		limit?: number;
	}): string {
		const params = new SvelteURLSearchParams();
		if (project_id !== undefined) params.set('project_id', String(project_id));
		if (blocked_item_id !== undefined) params.set('blocked_item_id', String(blocked_item_id));
		if (blocker_item_id !== undefined) params.set('blocker_item_id', String(blocker_item_id));
		params.set('state', state);
		params.set('limit', String(limit));
		return `/api/work/blockers?${params.toString()}`;
	}

	function changeLogUrlForItem(item: WorkItem): string {
		if (item.type === 'project') return workChangeLogUrl({ project_id: item.id, limit: 24 });
		return workChangeLogUrl({ entity_type: item.type, entity_id: item.id, limit: 24 });
	}

	async function refreshVisibleChangeLog(item: WorkItem): Promise<void> {
		if (mode === 'overview') {
			changeLog = await loadChangeLog(workChangeLogUrl({ limit: 24 }));
			return;
		}
		if (mode === 'detail') {
			changeLog = await loadChangeLog(changeLogUrlForItem(item));
		}
	}

	async function refreshVisibleBlockers(item: WorkItem): Promise<void> {
		if (mode === 'detail' && item.type === 'project') {
			blockerLinks = await loadBlockers(workBlockersUrl({ project_id: item.id }));
			return;
		}
		if (mode === 'overview' || activeType === 'project') {
			blockerLinks = await loadBlockers(workBlockersUrl({ limit: 500 }));
			return;
		}
		blockerLinks = [];
	}

	function statusNeedsClosedRecords(
		status: WorkStatus | 'open' | 'all',
		type: WorkItemType
	): boolean {
		if (type === 'finding') return true;
		if (status === 'all') return true;
		if (status === 'open') return false;
		return !openStatuses.has(status);
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
									config.type &&
								mode !== 'overview' &&
								!isSettings
									? 'bg-primary text-primary-foreground'
									: 'text-on-surface-variant hover:bg-surface-2 hover:text-on-surface'}"
							>
								{config.label}
							</a>
						{/each}
						<a
							href={resolve('/work/settings')}
							aria-label="Work settings"
							class="falcon-focus ml-auto inline-flex min-h-9 min-w-9 items-center justify-center rounded-md transition {isSettings
								? 'bg-primary text-primary-foreground'
								: 'text-on-surface-variant hover:bg-surface-2 hover:text-on-surface'}"
						>
							<Settings class="h-4 w-4" />
						</a>
					</nav>
				</section>

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
									<p class="mt-3 text-sm leading-6 text-on-surface-variant">
										{signal.breakdown}
									</p>
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/each}
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
							</div>
							<Clock class="h-5 w-5 text-on-surface-variant" />
						</div>
						<div class="divide-y divide-outline-variant/30" data-testid="recent-activity-list">
							{#if changeLog.length}
								{#each changeLog.slice(0, 18) as entry (entry.id)}
									{@const href = routeForChange(entry)}
									<svelte:element
										this={href ? 'a' : 'div'}
										href={href ?? undefined}
										class="grid gap-3 px-4 py-3 transition hover:bg-surface-2/45 md:grid-cols-[8rem_1fr_auto]"
									>
										<div class="text-xs text-on-surface-variant">
											{formatDateTime(entry.occurred_at)}
										</div>
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2 text-xs">
												<span class="text-on-surface-variant">{changeEntityLabel(entry)}</span>
												<span class="text-on-surface-variant"
													>{changeActionLabel(entry.action)}</span
												>
											</div>
											<p class="mt-1 truncate text-sm font-semibold text-on-surface">
												{changeTitle(entry)}
											</p>
											<p class="mt-0.5 text-xs text-on-surface-variant">{entry.summary}</p>
										</div>
										<div class="text-xs text-on-surface-variant md:text-right">
											{entry.source}
										</div>
									</svelte:element>
								{/each}
							{:else}
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
											<p class="mt-1 truncate text-sm font-semibold text-on-surface">
												{item.title}
											</p>
										</div>
										<div class="text-xs text-on-surface-variant md:text-right">
											{itemDisplayId(item)}
										</div>
									</a>
								{/each}
							{/if}
						</div>
					</section>
				{:else if isSettings}
					<WorkSettings />
				{:else if mode === 'detail'}
					{#if selectedItem}
						{#if selectedItem.type === 'project'}
							<ProjectLedger
								item={selectedItem}
								{items}
								activity={changeLog}
								blockerLinks={projectBlockerLinks(selectedItem)}
								bind:draft
								{saving}
								{saveMessage}
								{error}
								onSave={saveSelected}
								onMilestoneCreated={handleProjectChildCreated}
							/>
						{:else if selectedItem.type === 'open_question' || selectedItem.type === 'decision'}
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
										Back to questions
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
											<p
												class="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary"
											>
												Question Brief
											</p>
											<h2
												class="mt-2 max-w-5xl text-3xl font-semibold leading-tight text-on-surface sm:text-4xl"
											>
												{selectedItem.title}
											</h2>
										</div>
										<form class="falcon-subtle-panel space-y-3 p-4" onsubmit={saveSelected}>
											<div class="flex items-center justify-between gap-3">
												<h3 class="text-sm font-semibold text-on-surface">State</h3>
												{#if saveMessage}<span class="text-xs text-status-active"
														>{saveMessage}</span
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

								<div class="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
									<div class="min-w-0 space-y-5">
										<div class="grid gap-3 md:grid-cols-4">
											{#each quickFacts(selectedItem) as fact (fact.label)}
												<div
													class="rounded-md border border-outline-variant/45 bg-surface-0/45 p-3"
												>
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

										<section
											class="rounded-lg border border-primary/25 bg-primary-container/10 p-4"
											data-testid="question-primary-answer"
										>
											<p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
												What needs your answer
											</p>
											<div class="mt-3 text-sm leading-6 text-on-surface">
												<MarkdownRenderer content={questionPrimaryAnswer(selectedItem)} />
											</div>
										</section>

										{#if healthReasonsFor(selectedItem).length}
											<section class="rounded-lg border border-outline-variant/45 bg-surface-0/35">
												<div class="border-b border-outline-variant/35 px-4 py-3">
													<h3 class="text-sm font-semibold text-on-surface">Health reasons</h3>
												</div>
												<div class="grid gap-2 p-3 md:grid-cols-2">
													{#each healthReasonsFor(selectedItem) as flag (flag.key)}
														<div
															class="rounded-md border border-outline-variant/40 bg-surface-1/55 p-3"
														>
															<p class="text-sm font-semibold {flag.tone}">{flag.label}</p>
															<p class="mt-1 text-xs leading-5 text-on-surface-variant">
																{flag.detail}
															</p>
														</div>
													{/each}
												</div>
											</section>
										{/if}

										<section
											class="overflow-hidden rounded-lg border border-outline-variant/45 bg-surface-0/25"
											data-testid="question-brief-sections"
										>
											<div class="border-b border-outline-variant/35 px-4 py-3">
												<h3 class="text-sm font-semibold text-on-surface">Question context</h3>
												<p class="mt-1 text-xs text-on-surface-variant">
													Long agent notes are split into sections so the decision is easier to
													scan.
												</p>
											</div>
											<div class="divide-y divide-outline-variant/35">
												{#each questionSections(selectedItem) as section (section.id)}
													<details
														id={section.id}
														open={section.defaultOpen}
														class="group scroll-mt-24"
													>
														<summary
															class="falcon-focus flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-2/45"
														>
															<span>{section.title}</span>
															<span class="text-xs text-on-surface-variant">
																{questionCategoryLabel(section.category)}
															</span>
														</summary>
														<div class="border-t border-outline-variant/25 px-4 py-4">
															<MarkdownRenderer content={section.content} />
														</div>
													</details>
												{/each}
											</div>
										</section>
									</div>

									<aside class="space-y-4">
										<div class="rounded-lg border border-outline-variant/45 bg-surface-0/35 p-4">
											<h3 class="text-sm font-semibold text-on-surface">Sections</h3>
											<div class="mt-3 space-y-1">
												{#each questionSections(selectedItem) as section (section.id)}
													<a
														href={`#${section.id}`}
														class="falcon-focus flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-on-surface-variant transition hover:bg-surface-2 hover:text-on-surface"
													>
														<span class="truncate">{section.title}</span>
														<span class="shrink-0 text-xs"
															>{questionCategoryLabel(section.category)}</span
														>
													</a>
												{/each}
											</div>
										</div>

										<section class="rounded-lg border border-outline-variant/45 bg-surface-0/25">
											<div class="border-b border-outline-variant/35 px-4 py-3">
												<h3 class="text-sm font-semibold text-on-surface">
													{relationHeading(selectedItem)}
												</h3>
											</div>
											<div class="divide-y divide-outline-variant/30">
												{#each relatedItemsFor(selectedItem) as related (related.id)}
													<a
														href={resolve(routeFor(related))}
														class="block px-4 py-3 transition hover:bg-surface-2/45"
													>
														<div class="flex flex-wrap items-center gap-2 text-xs">
															<span class="text-on-surface-variant">{typeLabel(related)}</span>
															<span class={statusTone(related.status)}>
																{formatStatus(related.status)}
															</span>
														</div>
														<p class="mt-1 line-clamp-2 text-sm font-semibold text-on-surface">
															{related.title}
														</p>
													</a>
												{:else}
													<p class="px-4 py-3 text-sm text-on-surface-variant">
														{emptyRelationText(selectedItem)}
													</p>
												{/each}
											</div>
										</section>
									</aside>
								</div>
							</section>
						{:else}
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
												{#if saveMessage}<span class="text-xs text-status-active"
														>{saveMessage}</span
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
												<div
													class="rounded-md border border-outline-variant/45 bg-surface-0/45 p-3"
												>
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

										{#if healthReasonsFor(selectedItem).length}
											<section class="rounded-lg border border-outline-variant/45 bg-surface-0/35">
												<div class="border-b border-outline-variant/35 px-4 py-3">
													<h3 class="text-sm font-semibold text-on-surface">Health reasons</h3>
												</div>
												<div class="grid gap-2 p-3 md:grid-cols-2">
													{#each healthReasonsFor(selectedItem) as flag (flag.key)}
														<div
															class="rounded-md border border-outline-variant/40 bg-surface-1/55 p-3"
														>
															<p class="text-sm font-semibold {flag.tone}">{flag.label}</p>
															<p class="mt-1 text-xs leading-5 text-on-surface-variant">
																{flag.detail}
															</p>
														</div>
													{/each}
												</div>
											</section>
										{/if}

										{#if blockersFor(selectedItem).length}
											<section
												class="rounded-lg border border-status-danger/35 bg-status-danger-bg/45"
											>
												<div class="border-b border-status-danger/25 px-4 py-3">
													<h3 class="text-sm font-semibold text-status-danger">Blockers</h3>
													<p class="mt-1 text-xs text-on-surface-variant">
														Blocked related work attached to this record.
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
																<span class="text-on-surface-variant">{itemDisplayId(blocker)}</span
																>
															</div>
															<p class="mt-1 text-sm font-semibold text-on-surface">
																{blocker.title}
															</p>
															<p
																class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant"
															>
																{compactDetail(blocker)}
															</p>
														</a>
													{/each}
												</div>
											</section>
										{:else}
											<section
												class="rounded-lg border border-outline-variant/35 bg-surface-0/25 px-4 py-3"
											>
												<h3 class="text-sm font-semibold text-on-surface">Blockers</h3>
												<p class="mt-1 text-sm text-on-surface-variant">No active blockers.</p>
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
																<span class="text-on-surface-variant">{itemDisplayId(related)}</span
																>
															</div>
															<p class="mt-1 truncate text-sm font-semibold text-on-surface">
																{related.title}
															</p>
															<p
																class="mt-1 line-clamp-1 text-xs leading-5 text-on-surface-variant"
															>
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
													<p class="mt-1 font-semibold text-on-surface">
														{typeLabel(selectedItem)}
													</p>
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
														{firstText(
															selectedItem.owner,
															selectedItem.subcategory_id,
															selectedItem.category_id,
															'Not set'
														)}
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
						{/if}
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
					<section
						class="grid gap-4 {activeType === 'project'
							? ''
							: 'xl:h-[calc(100dvh-5.75rem)] xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_25rem]'}"
					>
						<div class="falcon-soft-panel flex min-h-0 flex-col overflow-hidden">
							<div class="border-b border-outline-variant/60 p-3 sm:p-4">
								<div class="space-y-3">
									<h2 class="text-xl font-semibold leading-tight text-on-surface">
										{activeConfig.title}
									</h2>
									<div class="grid gap-2 lg:grid-cols-[minmax(14rem,1fr)_auto] lg:items-start">
										<label class="relative block">
											<Search
												class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-on-surface-variant"
											/>
											<input
												type="search"
												value={search}
												oninput={handleSearchInput}
												placeholder={`Search ${activeConfig.label.toLowerCase()}...`}
												class="falcon-focus min-h-10 w-full rounded-md border border-outline-variant/70 bg-surface-0 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant"
											/>
										</label>
										<div class="flex flex-wrap items-center gap-2">
											{#each primaryFocusDefinitions as definition (definition.key)}
												<button
													type="button"
													title={definition.description}
													aria-pressed={focusFilter === definition.key}
													onclick={() => toggleFocusFilter(definition.key)}
													class="falcon-focus min-h-10 rounded-md border px-3 text-sm font-semibold transition {focusFilter ===
													definition.key
														? 'border-primary/60 bg-primary text-primary-foreground'
														: 'border-outline-variant/70 text-on-surface-variant hover:bg-surface-2 hover:text-on-surface'}"
												>
													{definition.label}
												</button>
											{/each}
											<details class="relative">
												<summary
													class="falcon-focus inline-flex min-h-10 cursor-pointer list-none items-center rounded-md border border-outline-variant/70 px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-2"
												>
													More
												</summary>
												<div
													class="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-outline-variant/70 bg-surface-1 p-3 shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
												>
													<label class="block text-xs font-semibold text-on-surface-variant">
														Status
														<select
															value={statusFilter}
															onchange={(event) =>
																setStatusFilter(
																	statusFilterFromParam(
																		event.currentTarget instanceof HTMLSelectElement
																			? event.currentTarget.value
																			: null,
																		defaultStatusForType(activeType)
																	)
																)}
															class="falcon-focus mt-1 min-h-10 w-full rounded-md border border-outline-variant/70 bg-surface-0 px-3 text-sm font-normal text-on-surface"
														>
															<option value="open">Open status</option>
															<option value="all">All status</option>
															{#each workStatuses as status (status)}
																<option value={status}>{sentenceCase(formatStatus(status))}</option>
															{/each}
														</select>
													</label>
													{#if secondaryFocusDefinitions.length}
														<div class="mt-3">
															<p class="text-xs font-semibold text-on-surface-variant">
																More filters
															</p>
															<div class="mt-2 flex flex-wrap gap-2">
																{#each secondaryFocusDefinitions as definition (definition.key)}
																	<button
																		type="button"
																		title={definition.description}
																		aria-pressed={focusFilter === definition.key}
																		onclick={() => toggleFocusFilter(definition.key)}
																		class="falcon-focus rounded-md border px-2.5 py-1.5 text-xs font-semibold transition {focusFilter ===
																		definition.key
																			? 'border-primary/60 bg-primary text-primary-foreground'
																			: 'border-outline-variant/70 text-on-surface-variant hover:bg-surface-2 hover:text-on-surface'}"
																	>
																		{definition.label}
																	</button>
																{/each}
															</div>
														</div>
													{/if}
													{#if activeType === 'finding' && findingSourceOptions.length}
														<label class="mt-3 block text-xs font-semibold text-on-surface-variant">
															Source
															<select
																value={sourceFilter}
																onchange={(event) =>
																	setSourceFilter(
																		event.currentTarget instanceof HTMLSelectElement
																			? event.currentTarget.value
																			: ''
																	)}
																class="falcon-focus mt-1 min-h-10 w-full rounded-md border border-outline-variant/70 bg-surface-0 px-3 text-sm font-normal text-on-surface"
															>
																<option value="">Any source</option>
																{#each findingSourceOptions as source (source)}
																	<option value={source}>{source}</option>
																{/each}
															</select>
														</label>
													{/if}
												</div>
											</details>
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
									{#if hasActiveListFilters()}
										<div class="flex flex-wrap items-center gap-2">
											<span class="text-xs font-semibold text-on-surface-variant">Active</span>
											{#if search.trim()}
												<button
													type="button"
													onclick={() => {
														search = '';
														updateSectionQuery({ q: '' });
													}}
													class="falcon-focus inline-flex items-center gap-1 rounded-md border border-outline-variant/70 px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-2"
												>
													Search: {search.trim()}
													<X class="h-3 w-3" />
												</button>
											{/if}
											{#if activeFocusDefinition}
												<button
													type="button"
													onclick={() => toggleFocusFilter(activeFocusDefinition.key)}
													class="falcon-focus inline-flex items-center gap-1 rounded-md border border-primary/50 px-2 py-1 text-xs font-semibold text-primary hover:bg-surface-2"
												>
													{activeFocusDefinition.label}
													<X class="h-3 w-3" />
												</button>
											{/if}
											{#if sourceFilter}
												<button
													type="button"
													onclick={() => setSourceFilter('')}
													class="falcon-focus inline-flex items-center gap-1 rounded-md border border-outline-variant/70 px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-2"
												>
													Source: {sourceFilter}
													<X class="h-3 w-3" />
												</button>
											{/if}
											{#if statusFilter !== defaultStatusForType(activeType)}
												<button
													type="button"
													onclick={() => setStatusFilter(defaultStatusForType(activeType))}
													class="falcon-focus inline-flex items-center gap-1 rounded-md border border-outline-variant/70 px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-2"
												>
													Status: {statusFilter === 'all'
														? 'All'
														: statusFilter === 'open'
															? 'Open'
															: sentenceCase(formatStatus(statusFilter))}
													<X class="h-3 w-3" />
												</button>
											{/if}
											<button
												type="button"
												onclick={clearListFilters}
												class="falcon-focus rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-surface-2"
											>
												Clear all
											</button>
										</div>
									{/if}
								</div>
							</div>

							{#if activeType === 'project'}
								<div
									class="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto bg-surface-0/35 p-3"
									data-testid="project-list"
								>
									<div
										class="hidden rounded-md border border-outline-variant/45 bg-surface-1/80 px-4 py-2 text-xs font-semibold text-on-surface-variant xl:grid xl:grid-cols-[minmax(18rem,1.35fr)_7rem_14rem_10rem_5rem_7rem] xl:items-center xl:gap-4"
										data-testid="project-list-columns"
									>
										<span>Project</span>
										<span>Status</span>
										<span>Coming up</span>
										<span>Open work</span>
										<span class="text-center">Blockers</span>
										<span class="text-right">Updated</span>
									</div>
									{#each filteredItems as project (project.id)}
										<button
											type="button"
											onclick={() => handleProjectRowClick(project)}
											ondblclick={() => handleSectionRowDoubleClick(project)}
											data-testid="work-section-row"
											class="falcon-focus block w-full rounded-md border border-outline-variant/45 bg-surface-1/80 px-4 py-3 text-left transition hover:border-primary/35 hover:bg-surface-2/75"
										>
											<div
												class="grid gap-3 xl:grid-cols-[minmax(18rem,1.35fr)_7rem_14rem_10rem_5rem_7rem] xl:items-center xl:gap-4"
											>
												<div class="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-x-2">
													<span class="text-base font-semibold leading-6 text-on-surface-variant">
														{project.id}.
													</span>
													<h3 class="truncate text-base font-semibold leading-6 text-on-surface">
														{project.title}
													</h3>
													<p
														class="col-start-2 mt-1 line-clamp-2 text-sm leading-5 text-on-surface-variant"
													>
														{firstText(
															project.description,
															project.body,
															'Outcome not written yet'
														)}
													</p>
													<div class="col-start-2 mt-2 flex min-w-0">
														<span
															class="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-semibold text-on-surface"
														>
															<span class="shrink-0 text-primary">Next up:</span>
															<span class="truncate">{projectOperatorMove(project)}</span>
														</span>
													</div>
												</div>

												<div>
													<p class="text-xs font-semibold text-on-surface-variant xl:hidden">
														Status
													</p>
													<p
														class="mt-1 inline-flex rounded bg-surface-3/85 px-2 py-1 text-xs font-semibold xl:mt-0 {statusTone(
															project.status
														)}"
													>
														{sentenceCase(formatStatus(project.status))}
													</p>
												</div>

												<div>
													<p class="text-xs font-semibold text-on-surface-variant xl:hidden">
														Coming up
													</p>
													<p class="mt-1 truncate text-sm font-semibold text-on-surface xl:mt-0">
														{projectUpcoming(project)}
													</p>
												</div>

												<div>
													<p class="text-xs font-semibold text-on-surface-variant xl:hidden">
														Open work
													</p>
													<p class="mt-1 truncate text-sm font-semibold text-on-surface xl:mt-0">
														{projectOpenWork(project)}
													</p>
												</div>

												<div class="xl:text-center">
													<p class="text-xs font-semibold text-on-surface-variant xl:hidden">
														Blockers
													</p>
													<p
														class="mt-1 inline-flex min-w-[5.5rem] justify-center rounded bg-surface-3/80 px-2 py-1 text-xs font-semibold xl:mt-0 {blockerCount(
															project
														)
															? 'text-status-danger'
															: 'text-status-muted'}"
													>
														{blockerCountLabel(project)}
													</p>
												</div>

												<div class="xl:text-right">
													<p class="text-xs font-semibold text-on-surface-variant xl:hidden">
														Updated
													</p>
													<p class="mt-1 text-sm font-semibold text-on-surface xl:mt-0">
														{formatDateTime(project.last_activity_at)}
													</p>
												</div>
											</div>
										</button>
									{:else}
										<p class="p-4 text-sm text-on-surface-variant">{activeConfig.empty}</p>
									{/each}
								</div>
							{:else if activeType === 'change_request'}
								<div class="min-h-0 flex-1 divide-y divide-outline-variant/50 overflow-y-auto">
									{#each filteredItems as change (change.id)}
										<button
											type="button"
											onclick={() => handleSectionRowClick(change)}
											ondblclick={() => handleSectionRowDoubleClick(change)}
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
							{:else if activeType === 'open_question' || activeType === 'decision'}
								<div class="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3">
									{#each filteredItems as question (question.id)}
										<button
											type="button"
											onclick={() => handleSectionRowClick(question)}
											ondblclick={() => handleSectionRowDoubleClick(question)}
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
								<div class="min-h-0 flex-1 divide-y divide-outline-variant/50 overflow-y-auto">
									{#each filteredItems as task (task.id)}
										<button
											type="button"
											onclick={() => handleSectionRowClick(task)}
											ondblclick={() => handleSectionRowDoubleClick(task)}
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
							{:else if activeType === 'automation'}
								<div class="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3">
									{#each filteredItems as routine (routine.id)}
										<button
											type="button"
											onclick={() => handleSectionRowClick(routine)}
											ondblclick={() => handleSectionRowDoubleClick(routine)}
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
														{firstText(
															routine.description,
															routine.body,
															'Automation scope not set'
														)}
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
							{:else if activeType === 'finding'}
								<div class="min-h-0 flex-1 divide-y divide-outline-variant/50 overflow-y-auto">
									{#each filteredItems as observation (observation.id)}
										<button
											type="button"
											onclick={() => handleSectionRowClick(observation)}
											ondblclick={() => handleSectionRowDoubleClick(observation)}
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
													{firstText(
														observation.owner,
														observation.subcategory_id,
														observation.category_id,
														'Work'
													)}
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
								<div class="min-h-0 flex-1 divide-y divide-outline-variant/50 overflow-y-auto">
									{#each filteredItems as item (item.id)}
										<button
											type="button"
											onclick={() => handleSectionRowClick(item)}
											ondblclick={() => handleSectionRowDoubleClick(item)}
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

						{#if showQuickPane && selectedItem && activeType !== 'project'}
							<aside
								class="falcon-soft-panel sticky top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto"
							>
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
										{selectedItem.type === 'open_question' || selectedItem.type === 'decision'
											? questionPrimaryAnswer(selectedItem)
											: detailLead(selectedItem)}
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
							</aside>
						{/if}
					</section>
				{/if}
			</div>
		{/if}
	</div>
</FalconModuleShell>
