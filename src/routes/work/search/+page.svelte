<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import {
		formatDateTime,
		formatStatus,
		itemDisplayId,
		pathForType,
		statusTone,
		typeConfigs,
		type WorkItem
	} from '$lib/work/work-ui.js';
	import { Search } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let items = $state<WorkItem[]>([]);

	const query = $derived((page.url.searchParams.get('q') ?? '').trim());
	const normalizedQuery = $derived(query.toLowerCase());
	const results = $derived.by(() => {
		if (!normalizedQuery) return [];
		return items
			.filter((item) => item.status !== 'archived')
			.map((item) => ({ item, match: matchText(item, normalizedQuery) }))
			.filter((entry) => entry.match)
			.sort((a, b) => b.item.last_activity_at - a.item.last_activity_at);
	});

	onMount(() => {
		void loadItems();
	});

	async function loadItems() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/work/items?limit=500&includeClosed=true');
			if (!response.ok) throw new Error(`Items request failed: ${response.status}`);
			const json = await response.json();
			items = json.items ?? [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to search Work';
		} finally {
			loading = false;
		}
	}

	function routeFor(item: WorkItem): `/work/${string}/${string}` {
		return `/work/${pathForType(item.type)}/${item.id}`;
	}

	function typeLabel(item: WorkItem): string {
		return typeConfigs.find((config) => config.type === item.type)?.singular ?? item.type;
	}

	function matchText(item: WorkItem, needle: string): string {
		const fields = [
			['Title', item.title],
			['Description', item.description],
			['Notes', item.body],
			['Next action', item.next_action],
			['Result', item.result],
			['Owner', item.owner],
			['Status', formatStatus(item.status)],
			['Type', typeLabel(item)],
			['Id', `${item.id}`]
		] as const;

		const match = fields.find(([, value]) => value?.toLowerCase().includes(needle));
		return match ? match[0] : '';
	}
</script>

<svelte:head>
	<title>Search Work - Falcon Dash</title>
</svelte:head>

<FalconModuleShell
	active="Work"
	eyebrow="Falcon Dash / Work"
	title="Search Work"
	description="Find existing agent-managed Work records without creating new items."
>
	<div class="min-h-full bg-surface-0 px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
		<div class="mx-auto flex max-w-[1500px] flex-col gap-3">
			<section
				class="overflow-hidden rounded-lg border border-outline-variant/65 bg-surface-1 shadow-[0_18px_44px_rgba(0,0,0,0.16)]"
			>
				<div class="border-b border-outline-variant/45 bg-surface-2/30 px-4 py-3">
					<div class="flex items-center gap-2">
						<Search class="h-4 w-4 text-primary" />
						<h2 class="text-lg font-semibold text-on-surface">
							{query ? `Results for "${query}"` : 'Search Work'}
						</h2>
					</div>
					<p class="mt-1 text-sm leading-5 text-on-surface-variant">
						Search reads Work titles, descriptions, notes, next actions, results, status, and ids.
					</p>
				</div>

				{#if loading}
					<p class="p-4 text-sm text-on-surface-variant">Loading Work...</p>
				{:else if error}
					<p
						class="border-t border-status-danger/35 bg-status-danger-bg p-4 text-sm text-status-danger"
					>
						{error}
					</p>
				{:else if !query}
					<p class="p-4 text-sm text-on-surface-variant">
						Type in the top Work search field and press Enter.
					</p>
				{:else if results.length === 0}
					<p class="p-4 text-sm text-on-surface-variant">No Work records matched this search.</p>
				{:else}
					<div
						class="hidden border-b border-outline-variant/45 bg-surface-0/35 px-4 py-2 text-xs font-semibold text-on-surface-variant lg:grid lg:grid-cols-[minmax(18rem,1fr)_8rem_9rem_8rem]"
					>
						<span>Work item</span>
						<span>Matched</span>
						<span>Status</span>
						<span>Updated</span>
					</div>
					<div class="divide-y divide-outline-variant/35" data-testid="work-search-results">
						{#each results as { item, match } (item.id)}
							<a
								href={resolve(routeFor(item))}
								class="grid gap-3 px-4 py-4 transition hover:bg-surface-2/55 lg:grid-cols-[minmax(18rem,1fr)_8rem_9rem_8rem] lg:items-center"
							>
								<div class="min-w-0">
									<div class="flex min-w-0 flex-wrap items-center gap-2">
										<span class="truncate font-semibold text-on-surface">{item.title}</span>
										<span class="text-xs text-on-surface-variant">{itemDisplayId(item)}</span>
									</div>
									<p class="mt-1 line-clamp-1 text-sm leading-5 text-on-surface-variant">
										{item.description ?? item.next_action ?? item.body ?? 'No summary written yet'}
									</p>
								</div>
								<div>
									<p class="text-xs text-on-surface-variant lg:hidden">Matched</p>
									<p class="mt-1 text-sm font-semibold text-on-surface">{match}</p>
								</div>
								<div>
									<p class="text-xs text-on-surface-variant lg:hidden">Status</p>
									<p class="mt-1 text-sm font-semibold {statusTone(item.status)}">
										{formatStatus(item.status)}
									</p>
								</div>
								<div>
									<p class="text-xs text-on-surface-variant lg:hidden">Updated</p>
									<p class="mt-1 text-xs leading-5 text-on-surface-variant">
										{formatDateTime(item.last_activity_at)}
									</p>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	</div>
</FalconModuleShell>
