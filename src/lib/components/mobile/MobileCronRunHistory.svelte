<script lang="ts">
	import {
		cronRuns,
		cronRunsLoading,
		loadCronRuns,
		clearCronRuns,
		type CronJob,
		type CronRun
	} from '$lib/stores/cron.js';
	import { formatRelativeTime } from '$lib/utils/time.js';

	let { job, onback }: { job: CronJob; onback: () => void } = $props();

	let runs = $state<CronRun[]>([]);
	let loading = $state(false);
	let expandedId = $state<string | null>(null);

	$effect(() => {
		const unsub = cronRuns.subscribe((v) => {
			runs = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = cronRunsLoading.subscribe((v) => {
			loading = v;
		});
		return unsub;
	});

	$effect(() => {
		loadCronRuns(job.id);
		return () => clearCronRuns();
	});

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function formatDuration(ms?: number): string {
		if (!ms) return '-';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<div class="flex h-full flex-col bg-gray-950">
	<!-- Header -->
	<header class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
		<button onclick={onback} class="flex min-h-[44px] min-w-[44px] items-center justify-center">
			<svg
				class="h-5 w-5 text-gray-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<h1 class="text-base font-semibold text-white">{job.name} — History</h1>
	</header>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
		{#if loading}
			<div class="flex items-center justify-center py-12 text-gray-500">Loading...</div>
		{:else if runs.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-gray-500">
				<svg
					class="mb-2 h-8 w-8"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
				<span>No runs yet</span>
			</div>
		{:else}
			<div class="space-y-2">
				{#each runs as run (run.id)}
					<button
						onclick={() => toggleExpand(run.id)}
						class="w-full rounded-xl border border-gray-700 bg-gray-900 p-3 text-left"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span
									class="inline-block h-2 w-2 rounded-full {run.status === 'success'
										? 'bg-green-500'
										: 'bg-red-500'}"
								></span>
								<span class="text-sm text-gray-300">
									{formatRelativeTime(run.timestamp)}
								</span>
							</div>
							<div class="flex items-center gap-2 text-xs text-gray-500">
								<span>{formatDuration(run.durationMs)}</span>
								<span
									class="rounded px-1.5 py-0.5 {run.status === 'success'
										? 'bg-green-900/50 text-green-400'
										: 'bg-red-900/50 text-red-400'}"
								>
									{run.status}
								</span>
							</div>
						</div>
						{#if expandedId === run.id && run.output}
							<pre
								class="mt-2 max-h-48 overflow-auto rounded bg-gray-950 p-2 text-xs text-gray-400">{run.output}</pre>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
