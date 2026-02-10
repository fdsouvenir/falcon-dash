<script lang="ts">
	import {
		sortedEntries,
		currentPath,
		breadcrumbs,
		isLoading,
		fileError,
		fileSearchQuery,
		loadDirectory,
		navigateUp,
		setSortField,
		sortField,
		sortDirection,
		type FileEntry,
		type SortField
	} from '$lib/stores/files.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';

	let entries = $state<FileEntry[]>([]);
	let path = $state('');
	let crumbs = $state<Array<{ name: string; path: string }>>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let query = $state('');
	let currentSort = $state<SortField>('name');
	let currentDirection = $state<'asc' | 'desc'>('asc');

	$effect(() => {
		const u = sortedEntries.subscribe((v) => {
			entries = v;
		});
		return u;
	});
	$effect(() => {
		const u = currentPath.subscribe((v) => {
			path = v;
		});
		return u;
	});
	$effect(() => {
		const u = breadcrumbs.subscribe((v) => {
			crumbs = v;
		});
		return u;
	});
	$effect(() => {
		const u = isLoading.subscribe((v) => {
			loading = v;
		});
		return u;
	});
	$effect(() => {
		const u = fileError.subscribe((v) => {
			error = v;
		});
		return u;
	});
	$effect(() => {
		const u = sortField.subscribe((v) => {
			currentSort = v;
		});
		return u;
	});
	$effect(() => {
		const u = sortDirection.subscribe((v) => {
			currentDirection = v;
		});
		return u;
	});

	// Load root on mount
	$effect(() => {
		loadDirectory('');
	});

	function handleNavigate(entry: FileEntry) {
		if (entry.type === 'directory') {
			loadDirectory(entry.path);
		}
	}

	function handleSearch(e: Event) {
		const input = e.target as HTMLInputElement;
		query = input.value;
		fileSearchQuery.set(input.value);
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '—';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	function getIcon(entry: FileEntry): string {
		if (entry.type === 'directory') return '📁';
		const ext = entry.extension?.toLowerCase();
		if (['.md', '.mdx'].includes(ext ?? '')) return '📝';
		if (['.ts', '.js', '.py', '.go', '.rs', '.svelte', '.vue'].includes(ext ?? '')) return '💻';
		if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext ?? '')) return '🖼️';
		if (['.pdf'].includes(ext ?? '')) return '📄';
		if (['.json', '.yaml', '.yml', '.toml'].includes(ext ?? '')) return '⚙️';
		return '📄';
	}

	function sortIndicator(field: SortField): string {
		if (currentSort !== field) return '';
		return currentDirection === 'asc' ? ' ↑' : ' ↓';
	}
</script>

<div class="flex h-full flex-col">
	<!-- Breadcrumbs -->
	<div class="flex items-center gap-1 border-b border-gray-800 px-4 py-2">
		{#each crumbs as crumb, i (crumb.path)}
			{#if i > 0}
				<span class="text-xs text-gray-600">/</span>
			{/if}
			<button
				onclick={() => loadDirectory(crumb.path)}
				class="text-xs text-gray-400 transition-colors hover:text-white {i === crumbs.length - 1
					? 'font-medium text-white'
					: ''}"
			>
				{crumb.name}
			</button>
		{/each}
	</div>

	<!-- Search and toolbar -->
	<div class="flex items-center gap-2 border-b border-gray-800 px-4 py-2">
		<input
			type="text"
			value={query}
			oninput={handleSearch}
			placeholder="Search files..."
			class="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
		/>
	</div>

	<!-- Column headers -->
	<div
		class="grid grid-cols-[1fr_120px_100px] gap-2 border-b border-gray-800 px-4 py-1.5 text-xs text-gray-500"
	>
		<button onclick={() => setSortField('name')} class="text-left hover:text-white">
			Name{sortIndicator('name')}
		</button>
		<button onclick={() => setSortField('modified')} class="text-left hover:text-white">
			Modified{sortIndicator('modified')}
		</button>
		<button onclick={() => setSortField('size')} class="text-right hover:text-white">
			Size{sortIndicator('size')}
		</button>
	</div>

	<!-- Entries -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="py-8 text-center text-xs text-gray-500">Loading...</div>
		{:else if error}
			<div class="py-8 text-center text-xs text-red-400">{error}</div>
		{:else}
			<!-- Back entry -->
			{#if path}
				<button
					onclick={navigateUp}
					class="grid w-full grid-cols-[1fr_120px_100px] gap-2 px-4 py-1.5 text-left text-xs text-gray-400 transition-colors hover:bg-gray-800"
				>
					<span>📁 ..</span>
					<span></span>
					<span></span>
				</button>
			{/if}

			{#each entries as entry (entry.path)}
				<button
					onclick={() => handleNavigate(entry)}
					class="grid w-full grid-cols-[1fr_120px_100px] gap-2 px-4 py-1.5 text-left text-xs transition-colors hover:bg-gray-800 {entry.type ===
					'directory'
						? 'text-white'
						: 'text-gray-300'}"
				>
					<span class="truncate">{getIcon(entry)} {entry.name}</span>
					<span class="text-gray-500" title={new Date(entry.modified).toLocaleString()}>
						{formatRelativeTime(entry.modified)}
					</span>
					<span class="text-right text-gray-500">{formatSize(entry.size)}</span>
				</button>
			{/each}

			{#if entries.length === 0 && !path}
				<div class="py-8 text-center text-xs text-gray-500">Empty folder</div>
			{/if}
		{/if}
	</div>
</div>
