<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { CronRun } from '$lib/gateway/types';
	import { cronRuns, loadCronRuns } from '$lib/stores';
	import { formatFullTimestamp } from '$lib/utils/time';

	export let jobId: string;
	export let now: number;

	let loading = false;
	let errorMsg = '';
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	function formatDuration(
		startedAt: number,
		completedAt: number | undefined,
		currentTime: number
	): string {
		const end = completedAt ?? currentTime;
		const ms = end - startedAt;
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		const mins = Math.floor(ms / 60000);
		const secs = Math.floor((ms % 60000) / 1000);
		return `${mins}m ${secs}s`;
	}

	function statusClass(status: CronRun['status']): string {
		if (status === 'success') return 'bg-green-600/20 text-green-400';
		if (status === 'error') return 'bg-red-600/20 text-red-400';
		return 'bg-blue-600/20 text-blue-400';
	}

	async function loadRuns(id: string): Promise<void> {
		loading = true;
		errorMsg = '';
		try {
			await loadCronRuns(id);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to load run history';
		} finally {
			loading = false;
		}
	}

	function updatePolling(runs: CronRun[]): void {
		const hasRunning = runs.some((r) => r.status === 'running');
		if (hasRunning && !pollInterval) {
			pollInterval = setInterval(() => {
				loadCronRuns(jobId).catch(() => {});
			}, 30000);
		} else if (!hasRunning && pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	$: if (jobId) {
		loadRuns(jobId);
	}

	$: updatePolling($cronRuns);

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	});
</script>

{#if loading}
	<div class="flex items-center justify-center p-6">
		<p class="text-sm text-slate-400">Loading run history...</p>
	</div>
{:else if errorMsg}
	<div class="p-6">
		<p class="text-sm text-red-400">{errorMsg}</p>
	</div>
{:else if $cronRuns.length === 0}
	<div class="flex items-center justify-center p-6">
		<p class="text-sm text-slate-400">No run history for this job.</p>
	</div>
{:else}
	<table class="w-full text-left text-sm">
		<thead>
			<tr class="border-b border-slate-700 text-xs uppercase text-slate-400">
				<th class="px-4 py-3 font-medium">Started At</th>
				<th class="px-4 py-3 font-medium">Duration</th>
				<th class="px-4 py-3 font-medium">Status</th>
				<th class="px-4 py-3 font-medium">Output</th>
			</tr>
		</thead>
		<tbody>
			{#each $cronRuns as run (run.id)}
				<tr class="border-b border-slate-700/50">
					<td class="px-4 py-3 text-slate-300">
						{formatFullTimestamp(run.startedAt)}
					</td>
					<td class="px-4 py-3 text-slate-400">
						{formatDuration(run.startedAt, run.completedAt, now)}
						{#if run.status === 'running'}
							<span class="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400"
							></span>
						{/if}
					</td>
					<td class="px-4 py-3">
						<span
							class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium {statusClass(
								run.status
							)}"
						>
							{run.status}
						</span>
					</td>
					<td class="px-4 py-3">
						{#if run.output}
							<details>
								<summary
									class="cursor-pointer text-xs text-slate-400 transition-colors hover:text-slate-200"
								>
									View output
								</summary>
								<pre
									class="mt-2 max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-300">{run.output}</pre>
							</details>
						{:else}
							<span class="text-xs text-slate-500">—</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
