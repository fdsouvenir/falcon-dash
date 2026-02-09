<script lang="ts">
	import type { CronJob } from '$lib/gateway/types';
	import { formatRelativeTime } from '$lib/utils/time';

	interface Props {
		jobs: CronJob[];
		now: number;
		selectedJobId?: string | null;
		onedit?: (data: { job: CronJob }) => void;
		ondelete?: (data: { job: CronJob }) => void;
		onrun?: (data: { job: CronJob }) => void;
		ontoggle?: (data: { job: CronJob }) => void;
		onselect?: (data: { job: CronJob }) => void;
	}

	let {
		jobs,
		now,
		selectedJobId = null,
		onedit,
		ondelete,
		onrun,
		ontoggle,
		onselect
	}: Props = $props();

	function scheduleLabel(job: CronJob): string {
		if (job.scheduleType === 'interval') return `Every ${job.schedule}s`;
		if (job.scheduleType === 'oneshot') return `Once: ${job.schedule}`;
		return job.schedule;
	}
</script>

{#if jobs.length === 0}
	<div class="flex items-center justify-center p-8">
		<p class="text-sm text-slate-400">No cron jobs configured.</p>
	</div>
{:else}
	<table class="w-full text-left text-sm">
		<thead>
			<tr class="border-b border-slate-700 text-xs uppercase text-slate-400">
				<th class="px-4 py-3 font-medium">Name</th>
				<th class="px-4 py-3 font-medium">Schedule</th>
				<th class="px-4 py-3 font-medium">Next Run</th>
				<th class="px-4 py-3 font-medium">Last Run</th>
				<th class="px-4 py-3 font-medium">Status</th>
				<th class="px-4 py-3 font-medium">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each jobs as job (job.id)}
				<tr
					class="group cursor-pointer border-b border-slate-700/50 transition-colors {selectedJobId ===
					job.id
						? 'bg-slate-800/80'
						: 'hover:bg-slate-800/50'}"
					onclick={() => onselect?.({ job })}
				>
					<td class="px-4 py-3 font-medium text-slate-200">{job.name}</td>
					<td class="px-4 py-3 text-slate-400">
						<span
							class="mr-1.5 inline-block rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300"
						>
							{job.scheduleType}
						</span>
						{scheduleLabel(job)}
					</td>
					<td class="px-4 py-3 text-slate-400">
						{#if job.nextRun}
							<span title={new Date(job.nextRun).toLocaleString()}>
								{formatRelativeTime(job.nextRun, now)}
							</span>
						{:else}
							<span class="text-slate-500">—</span>
						{/if}
					</td>
					<td class="px-4 py-3 text-slate-400">
						{#if job.lastRun}
							<span title={new Date(job.lastRun).toLocaleString()}>
								{formatRelativeTime(job.lastRun, now)}
							</span>
						{:else}
							<span class="text-slate-500">—</span>
						{/if}
					</td>
					<td class="px-4 py-3">
						<button
							onclick={(e) => {
								e.stopPropagation();
								ontoggle?.({ job });
							}}
							aria-label="{job.enabled ? 'Disable' : 'Enable'} {job.name}"
							class="rounded-full focus-visible:ring-2 focus-visible:ring-blue-500 px-2.5 py-0.5 text-xs font-medium transition-colors {job.enabled
								? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
								: 'bg-slate-700 text-slate-400 hover:bg-slate-600'}"
						>
							{job.enabled ? 'Enabled' : 'Disabled'}
						</button>
					</td>
					<td class="px-4 py-3">
						<div
							class="flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100"
						>
							<button
								onclick={(e) => {
									e.stopPropagation();
									onedit?.({ job });
								}}
								aria-label="Edit {job.name}"
								class="rounded p-1 text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
								title="Edit"
							>
								<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
									<path
										d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.463 11.098l-.59 2.063 2.063-.59 8.61-8.61a.25.25 0 000-.354L12.427 2.487z"
									/>
								</svg>
							</button>
							<button
								onclick={(e) => {
									e.stopPropagation();
									onrun?.({ job });
								}}
								aria-label="Run {job.name} now"
								class="rounded p-1 text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors hover:bg-slate-700 hover:text-blue-400"
								title="Run Now"
							>
								<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
									<path d="M4 2l10 6-10 6V2z" />
								</svg>
							</button>
							<button
								onclick={(e) => {
									e.stopPropagation();
									ondelete?.({ job });
								}}
								aria-label="Delete {job.name}"
								class="rounded p-1 text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors hover:bg-slate-700 hover:text-red-400"
								title="Delete"
							>
								<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
									<path
										d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19a1.75 1.75 0 001.741-1.575l.66-6.6a.75.75 0 00-1.492-.15l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"
									/>
								</svg>
							</button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
