<script lang="ts">
	import {
		cronRuns,
		cronRunsLoading,
		loadCronRuns,
		clearCronRuns,
		type CronRun,
		type CronJob
	} from '$lib/stores/cron.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';
	import { describeCron } from '$lib/cron-utils.js';

	interface Props {
		job: CronJob;
		onclose: () => void;
	}

	let { job, onclose }: Props = $props();

	let runs = $state<CronRun[]>([]);
	let loading = $state(false);
	let expandedRunId = $state<string | null>(null);

	let humanSchedule = $derived(job.scheduleType === 'cron' ? describeCron(job.schedule) : null);

	$effect(() => {
		const u = cronRuns.subscribe((v) => {
			runs = v;
		});
		return u;
	});
	$effect(() => {
		const u = cronRunsLoading.subscribe((v) => {
			loading = v;
		});
		return u;
	});

	// Load runs on mount
	$effect(() => {
		loadCronRuns(job.id);
		return () => {
			clearCronRuns();
		};
	});

	function toggleExpand(runId: string) {
		expandedRunId = expandedRunId === runId ? null : runId;
	}

	function formatTimestamp(ts: number): string {
		return new Date(ts).toLocaleString();
	}

	function formatDuration(ms: number | undefined): string {
		if (!ms) return '—';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-gray-800 px-4 py-3">
		<div class="flex items-center gap-2">
			<button onclick={onclose} class="text-gray-400 hover:text-white" aria-label="Back to jobs">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
			<div>
				<h2 class="text-sm font-medium text-white">Run History: {job.name}</h2>
				{#if humanSchedule && humanSchedule !== job.schedule}
					<div class="mt-0.5 text-[10px] text-gray-500">
						{humanSchedule}
						<span class="text-gray-600">({job.schedule})</span>
					</div>
				{:else}
					<div class="mt-0.5 text-[10px] text-gray-500">{job.schedule}</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content -->
	{#if loading}
		<div class="flex flex-1 items-center justify-center text-sm text-gray-500">
			Loading history...
		</div>
	{:else if runs.length === 0}
		<div class="flex flex-1 items-center justify-center text-sm text-gray-500">
			No run history yet
		</div>
	{:else}
		<!-- Column headers -->
		<div
			class="grid grid-cols-[160px_80px_80px_1fr] gap-2 border-b border-gray-800 px-4 py-2 text-xs text-gray-500"
		>
			<span>Timestamp</span>
			<span>Status</span>
			<span>Duration</span>
			<span>Output</span>
		</div>

		<!-- Run rows -->
		<div class="flex-1 overflow-y-auto">
			{#each runs as run (run.id)}
				<div class="border-b border-gray-800/50">
					<button
						onclick={() => toggleExpand(run.id)}
						class="grid w-full grid-cols-[160px_80px_80px_1fr] gap-2 px-4 py-2 text-left text-xs transition-colors hover:bg-gray-800"
					>
						<span class="text-gray-400" title={formatTimestamp(run.timestamp)}>
							{formatRelativeTime(run.timestamp)}
						</span>
						<span>
							{#if run.status === 'success'}
								<span
									class="rounded-full bg-green-600/50 px-2 py-0.5 text-[10px] font-medium text-green-300"
								>
									Success
								</span>
							{:else}
								<span
									class="rounded-full bg-red-600/50 px-2 py-0.5 text-[10px] font-medium text-red-300"
								>
									Error
								</span>
							{/if}
						</span>
						<span class="text-gray-400">{formatDuration(run.durationMs)}</span>
						<span class="truncate text-gray-400">
							{run.output ? run.output.split('\n')[0] : '—'}
							{#if run.output && run.output.includes('\n')}
								<span class="ml-1 text-gray-600">
									{expandedRunId === run.id ? '▼' : '▶'}
								</span>
							{/if}
						</span>
					</button>

					<!-- Expanded output -->
					{#if expandedRunId === run.id && run.output}
						<div class="border-t border-gray-800/50 bg-gray-950 px-4 py-3">
							<div class="flex items-center justify-between pb-2">
								<span class="text-[10px] font-medium uppercase tracking-wide text-gray-500"
									>Full Output</span
								>
								<span class="text-[10px] text-gray-600">{formatTimestamp(run.timestamp)}</span>
							</div>
							<pre
								class="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-3 font-mono text-xs text-gray-300">{run.output}</pre>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
