<script lang="ts">
	import OpsHeader from '$lib/components/ops/OpsHeader.svelte';
	import ProcessList from '$lib/components/ops/ProcessList.svelte';
	import ProcessDetail from '$lib/components/ops/ProcessDetail.svelte';
	import ActivityFeed from '$lib/components/ops/ActivityFeed.svelte';
	import {
		entries,
		currentSessionId,
		sessions,
		autoRefresh,
		loadSessions,
		loadEntries,
		startStream,
		startAutoRefresh,
		stopStream,
		stopAutoRefresh
	} from '$lib/stores/ops.js';

	type Tab = 'processes' | 'activity';
	let activeTab = $state<Tab>('processes');
	let selectedProcessId = $state<string | null>(null);

	const allEntries = $derived($entries);
	const selectedEntry = $derived(
		selectedProcessId ? (allEntries.find((e) => e.id === selectedProcessId) ?? null) : null
	);

	// On mount: load sessions and auto-select the most recent one
	$effect(() => {
		loadSessions().then(async () => {
			const sess = $sessions;
			if (sess.length > 0 && !$currentSessionId) {
				const id = sess[0].sessionId;
				currentSessionId.set(id);
				await loadEntries(id);
				if ($autoRefresh) {
					startStream(id);
					startAutoRefresh();
				}
			}
		});

		return () => {
			stopStream();
			stopAutoRefresh();
		};
	});
</script>

<svelte:head>
	<title>Ops Observer - Falcon Dash</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden bg-surface-0 text-white">
	<!-- Top bar -->
	<OpsHeader entries={allEntries} />

	<!-- Tab bar -->
	<div class="flex border-b border-surface-border bg-surface-1 px-[var(--space-card-padding)]">
		<button
			onclick={() => (activeTab = 'processes')}
			class="flex items-center gap-2 border-b-2 px-3 py-2.5 text-[length:var(--text-body)] font-medium transition-colors {activeTab === 'processes'
				? 'border-status-info text-white'
				: 'border-transparent text-status-muted hover:text-white'}"
		>
			<!-- Terminal icon -->
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
			Processes
		</button>
		<button
			onclick={() => (activeTab = 'activity')}
			class="flex items-center gap-2 border-b-2 px-3 py-2.5 text-[length:var(--text-body)] font-medium transition-colors {activeTab === 'activity'
				? 'border-status-info text-white'
				: 'border-transparent text-status-muted hover:text-white'}"
		>
			<!-- Activity icon -->
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
			</svg>
			Activity
		</button>
	</div>

	<!-- Content area -->
	<div class="flex min-h-0 flex-1">
		{#if activeTab === 'processes'}
			<!-- Master-detail split: list flex-[3], detail flex-[2] -->
			<div class="min-w-0 flex-[3] overflow-hidden">
				<ProcessList
					entries={allEntries}
					selectedId={selectedProcessId}
					onselect={(id) => (selectedProcessId = id)}
				/>
			</div>
			<ProcessDetail entry={selectedEntry} />
		{:else}
			<div class="flex-1 overflow-hidden">
				<ActivityFeed entries={allEntries} />
			</div>
		{/if}
	</div>
</div>
