<script lang="ts">
	import {
		cronRuns,
		cronRunsLoading,
		loadCronRuns,
		clearCronRuns,
		type CronRun,
		type CronJob
	} from '$lib/stores/cron.js';
	import { formatRelativeTime } from '$lib/utils/time.js';
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
	<div class="border-b border-surface-border px-4 py-3">
		<div class="flex items-center gap-2">
			<button
				onclick={onclose}
				class="text-status-muted hover:text-white"
				aria-label="Back to jobs"
			>
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
				<h2 class="text-[length:var(--text-card-title)] font-medium text-white">
					Run History: {job.name}
				</h2>
				{#if humanSchedule && humanSchedule !== job.schedule}
					<div class="mt-0.5 text-[length:var(--text-badge)] text-status-muted">
						{humanSchedule}
						<span class="text-status-muted/50">({job.schedule})</span>
					</div>
				{:else}
					<div class="mt-0.5 text-[length:var(--text-badge)] text-status-muted">{job.schedule}</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content -->
	{#if loading}
		<div class="flex flex-1 items-center justify-center text-[length:var(--text-body)] text-status-muted">
			Loading history...
		</div>
	{:else if runs.length === 0}
		<div class="flex flex-1 items-center justify-center text-[length:var(--text-body)] text-status-muted">
			No run history yet
		</div>
	{:else}
		<!-- Column headers -->
		<div
			class="grid grid-cols-[160px_80px_80px_1fr] gap-2 border-b border-surface-border px-4 py-2 text-[length:var(--text-label)] font-medium text-status-muted"
		>
			<span>Timestamp</span>
			<span>Status</span>
			<span>Duration</span>
			<span>Output</span>
		</div>

		<!-- Run rows -->
		<div class="flex-1 overflow-y-auto">
			{#each runs as run (run.id)}
				<div class="border-b border-surface-border/40">
					<button
						onclick={() => toggleExpand(run.id)}
						class="grid w-full grid-cols-[160px_80px_80px_1fr] gap-2 px-4 py-2 text-left text-[length:var(--text-body)] transition-colors hover:bg-surface-3"
					>
						<span class="text-status-muted" title={formatTimestamp(run.timestamp)}>
							{formatRelativeTime(run.timestamp)}
						</span>
						<span>
							{#if run.status === 'success'}
								<span
									class="rounded-full bg-status-active-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold text-status-active"
								>
									Success
								</span>
							{:else}
								<span
									class="rounded-full bg-status-danger-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold text-status-danger"
								>
									Error
								</span>
							{/if}
						</span>
						<span class="text-status-muted">{formatDuration(run.durationMs)}</span>
						<span class="truncate text-status-muted">
							{run.output ? run.output.split('\n')[0] : '—'}
							{#if run.output && run.output.includes('\n')}
								<span class="ml-1 text-status-muted/50">
									{expandedRunId === run.id ? '▼' : '▶'}
								</span>
							{/if}
						</span>
					</button>

					<!-- Expanded output -->
					{#if expandedRunId === run.id && run.output}
						<div class="border-t border-surface-border/40 bg-surface-0 px-4 py-3">
							<div class="flex items-center justify-between pb-2">
								<span
									class="text-[length:var(--text-badge)] font-medium uppercase tracking-wider text-status-muted"
								>
									Full Output
								</span>
								<span class="text-[length:var(--text-badge)] text-status-muted/60">
									{formatTimestamp(run.timestamp)}
								</span>
							</div>
							<pre
								class="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-surface-1 p-3 font-mono text-[length:var(--text-mono)] text-white/80">{run.output}</pre>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
