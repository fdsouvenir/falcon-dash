<script lang="ts">
	interface Props {
		sessionToken: string;
		onselect: (path: string) => void;
		onadd: () => void;
		onlock: () => void;
	}

	let { sessionToken, onselect, onadd, onlock }: Props = $props();

	interface PasswordEntry {
		title: string;
		username: string;
		url: string;
		path: string;
		group?: string;
	}

	let entries = $state<PasswordEntry[]>([]);
	let filteredEntries = $state<PasswordEntry[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let currentGroup = $state('');
	let groups = $state<string[]>([]);

	$effect(() => {
		loadEntries();
	});

	$effect(() => {
		filterEntries();
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

			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local computation
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

	function filterEntries() {
		let list = entries;

		if (currentGroup) {
			list = list.filter((e) => e.group === currentGroup || e.path.startsWith(currentGroup + '/'));
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(e) =>
					e.title.toLowerCase().includes(q) ||
					e.username.toLowerCase().includes(q) ||
					e.url.toLowerCase().includes(q)
			);
		}

		list = [...list].sort((a, b) => a.title.localeCompare(b.title));
		filteredEntries = list;
	}

	function handleSearch(e: Event) {
		searchQuery = (e.target as HTMLInputElement).value;
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

	let subGroups = $derived(
		groups.filter((g) => {
			if (!currentGroup) return !g.includes('/');
			return (
				g.startsWith(currentGroup + '/') && !g.substring(currentGroup.length + 1).includes('/')
			);
		})
	);

	let breadcrumbParts = $derived(currentGroup ? currentGroup.split('/').filter(Boolean) : []);
</script>

<div class="flex h-full flex-col bg-gray-950">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
		<h1 class="text-base font-semibold text-white">Passwords</h1>
		<div class="flex gap-2">
			<button
				onclick={onadd}
				class="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm text-white active:bg-blue-700"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add
			</button>
			<button
				onclick={onlock}
				class="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-gray-800 px-3 text-sm text-gray-300 active:bg-gray-700"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
					/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Search -->
	<div class="border-b border-gray-700 px-4 py-2.5">
		<input
			type="text"
			value={searchQuery}
			oninput={handleSearch}
			placeholder="Search passwords..."
			class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
		/>
	</div>

	<!-- Breadcrumbs -->
	{#if currentGroup}
		<div class="flex items-center gap-1 border-b border-gray-700 px-4 py-2.5">
			<button
				onclick={() => {
					currentGroup = '';
				}}
				class="text-sm text-blue-400 active:text-blue-300"
			>
				Root
			</button>
			{#each breadcrumbParts as part, i (i)}
				<span class="text-sm text-gray-600">/</span>
				<button
					onclick={() =>
						navigateToGroup(
							currentGroup
								.split('/')
								.slice(0, i + 1)
								.join('/')
						)}
					class="text-sm text-blue-400 active:text-blue-300"
				>
					{part}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Content -->
	<div class="flex-1 overflow-y-auto pb-[calc(1rem+var(--safe-bottom))]">
		{#if loading}
			<div class="flex items-center justify-center py-12 text-sm text-gray-500">Loading...</div>
		{:else if error}
			<div class="flex items-center justify-center py-12 text-sm text-red-400">{error}</div>
		{:else}
			<!-- Group folders -->
			{#if !searchQuery && subGroups.length > 0}
				<div class="space-y-2 p-4">
					{#if currentGroup}
						<button
							onclick={navigateUp}
							class="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 p-4"
						>
							<svg
								class="h-5 w-5 text-gray-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M11 17l-5-5m0 0l5-5m-5 5h12"
								/>
							</svg>
							<span class="text-sm text-gray-400">..</span>
						</button>
					{/if}
					{#each subGroups as group (group)}
						<button
							onclick={() => navigateToGroup(group)}
							class="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 p-4"
						>
							<svg
								class="h-5 w-5 text-yellow-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
								/>
							</svg>
							<span class="text-sm font-medium text-white">{group.split('/').pop()}</span>
						</button>
					{/each}
				</div>
			{/if}

			<!-- Entries -->
			{#if filteredEntries.length === 0}
				<div class="flex items-center justify-center py-12 text-sm text-gray-500">
					{searchQuery ? 'No matching entries' : 'No passwords stored'}
				</div>
			{:else}
				<div class="space-y-2 p-4">
					{#each filteredEntries as entry (entry.path)}
						<button
							onclick={() => onselect(entry.path)}
							class="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 p-4 text-left active:bg-gray-800"
						>
							<svg
								class="h-5 w-5 shrink-0 text-blue-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
								/>
							</svg>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-white">{entry.title}</p>
								{#if entry.username}
									<p class="truncate text-xs text-gray-400">{entry.username}</p>
								{/if}
							</div>
							<svg
								class="h-4 w-4 shrink-0 text-gray-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
