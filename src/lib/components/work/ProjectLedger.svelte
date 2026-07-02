<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
	import { projectHealth } from '$lib/work/work-insights.js';
	import {
		formatDate,
		formatDateTime,
		formatStatus,
		itemDisplayId,
		openStatuses,
		pathForType,
		priorityTone,
		sentenceCase,
		statusTone,
		waitingLabel,
		workStatuses,
		type WorkBlockerLink,
		type WorkCategory,
		type WorkChange,
		type WorkChangeEntityType,
		type WorkChangeLogEntry,
		type WorkItem,
		type WorkItemType,
		type WorkPriority,
		type WorkStatus
	} from '$lib/work/work-ui.js';
	import { ArrowRight, Pencil, Plus, Save, X } from '@lucide/svelte';
	import { onMount } from 'svelte';

	type ProjectLedgerDraft = {
		status: WorkStatus;
		priority: WorkPriority;
		waiting_on: string;
		category_id: string;
		subcategory_id: string;
	};

	type ProjectLedgerAnchor = {
		id: string;
		number: string;
		label: string;
	};

	type ProjectPlanGroup = {
		id: string;
		title: string;
		description: string | null;
		milestone: WorkItem | null;
		work: WorkItem[];
	};

	let {
		item,
		items,
		activity = [],
		blockerLinks = [],
		draft = $bindable(),
		saving,
		saveMessage,
		error,
		onSave,
		onMilestoneCreated
	}: {
		item: WorkItem;
		items: WorkItem[];
		activity?: WorkChangeLogEntry[];
		blockerLinks?: WorkBlockerLink[];
		draft: ProjectLedgerDraft;
		saving: boolean;
		saveMessage: string | null;
		error: string | null;
		onSave: (event: SubmitEvent) => void;
		onMilestoneCreated?: (item: WorkItem) => void;
	} = $props();

	let addingMilestone = $state(false);
	let creatingMilestone = $state(false);
	let milestoneTitle = $state('');
	let milestoneDescription = $state('');
	let milestoneMessage = $state<string | null>(null);
	let milestoneError = $state<string | null>(null);
	let editingProject = $state(false);
	let categories = $state<WorkCategory[]>([]);
	let subcategories = $state<WorkCategory[]>([]);
	let categoryError = $state<string | null>(null);

	const waitingOptions = [
		{ value: '', label: 'No blocker' },
		{ value: 'operator', label: 'Operator' },
		{ value: 'agent', label: 'Agent' },
		{ value: 'external', label: 'External' },
		{ value: 'system', label: 'System' }
	];

	const baseAnchors: ProjectLedgerAnchor[] = [
		{ id: 'project-current-work', number: '01', label: 'Project Status' },
		{ id: 'project-plan', number: '02', label: 'Project Plan' },
		{ id: 'project-signals', number: '03', label: 'Signals' },
		{ id: 'project-activity', number: '04', label: 'Activity' }
	];

	const planWorkTypes: WorkItemType[] = [
		'next_step',
		'change_request',
		'decision',
		'open_question'
	];

	const directChildren = $derived(
		items.filter((candidate) => candidate.parent_item_id === item.id)
	);
	const milestones = $derived(sortProjectItems(directChildren.filter(isMilestone)));
	const milestoneChildren = $derived(
		items.filter((candidate) =>
			milestones.some((milestone) => candidate.parent_item_id === milestone.id)
		)
	);
	const children = $derived(uniqueItems([...directChildren, ...milestoneChildren]));
	const projectWorkChildren = $derived(
		children.filter((candidate) => candidate.type !== 'milestone')
	);
	const health = $derived(projectHealth(item, projectWorkChildren));
	const activeBlockerLinks = $derived(
		[...blockerLinks]
			.filter((link) => link.status === 'active')
			.sort((a, b) => b.updated_at - a.updated_at || b.id - a.id)
	);
	const currentNextStep = $derived.by(() => {
		if (item.current_next_step_id) {
			const linked = children.find((candidate) => candidate.id === item.current_next_step_id);
			if (linked) return linked;
		}
		return (
			childrenOfType('next_step').filter((candidate) => openStatuses.has(candidate.status))[0] ??
			null
		);
	});
	const automations = $derived(childrenOfType('automation'));
	const findings = $derived(childrenOfType('finding'));
	const projectLevelWork = $derived(
		sortProjectItems(directChildren.filter((candidate) => planWorkTypes.includes(candidate.type)))
	);
	const projectPlanGroups = $derived.by<ProjectPlanGroup[]>(() => {
		const groups: ProjectPlanGroup[] = milestones.map((milestone) => ({
			id: `milestone-${milestone.id}`,
			title: milestone.title,
			description: milestoneBlurb(milestone),
			milestone,
			work: sortProjectItems(
				children.filter(
					(candidate) =>
						candidate.parent_item_id === milestone.id && planWorkTypes.includes(candidate.type)
				)
			)
		}));
		if (projectLevelWork.length || groups.length === 0) {
			groups.push({
				id: 'project-level-work',
				title: 'Project-level work',
				description: groups.length
					? 'Work attached directly to the project instead of a milestone.'
					: 'Work attached to the project before milestone structure exists.',
				milestone: null,
				work: projectLevelWork
			});
		}
		return groups;
	});
	const recentActivity = $derived(activity.slice(0, 8));
	const evidenceLabels = $derived(
		findings
			.flatMap((finding) => finding.source_refs ?? [])
			.filter((value, index, source) => value.trim() && source.indexOf(value) === index)
			.slice(0, 5)
	);
	const hasAutomations = $derived(automations.length > 0);
	const hasFindingsOrEvidence = $derived(findings.length > 0 || evidenceLabels.length > 0);
	const visibleAnchors = $derived(
		baseAnchors.filter((anchor) => anchor.id !== 'project-signals' || hasAutomations)
	);
	const selectedCategory = $derived(
		categories.find((category) => category.id === draft.category_id) ??
			categories.find((category) => category.id === item.category_id) ??
			null
	);
	const availableSubcategories = $derived(
		subcategories.filter((subcategory) => subcategory.parent_category_id === draft.category_id)
	);
	const selectedSubcategory = $derived(
		subcategories.find((subcategory) => subcategory.id === draft.subcategory_id) ??
			subcategories.find((subcategory) => subcategory.id === item.subcategory_id) ??
			null
	);

	onMount(() => {
		void loadCategories();
	});

	function childrenOfType(type: WorkItemType): WorkItem[] {
		return [...children]
			.filter((candidate) => candidate.type === type)
			.sort(
				(a, b) =>
					statusRank(a.status) - statusRank(b.status) ||
					timelineValue(a) - timelineValue(b) ||
					b.last_activity_at - a.last_activity_at
			);
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

	function timelineValue(candidate: WorkItem): number {
		const value =
			candidate.type === 'automation'
				? (candidate.next_run_at ?? candidate.scheduled_at)
				: (candidate.due_date ?? candidate.target_date);
		if (!value) return Number.MAX_SAFE_INTEGER;
		const parsed = typeof value === 'number' ? value * 1000 : new Date(value).valueOf();
		return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
	}

	function firstText(...values: Array<string | number | null | undefined>): string {
		const value = values.find(
			(entry) => entry !== null && entry !== undefined && `${entry}`.trim()
		);
		return value === undefined || value === null ? 'Not set' : `${value}`;
	}

	function routeFor(candidate: WorkItem): `/work/${string}/${string}` {
		return `/work/${pathForType(candidate.type)}/${candidate.id}`;
	}

	function routeForChange(entry: WorkChangeLogEntry): string | null {
		if (!isWorkItemEntity(entry.entity_type)) {
			return entry.entity_type === 'category' || entry.entity_type === 'subcategory'
				? '/work/settings'
				: null;
		}
		if (entry.entity_type === 'project' && entry.entity_id === String(item.id)) return null;
		if (entry.entity_type === 'milestone') return `/work/projects/${item.id}`;
		const id = Number(entry.entity_id);
		return Number.isFinite(id) ? `/work/${pathForType(entry.entity_type)}/${id}` : null;
	}

	function typeLabel(candidate: WorkItem): string {
		return sentenceCase(candidate.type);
	}

	function blockerLinksForItem(itemId: number): WorkBlockerLink[] {
		return activeBlockerLinks.filter((link) => link.blocked_item_id === itemId);
	}

	function blockerSourceLabel(link: WorkBlockerLink): string {
		if (link.blocker_source === 'work_item') {
			return firstText(link.blocker_item_title, `Work item ${link.blocker_item_id}`);
		}
		return firstText(link.external_label, sentenceCase(link.blocker_source));
	}

	function blockedItemLabel(link: WorkBlockerLink): string {
		return firstText(link.blocked_item_title, `Work item ${link.blocked_item_id}`);
	}

	function blockerSourceKind(link: WorkBlockerLink): string {
		if (link.blocker_source === 'work_item') {
			return link.blocker_item_type ? sentenceCase(link.blocker_item_type) : 'Work item';
		}
		if (link.blocker_source === 'person') return 'Person';
		if (link.blocker_source === 'system') return 'System';
		return 'External';
	}

	function blockerCountLabel(): string {
		const count = activeBlockerLinks.length;
		return count ? `${count} holding up` : 'Clear';
	}

	function canNavigateToItem(type: WorkItemType | null, id: number | null): boolean {
		return Boolean(type && id);
	}

	function navigateToItem(type: WorkItemType | null, id: number | null): void {
		if (!type || !id) return;
		if (type === 'milestone') {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- dynamic target uses resolved current project route plus an in-page hash.
			void goto(`${resolve(routeFor(item))}#project-plan`);
			return;
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- dynamic Work item target is built from the resolved Work base path.
		void goto(`${resolve('/work')}/${pathForType(type)}/${id}`);
	}

	function changeEntityLabel(entry: WorkChangeLogEntry): string {
		return sentenceCase(entry.entity_type);
	}

	function changeActionLabel(entry: WorkChangeLogEntry): string {
		return sentenceCase(entry.action);
	}

	function changeTitle(entry: WorkChangeLogEntry): string {
		return entry.entity_title ?? `${changeEntityLabel(entry)} ${entry.entity_id}`;
	}

	function changeValue(value: unknown): string {
		if (value === null || value === undefined || value === '') return 'None';
		if (Array.isArray(value)) return value.length ? value.join(', ') : 'None';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		return String(value);
	}

	function changeDetail(change: WorkChange): string {
		return `${change.label}: ${changeValue(change.from)} -> ${changeValue(change.to)}`;
	}

	function isWorkItemEntity(type: WorkChangeEntityType): type is WorkItemType {
		return [
			'project',
			'milestone',
			'next_step',
			'open_question',
			'decision',
			'automation',
			'finding',
			'change_request'
		].includes(type);
	}

	function compactDetail(candidate: WorkItem): string {
		return firstText(
			candidate.next_step_action,
			candidate.question_text,
			candidate.decision_question,
			candidate.change_scope,
			candidate.finding_text,
			candidate.next_action,
			candidate.description,
			candidate.body,
			candidate.title
		);
	}

	function sortProjectItems(source: WorkItem[]): WorkItem[] {
		return [...source].sort(
			(a, b) =>
				statusRank(a.status) - statusRank(b.status) ||
				timelineValue(a) - timelineValue(b) ||
				b.last_activity_at - a.last_activity_at
		);
	}

	function uniqueItems(source: WorkItem[]): WorkItem[] {
		const seen: number[] = [];
		return source.filter((candidate) => {
			if (seen.includes(candidate.id)) return false;
			seen.push(candidate.id);
			return true;
		});
	}

	function isMilestone(candidate: WorkItem): boolean {
		return candidate.type === 'milestone';
	}

	function itemPrimaryText(candidate: WorkItem): string {
		if (candidate.type === 'automation')
			return firstText(
				candidate.last_result,
				candidate.result,
				candidate.description,
				candidate.title
			);
		if (candidate.type === 'milestone')
			return firstText(candidate.milestone_marker, candidate.description, candidate.title);
		return compactDetail(candidate);
	}

	function milestoneBlurb(milestone: WorkItem): string | null {
		const marker =
			milestone.milestone_marker?.trim() && milestone.milestone_marker !== milestone.title
				? milestone.milestone_marker
				: null;
		return firstText(milestone.description, marker, null) === 'Not set'
			? null
			: firstText(milestone.description, marker, null);
	}

	async function loadCategories() {
		categoryError = null;
		try {
			const response = await fetch('/api/work/categories');
			if (!response.ok) throw new Error(`Categories request failed: ${response.status}`);
			const data = (await response.json()) as {
				categories?: WorkCategory[];
				subcategories?: WorkCategory[];
			};
			categories = data.categories ?? [];
			subcategories = data.subcategories ?? [];
		} catch (err) {
			categoryError = err instanceof Error ? err.message : 'Unable to load categories';
		}
	}

	function resetProjectDraft() {
		draft.status = item.status;
		draft.priority = item.priority ?? 'normal';
		draft.waiting_on = item.waiting_on ?? '';
		draft.category_id = item.category_id ?? '';
		draft.subcategory_id = item.subcategory_id ?? '';
	}

	function cancelProjectEdit() {
		resetProjectDraft();
		editingProject = false;
	}

	function handleCategoryChange() {
		if (
			draft.subcategory_id &&
			!subcategories.some(
				(subcategory) =>
					subcategory.id === draft.subcategory_id &&
					subcategory.parent_category_id === draft.category_id
			)
		) {
			draft.subcategory_id = '';
		}
	}

	function categoryLabel(): string {
		if (selectedSubcategory && selectedCategory)
			return `${selectedCategory.title} / ${selectedSubcategory.title}`;
		return firstText(selectedCategory?.title, item.subcategory_id, item.category_id, 'Not set');
	}

	function projectWaitingLabel(): string {
		return item.waiting_on ? waitingLabel(item.waiting_on) : 'Nothing waiting';
	}

	async function createMilestone(event: SubmitEvent) {
		event.preventDefault();
		const title = milestoneTitle.trim();
		const description = milestoneDescription.trim().replace(/\s+/g, ' ');
		if (!title) {
			milestoneError = 'Add a milestone title first.';
			return;
		}
		creatingMilestone = true;
		milestoneMessage = null;
		milestoneError = null;
		try {
			const response = await fetch('/api/work/items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'milestone',
					parent_item_id: item.id,
					title,
					description: description || null,
					milestone_marker: description || title,
					status: 'planning',
					priority: 'normal',
					category_id: item.category_id ?? null,
					subcategory_id: item.subcategory_id ?? null,
					actor: 'operator'
				})
			});
			if (!response.ok) throw new Error(`Milestone create failed: ${response.status}`);
			const created = (await response.json()) as WorkItem;
			onMilestoneCreated?.(created);
			milestoneTitle = '';
			milestoneDescription = '';
			addingMilestone = false;
			milestoneMessage = 'Milestone added';
		} catch (err) {
			milestoneError = err instanceof Error ? err.message : 'Unable to add milestone';
		} finally {
			creatingMilestone = false;
		}
	}

	function dateLabel(candidate: WorkItem): string {
		if (candidate.type === 'automation')
			return `Next ${formatDateTime(candidate.next_run_at ?? candidate.scheduled_at)}`;
		if (candidate.due_date) return `Due ${formatDate(candidate.due_date)}`;
		return formatDateTime(candidate.last_activity_at);
	}

	function briefValue(field: keyof WorkItem, fallback: string): string {
		const value = item[field];
		return typeof value === 'string' && value.trim() ? value : fallback;
	}

	function healthLabel(): string {
		return item.health ? sentenceCase(item.health) : health.label;
	}

	function projectScheduleLabel(): string {
		const upcoming = [...children, item]
			.filter((candidate) => timelineValue(candidate) !== Number.MAX_SAFE_INTEGER)
			.sort((a, b) => timelineValue(a) - timelineValue(b))[0];
		if (!upcoming) return 'No date set';
		const prefix = upcoming.id === item.id ? 'Project' : typeLabel(upcoming);
		return `${prefix} · ${dateLabel(upcoming).replace(/^Due /, '')}`;
	}
</script>

<section
	class="overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-1 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
	data-testid="work-detail-page"
>
	<div
		class="grid min-h-[calc(100dvh-7rem)] xl:grid-cols-[14rem_minmax(0,1fr)_23rem]"
		data-testid="project-ledger"
	>
		<aside class="hidden border-r border-outline-variant/55 bg-surface-0/45 p-4 xl:block">
			<p class="text-xs font-semibold uppercase text-on-surface-variant">Project ledger</p>
			<p class="mt-2 text-lg font-semibold text-on-surface">{itemDisplayId(item)}</p>
			<nav class="mt-5 space-y-1" aria-label="Project ledger sections">
				{#each visibleAnchors as anchor (anchor.id)}
					<a
						href={`#${anchor.id}`}
						class="falcon-focus flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-2 hover:text-on-surface"
					>
						<span class="font-mono text-xs">{anchor.number}.</span>
						<span>{anchor.label}</span>
					</a>
				{/each}
			</nav>
			<a
				href={resolve('/work/projects')}
				class="falcon-focus mt-6 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-primary transition hover:bg-surface-2"
			>
				<ArrowRight class="h-4 w-4 rotate-180" />
				Projects
			</a>
		</aside>

		<div class="min-w-0">
			<header class="border-b border-outline-variant/55 bg-surface-0/35 px-4 py-4 sm:px-5">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2 text-sm">
							<a
								href={resolve('/work/projects')}
								class="falcon-focus rounded-md text-on-surface-variant transition hover:text-primary"
							>
								Projects
							</a>
							<span class="text-on-surface-variant">/</span>
							<span class="text-on-surface-variant">{itemDisplayId(item)}</span>
						</div>
						<h2 class="mt-2 text-2xl font-semibold leading-tight text-on-surface sm:text-3xl">
							{item.title}
						</h2>
					</div>
					<div class="shrink-0 text-left sm:text-right">
						<p class="text-xs text-on-surface-variant">Last updated</p>
						<p class="mt-1 text-sm font-semibold text-on-surface">
							{formatDateTime(item.last_meaningful_update_at ?? item.last_activity_at)}
						</p>
					</div>
				</div>
			</header>

			<div class="space-y-8 px-4 py-5 sm:px-5">
				<section id="project-current-work" class="scroll-mt-20">
					<div class="mb-3 flex items-center justify-between gap-3">
						<div class="flex items-center gap-2">
							<span class="h-2 w-2 rounded-full bg-primary"></span>
							<h3 class="text-sm font-semibold text-on-surface">Project Status</h3>
						</div>
						<button
							type="button"
							class="falcon-focus inline-flex min-h-8 items-center justify-center gap-2 rounded-md px-2.5 text-sm font-semibold text-primary transition hover:bg-surface-2"
							onclick={() => {
								resetProjectDraft();
								editingProject = !editingProject;
							}}
						>
							{#if editingProject}
								<X class="h-4 w-4" />
								Close
							{:else}
								<Pencil class="h-4 w-4" />
								Edit
							{/if}
						</button>
					</div>
					<div class="overflow-hidden rounded-lg border border-outline-variant/55 bg-surface-0/35">
						{#if editingProject}
							<form class="p-4" onsubmit={onSave}>
								<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
									<label class="grid gap-1 text-xs text-on-surface-variant">
										Status
										<select
											bind:value={draft.status}
											class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
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
											class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
										>
											<option value="low">Low</option>
											<option value="normal">Normal</option>
											<option value="high">High</option>
											<option value="urgent">Urgent</option>
										</select>
									</label>
									<label class="grid gap-1 text-xs text-on-surface-variant">
										Waiting for
										<select
											bind:value={draft.waiting_on}
											class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
										>
											{#each waitingOptions as option (option.value)}
												<option value={option.value}>{option.label}</option>
											{/each}
										</select>
									</label>
									<label class="grid gap-1 text-xs text-on-surface-variant">
										Category
										<select
											bind:value={draft.category_id}
											onchange={handleCategoryChange}
											aria-label="Category"
											class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
										>
											<option value="">None</option>
											{#each categories as category (category.id)}
												<option value={category.id}>{category.title}</option>
											{/each}
										</select>
									</label>
									<label class="grid gap-1 text-xs text-on-surface-variant md:col-span-2">
										Subcategory
										<select
											bind:value={draft.subcategory_id}
											disabled={!draft.category_id || availableSubcategories.length === 0}
											aria-label="Subcategory"
											class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface disabled:opacity-60"
										>
											<option value="">None</option>
											{#each availableSubcategories as subcategory (subcategory.id)}
												<option value={subcategory.id}>{subcategory.title}</option>
											{/each}
										</select>
									</label>
								</div>
								<div class="mt-4 flex flex-wrap items-center justify-end gap-2">
									{#if saveMessage}<span class="mr-auto text-xs text-status-active"
											>{saveMessage}</span
										>{/if}
									{#if error}<span class="mr-auto text-xs text-status-danger">{error}</span>{/if}
									<button
										type="button"
										class="falcon-focus inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-2 hover:text-on-surface"
										onclick={cancelProjectEdit}
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={saving}
										class="falcon-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
									>
										<Save class="h-4 w-4" />
										{saving ? 'Saving...' : 'Save changes'}
									</button>
								</div>
								{#if categoryError}<p class="mt-3 text-xs text-status-warning">
										{categoryError}
									</p>{/if}
							</form>
						{:else}
							<div class="grid gap-x-4 gap-y-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
								<div class="min-w-0">
									<p class="text-xs text-on-surface-variant">Status</p>
									<p class="mt-0.5 truncate text-sm font-semibold {statusTone(item.status)}">
										{sentenceCase(formatStatus(item.status))}
									</p>
								</div>
								<div class="min-w-0">
									<p class="text-xs text-on-surface-variant">Health</p>
									<p class="mt-0.5 truncate text-sm font-semibold {health.tone}">
										{healthLabel()}
									</p>
								</div>
								<div class="min-w-0">
									<p class="text-xs text-on-surface-variant">Priority</p>
									<p class="mt-0.5 truncate text-sm font-semibold {priorityTone(item.priority)}">
										{sentenceCase(item.priority ?? 'normal')}
									</p>
								</div>
								<div class="min-w-0">
									<p class="text-xs text-on-surface-variant">Waiting for</p>
									<p class="mt-0.5 truncate text-sm font-semibold text-on-surface">
										{projectWaitingLabel()}
									</p>
								</div>
								<div class="min-w-0">
									<p class="text-xs text-on-surface-variant">Category</p>
									<p class="mt-0.5 truncate text-sm font-semibold text-on-surface">
										{categoryLabel()}
									</p>
								</div>
								<div class="min-w-0">
									<p class="text-xs text-on-surface-variant">Schedule</p>
									<p class="mt-0.5 truncate text-sm font-semibold text-on-surface">
										{projectScheduleLabel()}
									</p>
								</div>
								<div class="min-w-0">
									<p class="text-xs text-on-surface-variant">Last update</p>
									<p class="mt-0.5 truncate text-sm font-semibold text-on-surface">
										{formatDateTime(item.last_meaningful_update_at ?? item.last_activity_at)}
									</p>
								</div>
								<div class="min-w-0">
									<p class="text-xs text-on-surface-variant">Operator</p>
									<p class="mt-0.5 truncate text-sm font-semibold text-on-surface">
										{firstText(item.operator, item.owner, 'Not set')}
									</p>
								</div>
							</div>
							<div class="border-t border-outline-variant/35 p-3">
								{#if currentNextStep}
									<a
										href={resolve(routeFor(currentNextStep))}
										class="falcon-focus grid gap-2 rounded-md border border-primary/25 bg-primary-container/10 p-2.5 transition hover:border-primary/45 hover:bg-primary-container/15 md:grid-cols-[9rem_minmax(0,1fr)_9rem]"
									>
										<div class="flex flex-wrap items-center gap-2 md:block">
											<p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
												Current next step
											</p>
											<p class="text-xs {statusTone(currentNextStep.status)} md:mt-1">
												{formatStatus(currentNextStep.status)}
											</p>
										</div>
										<div class="min-w-0">
											<p class="truncate text-sm font-semibold text-on-surface">
												{currentNextStep.title}
											</p>
											<p class="mt-0.5 line-clamp-1 text-xs leading-5 text-on-surface-variant">
												{itemPrimaryText(currentNextStep)}
											</p>
										</div>
										<p class="text-xs font-semibold text-on-surface-variant md:text-right">
											{dateLabel(currentNextStep)}
										</p>
									</a>
								{:else}
									<p
										class="rounded-md border border-outline-variant/35 bg-surface-1/40 px-3 py-2 text-sm text-on-surface-variant"
									>
										No current next step is linked.
									</p>
								{/if}
							</div>
							{#if activeBlockerLinks.length}
								<div
									class="border-t border-outline-variant/45 p-3"
									data-testid="project-blocker-panel"
								>
									<div class="mb-2 flex flex-wrap items-center justify-between gap-3">
										<h4 class="text-sm font-semibold text-status-danger">Holding up</h4>
										<span
											class="rounded-md border border-status-danger/35 px-2 py-1 text-xs font-semibold text-status-danger"
										>
											{blockerCountLabel()}
										</span>
									</div>
									<div class="overflow-hidden rounded-md border border-status-danger/25">
										<div
											class="hidden grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(10rem,0.9fr)] gap-3 border-b border-status-danger/20 bg-status-danger-bg/20 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant md:grid"
										>
											<span class="text-status-danger">Stuck</span>
											<span>Blocked by</span>
											<span>Unblock move</span>
										</div>
										{#each activeBlockerLinks as link (link.id)}
											{@const blockedHref = canNavigateToItem(
												link.blocked_item_type,
												link.blocked_item_id
											)}
											{@const blockerHref = canNavigateToItem(
												link.blocker_item_type,
												link.blocker_item_id
											)}
											<div
												class="grid gap-2 border-b border-status-danger/20 bg-status-danger-bg/15 px-2.5 py-2 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(10rem,0.9fr)] md:gap-3"
												data-testid="project-blocker-row"
											>
												<div class="min-w-0">
													<p
														class="text-xs font-semibold uppercase tracking-[0.12em] text-status-danger md:hidden"
													>
														Stuck
													</p>
													{#if blockedHref}
														<button
															type="button"
															onclick={() =>
																navigateToItem(link.blocked_item_type, link.blocked_item_id)}
															class="falcon-focus block max-w-full truncate text-left text-sm font-semibold text-on-surface hover:text-primary md:mt-0"
														>
															{blockedItemLabel(link)}
														</button>
													{:else}
														<p class="truncate text-sm font-semibold text-on-surface">
															{blockedItemLabel(link)}
														</p>
													{/if}
													{#if link.reason}
														<p class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
															{link.reason}
														</p>
													{/if}
												</div>
												<div class="min-w-0">
													<p
														class="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant md:hidden"
													>
														Blocked by
													</p>
													{#if blockerHref}
														<button
															type="button"
															onclick={() =>
																navigateToItem(link.blocker_item_type, link.blocker_item_id)}
															class="falcon-focus block max-w-full truncate text-left text-sm font-semibold text-on-surface hover:text-primary md:mt-0"
														>
															{blockerSourceLabel(link)}
														</button>
													{:else}
														<p class="truncate text-sm font-semibold text-on-surface">
															{blockerSourceLabel(link)}
														</p>
													{/if}
													<p class="mt-0.5 text-xs text-on-surface-variant">
														{blockerSourceKind(link)}
													</p>
												</div>
												<div class="min-w-0">
													<p
														class="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant md:hidden"
													>
														Unblock move
													</p>
													<p class="line-clamp-2 text-sm leading-5 text-on-surface md:mt-0">
														{firstText(link.unblock_action, 'Clarify the next unblock step.')}
													</p>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					</div>
				</section>

				<section id="project-plan" class="scroll-mt-20" data-testid="project-plan">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-status-info"></span>
						<h3 class="text-sm font-semibold text-on-surface">Project plan</h3>
					</div>
					<div class="space-y-4">
						{#each projectPlanGroups as group (group.id)}
							<div
								class="overflow-hidden rounded-lg border border-outline-variant/55 bg-surface-0/35"
								data-testid="project-plan-group"
							>
								<div class="border-b border-outline-variant/45 bg-surface-1/45 px-4 py-3">
									<div class="min-w-0">
										<div class="flex flex-wrap items-center gap-2">
											{#if group.milestone}
												<p class="text-base font-semibold text-on-surface">{group.title}</p>
											{:else}
												<p class="text-base font-semibold text-on-surface">{group.title}</p>
											{/if}
										</div>
										{#if group.description}
											<p class="mt-1 text-sm leading-6 text-on-surface-variant">
												{group.description}
											</p>
										{/if}
										{#if group.milestone && blockerLinksForItem(group.milestone.id).length}
											<div class="mt-3 space-y-2" data-testid="project-plan-blockers">
												{#each blockerLinksForItem(group.milestone.id) as link (link.id)}
													<div
														class="rounded-md border border-status-danger/25 bg-status-danger-bg/25 px-3 py-2 text-xs"
														data-testid="project-plan-blocker"
													>
														<p class="font-semibold text-status-danger">
															Blocked by {blockerSourceLabel(link)}
														</p>
														<p class="mt-1 text-on-surface-variant">
															{firstText(link.reason, 'No blocker reason recorded.')}
														</p>
														<p class="mt-1 text-on-surface">
															Unblock: {firstText(
																link.unblock_action,
																'Clarify the next unblock step.'
															)}
														</p>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								</div>
								<div class="divide-y divide-outline-variant/35">
									{#each group.work as work (work.id)}
										<a
											href={resolve(routeFor(work))}
											class="grid gap-3 px-4 py-3 transition hover:bg-surface-2/55 md:grid-cols-[8rem_minmax(0,1fr)_8rem]"
										>
											<div class="flex flex-wrap items-center gap-2 md:block">
												<p class="text-xs font-semibold text-on-surface-variant">
													{typeLabel(work)}
												</p>
												<p class="mt-0 text-xs {statusTone(work.status)} md:mt-2">
													{formatStatus(work.status)}
												</p>
											</div>
											<div class="min-w-0">
												<p class="text-sm font-semibold text-on-surface">{work.title}</p>
												<p class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
													{itemPrimaryText(work)}
												</p>
												{#if work.type === 'decision' && work.consequence_of_no_decision}
													<p class="mt-1 text-xs text-status-warning">
														No decision: {work.consequence_of_no_decision}
													</p>
												{/if}
												{#if work.type === 'open_question'}
													<p class="mt-1 text-xs text-on-surface-variant">
														Can answer: {firstText(work.answerer, work.owner, 'Not set')}
													</p>
												{/if}
												{#if blockerLinksForItem(work.id).length}
													<div class="mt-3 space-y-2" data-testid="project-plan-blockers">
														{#each blockerLinksForItem(work.id) as link (link.id)}
															<div
																class="rounded-md border border-status-danger/25 bg-status-danger-bg/25 px-3 py-2 text-xs"
																data-testid="project-plan-blocker"
															>
																<p class="font-semibold text-status-danger">
																	Blocked by {blockerSourceLabel(link)}
																</p>
																<p class="mt-1 text-on-surface-variant">
																	{firstText(link.reason, 'No blocker reason recorded.')}
																</p>
																<p class="mt-1 text-on-surface">
																	Unblock: {firstText(
																		link.unblock_action,
																		'Clarify the next unblock step.'
																	)}
																</p>
															</div>
														{/each}
													</div>
												{/if}
											</div>
											<p class="text-xs text-on-surface-variant md:text-right">
												{dateLabel(work)}
											</p>
										</a>
									{:else}
										<p class="px-4 py-3 text-sm text-on-surface-variant">
											No work is attached here yet.
										</p>
									{/each}
								</div>
							</div>
						{:else}
							<p
								class="rounded-md border border-outline-variant/45 bg-surface-0/25 p-4 text-sm text-on-surface-variant"
							>
								No project plan has been captured yet.
							</p>
						{/each}
					</div>
				</section>

				{#if hasAutomations}
					<section id="project-signals" class="scroll-mt-20">
						<div class="mb-3 flex items-center gap-2">
							<span class="h-2 w-2 rounded-full bg-status-active"></span>
							<h3 class="text-sm font-semibold text-on-surface">Automations</h3>
						</div>
						<div class="grid gap-2 md:grid-cols-2">
							{#each automations as automation (automation.id)}
								<a
									href={resolve(routeFor(automation))}
									class="rounded-md border border-outline-variant/45 bg-surface-0/35 p-4 transition hover:bg-surface-2/55"
								>
									<div class="flex items-center justify-between gap-3">
										<p class="text-sm font-semibold text-on-surface">{automation.title}</p>
										<span
											class="text-xs {automation.enabled
												? 'text-status-active'
												: 'text-status-muted'}"
										>
											{automation.enabled ? 'Enabled' : 'Paused'}
										</span>
									</div>
									<p class="mt-2 text-sm text-on-surface-variant">
										{itemPrimaryText(automation)}
									</p>
									<p class="mt-2 text-xs text-on-surface-variant">
										{firstText(automation.trigger_type, 'manual')} · {dateLabel(automation)}
									</p>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				{#if hasFindingsOrEvidence}
					<section id="project-findings" class="scroll-mt-20">
						<div class="mb-3 flex items-center gap-2">
							<span class="h-2 w-2 rounded-full bg-on-surface-variant"></span>
							<h3 class="text-sm font-semibold text-on-surface">Findings and evidence</h3>
						</div>
						{#if findings.length}
							<div
								class="divide-y divide-outline-variant/35 rounded-lg border border-outline-variant/45 bg-surface-0/35"
							>
								{#each findings as finding (finding.id)}
									<a
										href={resolve(routeFor(finding))}
										class="grid gap-3 px-4 py-3 transition hover:bg-surface-2/55 md:grid-cols-[7rem_minmax(0,1fr)_9rem]"
									>
										<p class="text-xs text-on-surface-variant">
											{formatDateTime(finding.created_at)}
										</p>
										<div class="min-w-0">
											<p class="text-sm font-semibold text-on-surface">{finding.title}</p>
											<p class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
												{itemPrimaryText(finding)}
											</p>
										</div>
										<p class="text-xs text-on-surface-variant md:text-right">
											{firstText(finding.source_refs?.[0], finding.owner, 'Work')}
										</p>
									</a>
								{/each}
							</div>
						{/if}
						{#if evidenceLabels.length}
							<div class="mt-3 flex flex-wrap gap-2">
								{#each evidenceLabels as evidence (evidence)}
									<span
										class="rounded-md border border-outline-variant/50 bg-surface-0/35 px-2 py-1 text-xs font-semibold text-on-surface-variant"
									>
										{evidence}
									</span>
								{/each}
							</div>
						{/if}
					</section>
				{/if}

				<section id="project-activity" class="scroll-mt-20">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-primary"></span>
						<h3 class="text-sm font-semibold text-on-surface">Activity</h3>
					</div>
					<div class="space-y-3 border-l border-outline-variant/55 pl-4">
						{#each recentActivity as entry (entry.id)}
							{@const href = routeForChange(entry)}
							<svelte:element
								this={href ? 'a' : 'div'}
								href={href ?? undefined}
								class="block rounded-md px-3 py-2 transition hover:bg-surface-2/55"
							>
								<div class="flex flex-wrap items-center gap-2 text-xs">
									<span class="text-on-surface-variant">{changeEntityLabel(entry)}</span>
									<span class="text-on-surface-variant">{changeActionLabel(entry)}</span>
									<span class="text-on-surface-variant">
										{formatDateTime(entry.occurred_at)}
									</span>
								</div>
								<p class="mt-1 text-sm font-semibold text-on-surface">{changeTitle(entry)}</p>
								<p class="mt-0.5 text-xs text-on-surface-variant">{entry.summary}</p>
								{#if entry.changes.length}
									<div class="mt-2 flex flex-wrap gap-2">
										{#each entry.changes.slice(0, 3) as change (change.field)}
											<span
												class="rounded-md border border-outline-variant/45 bg-surface-0/40 px-2 py-1 text-xs text-on-surface-variant"
											>
												{changeDetail(change)}
											</span>
										{/each}
									</div>
								{/if}
							</svelte:element>
						{:else}
							<p class="text-sm text-on-surface-variant">
								No project change events have been recorded yet.
							</p>
						{/each}
					</div>
				</section>
			</div>
		</div>

		<aside class="border-t border-outline-variant/55 bg-surface-0/45 p-3 xl:border-l xl:border-t-0">
			<div
				class="space-y-3 xl:sticky xl:top-3 xl:max-h-[calc(100dvh-1.5rem)] xl:overflow-y-auto xl:pr-1"
			>
				<section class="rounded-lg border border-outline-variant/45 bg-surface-1/45 p-3">
					<div class="flex items-center justify-between gap-3">
						<div>
							<h3 class="text-sm font-semibold text-on-surface">Milestones</h3>
							<p class="mt-1 text-xs text-on-surface-variant">Short project checkpoints.</p>
						</div>
						<button
							type="button"
							class="falcon-focus inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
							onclick={() => {
								addingMilestone = !addingMilestone;
								milestoneMessage = null;
								milestoneError = null;
							}}
						>
							<Plus class="h-4 w-4" />
							Add
						</button>
					</div>
					{#if addingMilestone}
						<form
							class="mt-3 space-y-3 border-t border-outline-variant/35 pt-3"
							onsubmit={createMilestone}
						>
							<label class="grid gap-1 text-xs text-on-surface-variant">
								Title
								<input
									bind:value={milestoneTitle}
									maxlength="90"
									class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
									placeholder="Launch and stabilize"
								/>
							</label>
							<label class="grid gap-1 text-xs text-on-surface-variant">
								Short description
								<textarea
									bind:value={milestoneDescription}
									maxlength="140"
									rows="2"
									class="falcon-focus resize-none rounded-md border border-outline-variant/70 bg-surface-0 px-2 py-2 text-sm text-on-surface"
									placeholder="One sentence about what this checkpoint means."
								></textarea>
							</label>
							<button
								type="submit"
								disabled={creatingMilestone}
								class="falcon-focus inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
							>
								<Plus class="h-4 w-4" />
								{creatingMilestone ? 'Adding...' : 'Add milestone'}
							</button>
						</form>
					{/if}
					{#if milestoneMessage}<p class="mt-2 text-xs text-status-active">
							{milestoneMessage}
						</p>{/if}
					{#if milestoneError}<p class="mt-2 text-xs text-status-danger">{milestoneError}</p>{/if}
				</section>

				<section
					id="project-brief"
					class="rounded-lg border border-outline-variant/45 bg-surface-0/35 p-4"
				>
					<h3 class="text-sm font-semibold text-on-surface">Operating brief</h3>
					<div class="mt-4 space-y-4">
						<div>
							<p class="text-xs text-on-surface-variant">Goal</p>
							<p class="mt-1 text-sm leading-6 text-on-surface">
								{briefValue(
									'goal',
									firstText(item.description, item.body, 'No project goal recorded yet.')
								)}
							</p>
						</div>
						<div>
							<p class="text-xs text-on-surface-variant">Definition of done</p>
							<div class="mt-1 text-sm leading-6 text-on-surface">
								<MarkdownRenderer
									content={briefValue('definition_of_done', 'No definition of done recorded yet.')}
								/>
							</div>
						</div>
						<div>
							<p class="text-xs text-on-surface-variant">Why it matters</p>
							<p class="mt-1 text-sm leading-6 text-on-surface">
								{briefValue('why_it_matters', 'No impact statement recorded yet.')}
							</p>
						</div>
						<div>
							<p class="text-xs text-on-surface-variant">Scope</p>
							<p class="mt-1 text-sm leading-6 text-on-surface">
								{briefValue('scope', 'No in-scope boundary recorded yet.')}
							</p>
						</div>
						<div>
							<p class="text-xs text-on-surface-variant">Non-scope</p>
							<p class="mt-1 text-sm leading-6 text-on-surface">
								{briefValue('non_scope', 'No explicit non-scope recorded yet.')}
							</p>
						</div>
					</div>
				</section>
			</div>
		</aside>
	</div>
</section>
