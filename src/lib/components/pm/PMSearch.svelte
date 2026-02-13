<script lang="ts">
	import { searchPM, type PMSearchResult } from '$lib/stores/pm-operations.js';

	interface Props {
		onResultClick?: (result: PMSearchResult) => void;
	}

	let { onResultClick }: Props = $props();

	let query = $state('');
	let typeFilter = $state('');
	let statusFilter = $state('');
	let results = $state<PMSearchResult[]>([]);
	let loading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function handleInput(e: Event) {
		query = (e.target as HTMLInputElement).value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			doSearch();
		}, 300);
	}

	async function doSearch() {
		if (!query.trim()) {
			results = [];
			return;
		}
		loading = true;
		try {
			const options: { entityType?: string; projectId?: number } = {};
			if (typeFilter) options.entityType = typeFilter;
			const res = await searchPM(query, options);
			results = res;
		} finally {
			loading = false;
		}
	}

	function handleTypeFilter(e: Event) {
		typeFilter = (e.target as HTMLSelectElement).value;
		if (query.trim()) doSearch();
	}

	function handleStatusFilter(e: Event) {
		statusFilter = (e.target as HTMLSelectElement).value;
		if (query.trim()) doSearch();
	}

	function handleResultClick(result: PMSearchResult) {
		if (onResultClick) onResultClick(result);
	}

	let grouped = $derived.by(() => {
		const groups: Record<string, PMSearchResult[]> = {};
		for (const r of results) {
			if (!groups[r.entity_type]) groups[r.entity_type] = [];
			groups[r.entity_type].push(r);
		}
		return groups;
	});

	function getEntityIcon(entityType: string): string {
		switch (entityType) {
			case 'project':
				return '📁';
			case 'task':
				return '✓';
			case 'comment':
				return '💬';
			default:
				return '•';
		}
	}

	function getEntityLabel(entityType: string): string {
		switch (entityType) {
			case 'project':
				return 'Projects';
			case 'task':
				return 'Tasks';
			case 'comment':
				return 'Comments';
			default:
				return entityType;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<!-- Search Input -->
	<div class="flex items-center gap-2">
		<div class="relative flex-1">
			<input
				type="text"
				value={query}
				oninput={handleInput}
				placeholder="Search projects, tasks, comments..."
				class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 pl-9 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
			/>
			<svg
				class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				></path>
			</svg>
		</div>
		{#if query.trim() && results.length > 0}
			<div class="rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-400">
				{results.length} result{results.length !== 1 ? 's' : ''}
			</div>
		{/if}
	</div>

	<!-- Filters Row -->
	<div class="flex items-center gap-2">
		<select
			value={typeFilter}
			onchange={handleTypeFilter}
			class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
		>
			<option value="">All Types</option>
			<option value="project">Projects</option>
			<option value="task">Tasks</option>
			<option value="comment">Comments</option>
		</select>
		<select
			value={statusFilter}
			onchange={handleStatusFilter}
			class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
		>
			<option value="">All Status</option>
			<option value="todo">Todo</option>
			<option value="in_progress">In Progress</option>
			<option value="review">Review</option>
			<option value="done">Done</option>
		</select>
	</div>

	<!-- Results Display -->
	<div class="overflow-auto">
		{#if loading}
			<div class="flex items-center justify-center py-8 text-gray-400">
				<div class="flex items-center gap-2">
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span class="text-sm">Searching...</span>
				</div>
			</div>
		{:else if !query.trim()}
			<div class="py-8 text-center text-sm text-gray-500">Type to search</div>
		{:else if results.length === 0}
			<div class="py-8 text-center text-sm text-gray-500">No results found</div>
		{:else}
			<div class="space-y-4">
				{#each Object.entries(grouped) as [entityType, groupResults] (entityType)}
					<div>
						<div class="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
							<span>{getEntityIcon(entityType)}</span>
							<span>{getEntityLabel(entityType)}</span>
							<span class="text-gray-600">({groupResults.length})</span>
						</div>
						<div class="space-y-1">
							{#each groupResults as result (result.entity_id)}
								<button
									type="button"
									onclick={() => handleResultClick(result)}
									class="w-full rounded border border-gray-700 bg-gray-900 p-3 text-left transition-colors hover:border-gray-600 hover:bg-gray-800"
								>
									<div class="flex items-start justify-between gap-3">
										<div class="flex-1">
											<div class="text-sm font-medium text-white">{result.title}</div>
											<div class="mt-1 text-xs text-gray-400">{result.snippet}</div>
										</div>
										<div class="flex items-center gap-2">
											<div class="h-1 w-16 overflow-hidden rounded-full bg-gray-700">
												<div
													class="h-full bg-blue-500"
													style="width: {Math.round(result.rank * 100)}%"
												></div>
											</div>
											<span class="text-xs text-gray-500">{Math.round(result.rank * 100)}%</span>
										</div>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
