<script lang="ts">
	interface Props {
		sessionToken: string;
		onselect?: (path: string) => void;
	}

	let { sessionToken, onselect }: Props = $props();

	interface PasswordEntry {
		title: string;
		username: string;
		url: string;
		path: string;
		group?: string;
	}

	type SortField = 'title' | 'modified';
	type SortDir = 'asc' | 'desc';

	let entries = $state<PasswordEntry[]>([]);
	let filteredEntries = $state<PasswordEntry[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let currentGroup = $state('');
	let groups = $state<string[]>([]);
	let sortField = $state<SortField>('title');
	let sortDir = $state<SortDir>('asc');

	$effect(() => {
		loadEntries();
	});

	$effect(() => {
		filterAndSort();
	});

	async function loadEntries() {
		loading = true;
		error = null;
		try {
			const res = await fetch('/api/passwords', {
				headers: { 'x-session-token': sessionToken }
			});
			if (!res.ok) throw new Error('Failed to load entries');
			const data = await res.json();
			entries = data.entries ?? [];

			// Extract unique groups
			const groupSet = new Set<string>();
			for (const e of entries) {
				if (e.group) groupSet.add(e.group);
			}
			groups = Array.from(groupSet).sort();
		} catch (err) {
			error = (err as Error).message;
			entries = [];
		} finally {
			loading = false;
		}
	}

	function filterAndSort() {
		let list = entries;

		// Filter by current group
		if (currentGroup) {
			list = list.filter((e) => e.group === currentGroup || e.path.startsWith(currentGroup + '/'));
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(e) =>
					e.title.toLowerCase().includes(q) ||
					e.username.toLowerCase().includes(q) ||
					e.url.toLowerCase().includes(q)
			);
		}

		// Sort
		list = [...list].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'title') {
				cmp = a.title.localeCompare(b.title);
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});

		filteredEntries = list;
	}

	function handleSearch(e: Event) {
		searchQuery = (e.target as HTMLInputElement).value;
	}

	function toggleSort(field: SortField) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = 'asc';
		}
	}

	function navigateToGroup(group: string) {
		currentGroup = group;
	}

	function navigateUp() {
		if (!currentGroup) return;
		const parts = currentGroup.split('/').filter(Boolean);
		parts.pop();
		currentGroup = parts.join('/');
	}

	function sortIndicator(field: SortField): string {
		if (sortField !== field) return '';
		return sortDir === 'asc' ? ' ↑' : ' ↓';
	}

	function handleSelect(entry: PasswordEntry) {
		onselect?.(entry.path);
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
		<h2 class="text-sm font-medium text-white">Passwords</h2>
	</div>

	<!-- Group breadcrumbs -->
	{#if currentGroup}
		<div class="flex items-center gap-1 border-b border-gray-800 px-4 py-2">
			<button
				onclick={() => {
					currentGroup = '';
				}}
				class="text-xs text-gray-400 hover:text-white"
			>
				Root
			</button>
			{#each currentGroup.split('/').filter(Boolean) as part, i}
				<span class="text-xs text-gray-600">/</span>
				<button
					onclick={() =>
						navigateToGroup(
							currentGroup
								.split('/')
								.slice(0, i + 1)
								.join('/')
						)}
					class="text-xs text-gray-400 hover:text-white"
				>
					{part}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Search -->
	<div class="border-b border-gray-800 px-4 py-2">
		<input
			type="text"
			value={searchQuery}
			oninput={handleSearch}
			placeholder="Search by title, username, or URL..."
			class="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
		/>
	</div>

	<!-- Groups (show as folder entries) -->
	{#if !searchQuery && groups.length > 0}
		<div class="border-b border-gray-800">
			{#if currentGroup}
				<button
					onclick={navigateUp}
					class="w-full px-4 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-800"
				>
					📁 ..
				</button>
			{/if}
			{#each groups.filter((g) => {
				if (!currentGroup) return !g.includes('/');
				return g.startsWith(currentGroup + '/') && !g
						.substring(currentGroup.length + 1)
						.includes('/');
			}) as group}
				<button
					onclick={() => navigateToGroup(group)}
					class="w-full px-4 py-1.5 text-left text-xs text-white hover:bg-gray-800"
				>
					📁 {group.split('/').pop()}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Column headers -->
	<div
		class="grid grid-cols-[1fr_120px_1fr] gap-2 border-b border-gray-800 px-4 py-1.5 text-xs text-gray-500"
	>
		<button onclick={() => toggleSort('title')} class="text-left hover:text-white">
			Title{sortIndicator('title')}
		</button>
		<span>Username</span>
		<span>URL</span>
	</div>

	<!-- Entries -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="py-8 text-center text-xs text-gray-500">Loading...</div>
		{:else if error}
			<div class="py-8 text-center text-xs text-red-400">{error}</div>
		{:else if filteredEntries.length === 0}
			<div class="py-8 text-center text-xs text-gray-500">
				{searchQuery ? 'No matching entries' : 'No passwords stored'}
			</div>
		{:else}
			{#each filteredEntries as entry (entry.path)}
				<button
					onclick={() => handleSelect(entry)}
					class="grid w-full grid-cols-[1fr_120px_1fr] gap-2 px-4 py-2 text-left text-xs transition-colors hover:bg-gray-800"
				>
					<span class="truncate font-medium text-white">🔑 {entry.title}</span>
					<span class="truncate text-gray-400">{entry.username || '—'}</span>
					<span class="truncate text-gray-500">{entry.url || '—'}</span>
				</button>
			{/each}
		{/if}
	</div>
</div>
