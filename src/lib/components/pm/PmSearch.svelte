<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PmSearchResultItem } from '$lib/types';
	import { searchPm, pmProjects, pmFocuses } from '$lib/stores';

	const dispatch = createEventDispatcher<{
		select: { entityType: string; id: number | string };
	}>();

	// --- State ---

	let query = '';
	let results: PmSearchResultItem[] = [];
	let loading = false;
	let searched = false;
	let activeIndex = -1;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let inputEl: HTMLInputElement;

	// --- Helpers ---

	function entityTypeLabel(t: string): string {
		switch (t) {
			case 'project':
				return 'Projects';
			case 'task':
				return 'Tasks';
			case 'comment':
				return 'Comments';
			case 'domain':
				return 'Domains';
			case 'focus':
				return 'Focuses';
			case 'milestone':
				return 'Milestones';
			default:
				return t.charAt(0).toUpperCase() + t.slice(1) + 's';
		}
	}

	function entityTypeIcon(t: string): string {
		switch (t) {
			case 'project':
				return 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z';
			case 'task':
				return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4';
			case 'comment':
				return 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';
			default:
				return 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z';
		}
	}

	function getProjectTitle(projectId: number | undefined): string {
		if (projectId == null) return '';
		const proj = $pmProjects.find((p) => p.id === projectId);
		return proj ? proj.title : `#${projectId}`;
	}

	function getFocusName(focusId: string | undefined): string {
		if (!focusId) return '';
		const focus = $pmFocuses.find((f) => f.id === focusId);
		return focus ? focus.name : '';
	}

	function resultContext(item: PmSearchResultItem): string {
		switch (item.entityType) {
			case 'project': {
				const proj = $pmProjects.find((p) => p.id === item.id);
				if (proj) {
					const focusName = getFocusName(proj.focusId);
					return focusName ? focusName : '';
				}
				return '';
			}
			case 'task': {
				if (item.snippet) return item.snippet;
				return '';
			}
			case 'comment':
				return item.snippet || '';
			default:
				return item.snippet || '';
		}
	}

	// --- Group results by entity type ---

	interface ResultGroup {
		entityType: string;
		items: PmSearchResultItem[];
	}

	function groupResults(items: PmSearchResultItem[]): ResultGroup[] {
		const groups = new Map<string, PmSearchResultItem[]>();
		const order = ['project', 'task', 'comment', 'domain', 'focus', 'milestone'];

		for (const item of items) {
			const existing = groups.get(item.entityType);
			if (existing) {
				existing.push(item);
			} else {
				groups.set(item.entityType, [item]);
			}
		}

		const sorted: ResultGroup[] = [];
		for (const type of order) {
			const items = groups.get(type);
			if (items) {
				sorted.push({ entityType: type, items });
				groups.delete(type);
			}
		}
		// Add any remaining types not in the order list
		for (const [entityType, items] of groups) {
			sorted.push({ entityType, items });
		}
		return sorted;
	}

	$: grouped = groupResults(results);

	// Flat list of all results for keyboard navigation
	$: flatResults = grouped.flatMap((g) => g.items);

	// --- Search ---

	function handleInput(): void {
		if (debounceTimer) clearTimeout(debounceTimer);
		activeIndex = -1;

		if (!query.trim()) {
			results = [];
			searched = false;
			loading = false;
			return;
		}

		loading = true;
		debounceTimer = setTimeout(async () => {
			try {
				const response = await searchPm({ query: query.trim(), limit: 50 });
				results = response.results;
				searched = true;
			} catch {
				results = [];
				searched = true;
			} finally {
				loading = false;
			}
		}, 300);
	}

	function clearSearch(): void {
		query = '';
		results = [];
		searched = false;
		activeIndex = -1;
		loading = false;
		if (debounceTimer) clearTimeout(debounceTimer);
		if (inputEl) inputEl.focus();
	}

	function selectResult(item: PmSearchResultItem): void {
		dispatch('select', { entityType: item.entityType, id: item.id });
	}

	// --- Keyboard Navigation ---

	function handleKeydown(e: KeyboardEvent): void {
		if (flatResults.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				activeIndex = activeIndex < flatResults.length - 1 ? activeIndex + 1 : 0;
				scrollActiveIntoView();
				break;
			case 'ArrowUp':
				e.preventDefault();
				activeIndex = activeIndex > 0 ? activeIndex - 1 : flatResults.length - 1;
				scrollActiveIntoView();
				break;
			case 'Enter':
				e.preventDefault();
				if (activeIndex >= 0 && activeIndex < flatResults.length) {
					selectResult(flatResults[activeIndex]);
				}
				break;
			case 'Escape':
				if (query) {
					e.preventDefault();
					clearSearch();
				}
				break;
		}
	}

	function scrollActiveIntoView(): void {
		requestAnimationFrame(() => {
			const el = document.querySelector('[data-search-active="true"]');
			if (el) el.scrollIntoView({ block: 'nearest' });
		});
	}

	// Track cumulative index for rendering
	function getFlatIndex(group: ResultGroup, itemIndex: number): number {
		let offset = 0;
		for (const g of grouped) {
			if (g === group) return offset + itemIndex;
			offset += g.items.length;
		}
		return -1;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Search Input -->
	<div class="border-b border-slate-700 px-4 py-3">
		<div class="relative">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
			</div>
			<input
				bind:this={inputEl}
				bind:value={query}
				on:input={handleInput}
				on:keydown={handleKeydown}
				type="text"
				placeholder="Search projects, tasks, comments..."
				class="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 pl-10 pr-8 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
			{#if query}
				<button
					on:click={clearSearch}
					class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
					title="Clear search"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			{/if}
		</div>
		{#if query}
			<p class="mt-1.5 text-xs text-slate-500">
				{#if loading}
					Searching...
				{:else if searched}
					{flatResults.length} result{flatResults.length !== 1 ? 's' : ''}
					{#if flatResults.length > 0}
						— use arrow keys to navigate, Enter to select
					{/if}
				{/if}
			</p>
		{/if}
	</div>

	<!-- Results -->
	<div class="flex-1 overflow-y-auto">
		{#if loading && !searched}
			<div class="flex items-center justify-center p-8">
				<div class="flex items-center space-x-2 text-slate-400">
					<svg class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					<span class="text-sm">Searching...</span>
				</div>
			</div>
		{:else if searched && flatResults.length === 0}
			<div class="flex flex-col items-center justify-center p-8">
				<svg
					class="mb-3 h-10 w-10 text-slate-600"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<p class="text-sm font-medium text-slate-400">No results found</p>
				<p class="mt-1 text-xs text-slate-500">Try different keywords or check spelling</p>
			</div>
		{:else if grouped.length > 0}
			{#each grouped as group (group.entityType)}
				<div class="border-b border-slate-700/50 last:border-b-0">
					<!-- Group Header -->
					<div class="sticky top-0 bg-slate-900/95 px-4 py-2">
						<div class="flex items-center space-x-2">
							<svg
								class="h-3.5 w-3.5 text-slate-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d={entityTypeIcon(group.entityType)}
								/>
							</svg>
							<span class="text-xs font-semibold uppercase tracking-wider text-slate-500">
								{entityTypeLabel(group.entityType)}
							</span>
							<span class="text-xs text-slate-600">({group.items.length})</span>
						</div>
					</div>

					<!-- Group Items -->
					<div>
						{#each group.items as item, i (item.id)}
							{@const flatIdx = getFlatIndex(group, i)}
							{@const ctx = resultContext(item)}
							<button
								on:click={() => selectResult(item)}
								data-search-active={flatIdx === activeIndex ? 'true' : 'false'}
								class="flex w-full items-start px-4 py-2.5 text-left transition-colors
									{flatIdx === activeIndex ? 'bg-blue-600/20 text-slate-100' : 'text-slate-300 hover:bg-slate-800'}"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">
										{item.title}
									</p>
									{#if ctx}
										<p class="mt-0.5 truncate text-xs text-slate-500">
											{ctx}
										</p>
									{/if}
								</div>
								<div class="ml-3 flex-shrink-0">
									<span
										class="inline-block rounded bg-slate-700/50 px-1.5 py-0.5 text-xs text-slate-500"
									>
										{item.entityType}
									</span>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		{:else if !query}
			<div class="flex flex-col items-center justify-center p-8">
				<svg
					class="mb-3 h-10 w-10 text-slate-600"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<p class="text-sm text-slate-400">Search across all PM entities</p>
				<p class="mt-1 text-xs text-slate-500">Find projects, tasks, and comments by keyword</p>
			</div>
		{/if}
	</div>
</div>
