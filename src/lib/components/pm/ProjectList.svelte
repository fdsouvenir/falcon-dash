<script lang="ts">
	import {
		loadProjects,
		projects,
		projectsLoading,
		type Project
	} from '$lib/stores/pm-projects.js';
	import {
		domains,
		focuses,
		loadDomains,
		loadFocuses,
		type Domain,
		type Focus
	} from '$lib/stores/pm-domains.js';
	import {
		getPMStats,
		getDashboardContext,
		type PMStats,
		type DashboardContext
	} from '$lib/stores/pm-operations.js';
	import { SvelteSet } from 'svelte/reactivity';
	import { getStatusPill, getPriorityTag, formatDueDate } from './pm-utils.js';

	interface Props {
		onselect?: (projectId: number) => void;
	}

	let { onselect }: Props = $props();

	let projectList = $state<Project[]>([]);
	let domainList = $state<Domain[]>([]);
	let focusList = $state<Focus[]>([]);
	let loading = $state(false);
	let filterMode = $state<'active' | 'all' | 'done' | 'archived'>('active');
	let collapsedDomains = new SvelteSet<string>();
	let collapsedFocuses = new SvelteSet<string>();
	let dashStats = $state<PMStats | null>(null);
	let dashContext = $state<DashboardContext | null>(null);

	$effect(() => {
		const u1 = projects.subscribe((v) => {
			projectList = v;
		});
		const u2 = domains.subscribe((v) => {
			domainList = v;
		});
		const u3 = focuses.subscribe((v) => {
			focusList = v;
		});
		const u4 = projectsLoading.subscribe((v) => {
			loading = v;
		});
		return () => {
			u1();
			u2();
			u3();
			u4();
		};
	});

	$effect(() => {
		loadProjects();
		loadDomains();
		loadFocuses();
		Promise.all([getPMStats(), getDashboardContext()])
			.then(([s, c]) => {
				dashStats = s;
				dashContext = c;
			})
			.catch((err) => {
				console.error('[PM] Failed to load dashboard stats/context:', err);
			});
	});

	interface FocusGroup {
		focus: Focus;
		projects: Project[];
	}

	interface DomainGroup {
		domain: Domain;
		focusGroups: FocusGroup[];
		projectCount: number;
	}

	function sortProjects(projs: Project[]): Project[] {
		return [...projs].sort((a, b) => {
			if (a.due_date && b.due_date) {
				return a.due_date.localeCompare(b.due_date);
			}
			if (a.due_date && !b.due_date) return -1;
			if (!a.due_date && b.due_date) return 1;
			return b.last_activity_at - a.last_activity_at;
		});
	}

	const filtered = $derived.by(() => {
		return projectList.filter((p) => {
			switch (filterMode) {
				case 'active':
					return p.status === 'todo' || p.status === 'in_progress' || p.status === 'review';
				case 'done':
					return p.status === 'done';
				case 'archived':
					return p.status === 'archived' || p.status === 'cancelled';
				case 'all':
					return true;
			}
		});
	});

	const grouped = $derived.by(() => {
		const focusMap: Record<string, Focus> = {};
		for (const f of focusList) focusMap[f.id] = f;

		const domainFocuses: Record<string, Focus[]> = {};
		for (const f of [...focusList].sort((a, b) => a.sort_order - b.sort_order)) {
			const list = domainFocuses[f.domain_id] || [];
			list.push(f);
			domainFocuses[f.domain_id] = list;
		}

		const projectsByFocus: Record<string, Project[]> = {};
		for (const p of filtered) {
			const list = projectsByFocus[p.focus_id] || [];
			list.push(p);
			projectsByFocus[p.focus_id] = list;
		}
		for (const key of Object.keys(projectsByFocus)) {
			projectsByFocus[key] = sortProjects(projectsByFocus[key]);
		}

		const result: DomainGroup[] = [];
		const sortedDomains = [...domainList].sort((a, b) => a.sort_order - b.sort_order);

		for (const domain of sortedDomains) {
			const dFocuses = domainFocuses[domain.id] || [];
			const focusGroups: FocusGroup[] = [];
			let domainProjectCount = 0;

			for (const focus of dFocuses) {
				const projs = projectsByFocus[focus.id];
				if (projs && projs.length > 0) {
					focusGroups.push({ focus, projects: projs });
					domainProjectCount += projs.length;
				}
			}

			if (focusGroups.length > 0) {
				result.push({ domain, focusGroups, projectCount: domainProjectCount });
			}
		}

		return result;
	});

	// Orphan projects: focus doesn't belong to any known domain
	const orphanProjects = $derived.by(() => {
		const focusMap: Record<string, Focus> = {};
		for (const f of focusList) focusMap[f.id] = f;
		const knownDomainIds: Record<string, true> = {};
		for (const d of domainList) knownDomainIds[d.id] = true;
		const orphanFocusIds: Record<string, true> = {};
		for (const f of focusList) {
			if (!knownDomainIds[f.domain_id]) orphanFocusIds[f.id] = true;
		}
		return sortProjects(
			filtered.filter((p) => orphanFocusIds[p.focus_id] || !focusMap[p.focus_id])
		);
	});

	// Attention items: dueSoon + blocked, max 3
	const attentionItems = $derived.by(() => {
		if (!dashContext) return [];
		const items: Array<{ id: number; title: string; tag: string; tagColor: string }> = [];
		for (const d of dashContext.dueSoon) {
			if (items.length >= 3) break;
			items.push({ id: d.id, title: d.title, tag: 'due soon', tagColor: 'text-amber-400' });
		}
		return items;
	});

	function toggleDomain(domainId: string) {
		if (collapsedDomains.has(domainId)) {
			collapsedDomains.delete(domainId);
		} else {
			collapsedDomains.add(domainId);
		}
	}

	function toggleFocus(focusId: string) {
		if (collapsedFocuses.has(focusId)) {
			collapsedFocuses.delete(focusId);
		} else {
			collapsedFocuses.add(focusId);
		}
	}

	const filters: Array<{ key: typeof filterMode; label: string }> = [
		{ key: 'active', label: 'Active' },
		{ key: 'all', label: 'All' },
		{ key: 'done', label: 'Done' },
		{ key: 'archived', label: 'Archived' }
	];
</script>

{#snippet projectRow(project: Project)}
	{@const status = getStatusPill(project.status)}
	{@const priority = getPriorityTag(project.priority)}
	{@const due = formatDueDate(project.due_date)}
	<button
		class="flex min-h-[40px] w-full items-center gap-3 py-2 pl-12 pr-4 text-left transition-colors hover:bg-gray-800/60"
		onclick={() => onselect?.(project.id)}
	>
		<span class="min-w-0 flex-1 truncate text-sm text-gray-200">
			{project.title}
		</span>
		<span class="w-[72px] shrink-0 text-center rounded-full px-2 py-0.5 text-xs {status.classes}">
			{status.label}
		</span>
		<span class="hidden w-[52px] shrink-0 text-center sm:inline-flex sm:justify-center">
			{#if priority}
				<span class="rounded-full px-1.5 py-0.5 text-xs {priority.classes}">
					{priority.label}
				</span>
			{/if}
		</span>
		<span class="w-[72px] shrink-0 text-right text-xs {due?.color || 'text-gray-600'}">
			{due?.text || '\u2014'}
		</span>
	</button>
{/snippet}

<div class="flex h-full flex-col overflow-auto">
	{#if loading}
		<div class="flex flex-1 items-center justify-center text-base text-gray-400">Loading...</div>
	{:else}
		<!-- Dashboard header -->
		<div class="border-b border-gray-800 px-4 pt-4 pb-3">
			<!-- Stat cards -->
			{#if dashStats}
				<div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
					<div class="stat-card rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
						<div class="text-xs text-gray-500">Total</div>
						<div class="text-lg font-semibold text-white">{dashStats.projects.total}</div>
					</div>
					<div class="stat-card rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
						<div class="text-xs text-gray-500">Active</div>
						<div class="text-lg font-semibold text-green-400">
							{dashStats.projects.byStatus.in_progress || 0}
						</div>
					</div>
					<div class="stat-card rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
						<div class="text-xs text-gray-500">Due Soon</div>
						<div class="text-lg font-semibold text-amber-400">
							{dashContext?.dueSoon?.length ?? 0}
						</div>
					</div>
					<div class="stat-card rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
						<div class="text-xs text-gray-500">Overdue</div>
						<div class="text-lg font-semibold text-red-400">{dashStats.overdue}</div>
					</div>
				</div>
			{/if}

			<!-- Attention items -->
			{#if attentionItems.length > 0}
				<div class="mb-3 flex flex-wrap gap-1.5">
					{#each attentionItems as item, i (item.id)}
						<button
							class="attention-chip flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs transition-colors hover:border-gray-600"
							style="animation-delay: {200 + i * 50}ms"
							onclick={() => onselect?.(item.id)}
						>
							<span class="truncate text-white">{item.title}</span>
							<span class={item.tagColor}>{item.tag}</span>
						</button>
					{/each}
				</div>
			{/if}

			<!-- Filter pills -->
			<div class="flex gap-1.5">
				{#each filters as f (f.key)}
					<button
						class="rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 {filterMode ===
						f.key
							? 'bg-gray-700 text-white'
							: 'text-gray-400 hover:text-gray-200'}"
						onclick={() => {
							filterMode = f.key;
						}}
					>
						{f.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Grouped project list -->
		<div class="flex-1 overflow-y-auto">
			{#if grouped.length === 0 && orphanProjects.length === 0}
				<div class="flex items-center justify-center p-8 text-base text-gray-500">
					No projects found
				</div>
			{:else}
				{#each grouped as group (group.domain.id)}
					<!-- Domain header -->
					<button
						class="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-800/50"
						onclick={() => toggleDomain(group.domain.id)}
					>
						<svg
							class="h-3 w-3 text-gray-500 transition-transform duration-200 {collapsedDomains.has(
								group.domain.id
							)
								? '-rotate-90'
								: ''}"
							fill="currentColor"
							viewBox="0 0 12 12"
						>
							<path d="M2 4l4 4 4-4z" />
						</svg>
						<span class="text-xs font-semibold uppercase tracking-wider text-gray-400">
							{group.domain.name}
						</span>
						<span class="text-xs text-gray-600">({group.projectCount})</span>
					</button>

					<div class="collapse-section {collapsedDomains.has(group.domain.id) ? 'collapsed' : ''}">
						<div>
							{#each group.focusGroups as fg (fg.focus.id)}
								<!-- Focus sub-header -->
								<button
									class="flex w-full items-center gap-1.5 py-1 pl-9 pr-4 text-left text-xs text-gray-500 hover:bg-gray-800/30"
									onclick={() => toggleFocus(fg.focus.id)}
								>
									<svg
										class="h-2.5 w-2.5 text-gray-600 transition-transform duration-200 {collapsedFocuses.has(
											fg.focus.id
										)
											? '-rotate-90'
											: ''}"
										fill="currentColor"
										viewBox="0 0 12 12"
									>
										<path d="M2 4l4 4 4-4z" />
									</svg>
									<span>{fg.focus.name}</span>
									<span class="text-gray-600">({fg.projects.length})</span>
								</button>

								<!-- Project rows -->
								<div
									class="collapse-section {collapsedFocuses.has(fg.focus.id) ? 'collapsed' : ''}"
								>
									<div>
										{#each fg.projects as project (project.id)}
											{@render projectRow(project)}
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}

				<!-- Orphan projects (not in any known domain) -->
				{#if orphanProjects.length > 0}
					<div class="mt-1 border-t border-gray-700 pt-1">
						<div class="px-4 py-1.5 text-xs text-gray-500">Other</div>
						{#each orphanProjects as project (project.id)}
							{@render projectRow(project)}
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.collapse-section {
		display: grid;
		grid-template-rows: 1fr;
		transition: grid-template-rows 200ms ease-out;
	}
	.collapse-section.collapsed {
		grid-template-rows: 0fr;
	}
	.collapse-section > div {
		overflow: hidden;
	}

	.stat-card {
		animation: fadeSlideUp 300ms ease-out both;
	}
	.stat-card:nth-child(2) {
		animation-delay: 50ms;
	}
	.stat-card:nth-child(3) {
		animation-delay: 100ms;
	}
	.stat-card:nth-child(4) {
		animation-delay: 150ms;
	}

	.attention-chip {
		animation: fadeSlideUp 300ms ease-out both;
	}

	@keyframes fadeSlideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
