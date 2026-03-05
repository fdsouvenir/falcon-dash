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
	import { getStatusPill, formatDueDate, getDomainAccentColor } from './pm-utils.js';

	interface Props {
		onselect?: (projectId: number) => void;
		selectedId?: number | null;
	}

	let { onselect, selectedId = null }: Props = $props();

	let projectList = $state<Project[]>([]);
	let domainList = $state<Domain[]>([]);
	let focusList = $state<Focus[]>([]);
	let loading = $state(false);
	let filterMode = $state<'active' | 'all' | 'done' | 'archived'>('active');
	let collapsedDomains = new SvelteSet<string>();
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

	/** Flat project list per domain — focus name shown inline on each row. */
	interface DomainGroup {
		domain: Domain;
		projects: Project[];
		/** Maps focus_id -> focus.name for inline display */
		focusNames: Record<string, string>;
		projectCount: number;
	}

	function sortProjects(projs: Project[]): Project[] {
		return [...projs].sort((a, b) => {
			if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
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

		const projectsByDomain: Record<string, Project[]> = {};
		const focusNamesByDomain: Record<string, Record<string, string>> = {};

		for (const p of filtered) {
			const focus = focusMap[p.focus_id];
			const domainId = focus?.domain_id;
			if (!domainId) continue;
			if (!projectsByDomain[domainId]) {
				projectsByDomain[domainId] = [];
				focusNamesByDomain[domainId] = {};
			}
			projectsByDomain[domainId].push(p);
			if (focus) focusNamesByDomain[domainId][p.focus_id] = focus.name;
		}

		for (const key of Object.keys(projectsByDomain)) {
			projectsByDomain[key] = sortProjects(projectsByDomain[key]);
		}

		const result: DomainGroup[] = [];
		const sortedDomains = [...domainList].sort((a, b) => a.sort_order - b.sort_order);

		for (const domain of sortedDomains) {
			const projs = projectsByDomain[domain.id];
			if (projs && projs.length > 0) {
				result.push({
					domain,
					projects: projs,
					focusNames: focusNamesByDomain[domain.id] || {},
					projectCount: projs.length
				});
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

	function toggleDomain(domainId: string) {
		if (collapsedDomains.has(domainId)) {
			collapsedDomains.delete(domainId);
		} else {
			collapsedDomains.add(domainId);
		}
	}

	const filters: Array<{ key: typeof filterMode; label: string }> = [
		{ key: 'active', label: 'Active' },
		{ key: 'all', label: 'All' },
		{ key: 'done', label: 'Done' },
		{ key: 'archived', label: 'Archived' }
	];

	function priorityEmoji(priority: string | null): string {
		if (priority === 'urgent') return '🔴';
		if (priority === 'high') return '🔴';
		if (priority === 'medium') return '🟡';
		if (priority === 'normal' || priority === 'low') return '🟢';
		return '';
	}
</script>

{#snippet projectRow(project: Project, accentColor: string, focusName: string | null)}
	{@const status = getStatusPill(project.status)}
	{@const due = formatDueDate(project.due_date)}
	{@const pri = priorityEmoji(project.priority)}
	{@const isSelected = selectedId === project.id}
	<button
		class="relative mx-2 my-[2px] flex items-center gap-2.5 overflow-hidden rounded-lg py-2.5 pl-5 pr-3 text-left transition-colors {isSelected ? 'bg-gray-700/80' : 'hover:bg-gray-800/60'}"
		onclick={() => onselect?.(project.id)}
	>
		<!-- 5px colored left accent bar -->
		<span class="absolute left-0 top-1 bottom-1 w-[5px] rounded-r" style="background: {accentColor}"></span>

		<!-- Title + focus on same line -->
		<span class="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
			{project.title}
			{#if focusName}
				<span class="ml-1.5 text-[11px] font-normal text-gray-500">· {focusName}</span>
			{/if}
		</span>

		<!-- Status pill -->
		<span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight {status.classes}">
			{status.label}
		</span>

		<!-- Priority emoji -->
		{#if pri}
			<span class="shrink-0 text-[12px]">{pri}</span>
		{/if}

		<!-- Due date -->
		{#if due}
			<span class="shrink-0 text-[11px] {due.color}">{due.text}</span>
		{/if}
	</button>
{/snippet}

<div class="flex h-full flex-col overflow-auto">
	{#if loading}
		<div class="flex flex-1 items-center justify-center text-base text-gray-400">Loading...</div>
	{:else}
		<!-- Header: compact inline stats + filter pills -->
		<div class="border-b border-gray-800 px-4 py-2.5">
			{#if dashStats}
				<div class="mb-2 flex items-center gap-4 text-xs">
					<span class="text-gray-500"
						>Total <span class="font-medium text-white">{dashStats.projects.total}</span></span
					>
					<span class="text-gray-500"
						>Active <span class="font-medium text-green-400"
							>{dashStats.projects.byStatus.in_progress || 0}</span
						></span
					>
					<span class="text-gray-500"
						>Due Soon <span class="font-medium text-amber-400"
							>{dashContext?.dueSoon?.length ?? 0}</span
						></span
					>
					<span class="text-gray-500"
						>Overdue <span class="font-medium text-red-400">{dashStats.overdue}</span></span
					>
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

		<!-- Grouped project list (flat rows per domain, no focus sub-headers) -->
		<div class="flex-1 overflow-y-auto">
			{#if grouped.length === 0 && orphanProjects.length === 0}
				<div class="flex items-center justify-center p-8 text-base text-gray-500">
					No projects found
				</div>
			{:else}
				{#each grouped as group (group.domain.id)}
					{@const accentColor = getDomainAccentColor(group.domain.name)}

					<!-- Domain section header -->
					<button
						class="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-800/50"
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
						<span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
							{group.domain.name}
						</span>
						<span class="text-[10px] text-gray-600">({group.projectCount})</span>
					</button>

					<!-- Flat project rows (focus name shown inline) -->
					<div class="collapse-section {collapsedDomains.has(group.domain.id) ? 'collapsed' : ''}">
						<div>
							{#each group.projects as project (project.id)}
								{@render projectRow(
									project,
									accentColor,
									group.focusNames[project.focus_id] ?? null
								)}
							{/each}
						</div>
					</div>
				{/each}

				{#if orphanProjects.length > 0}
					<div class="mt-1 border-t border-gray-700 pt-1">
						<div class="px-4 py-1 text-[11px] text-gray-500">Other</div>
						{#each orphanProjects as project (project.id)}
							{@render projectRow(project, '#6b7280', null)}
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
</style>
