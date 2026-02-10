<script lang="ts">
	import {
		cronJobs,
		cronLoading,
		cronError,
		loadCronJobs,
		subscribeToCronEvents,
		unsubscribeFromCronEvents,
		formatSchedule,
		type CronJob
	} from '$lib/stores/cron.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';

	let jobs = $state<CronJob[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const u = cronJobs.subscribe((v) => {
			jobs = v;
		});
		return u;
	});
	$effect(() => {
		const u = cronLoading.subscribe((v) => {
			loading = v;
		});
		return u;
	});
	$effect(() => {
		const u = cronError.subscribe((v) => {
			error = v;
		});
		return u;
	});

	// Load jobs and subscribe to events on mount
	$effect(() => {
		loadCronJobs();
		subscribeToCronEvents();
		return () => {
			unsubscribeFromCronEvents();
		};
	});

	function statusBadge(job: CronJob): { text: string; class: string } {
		if (!job.enabled) return { text: 'Disabled', class: 'bg-gray-600 text-gray-300' };
		if (job.lastStatus === 'error') return { text: 'Error', class: 'bg-red-600/50 text-red-300' };
		return { text: 'Enabled', class: 'bg-green-600/50 text-green-300' };
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
		<h2 class="text-sm font-medium text-white">Scheduled Jobs</h2>
	</div>

	<!-- Content -->
	{#if loading}
		<div class="flex flex-1 items-center justify-center text-sm text-gray-500">Loading jobs...</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center text-sm text-red-400">{error}</div>
	{:else if jobs.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-3 text-gray-500">
			<svg class="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<p class="text-sm">No scheduled jobs yet</p>
			<p class="text-xs text-gray-600">Create a job to automate agent tasks</p>
		</div>
	{:else}
		<!-- Column headers -->
		<div
			class="grid grid-cols-[1fr_140px_100px_100px_80px] gap-2 border-b border-gray-800 px-4 py-2 text-xs text-gray-500"
		>
			<span>Name</span>
			<span>Schedule</span>
			<span>Next Run</span>
			<span>Last Run</span>
			<span class="text-right">Status</span>
		</div>

		<!-- Job rows -->
		<div class="flex-1 overflow-y-auto">
			{#each jobs as job (job.id)}
				{@const badge = statusBadge(job)}
				<div
					class="grid grid-cols-[1fr_140px_100px_100px_80px] gap-2 border-b border-gray-800/50 px-4 py-2 text-xs transition-colors hover:bg-gray-800"
				>
					<div class="truncate">
						<span class="font-medium text-white">{job.name}</span>
						{#if job.description}
							<span class="ml-1 text-gray-500">— {job.description}</span>
						{/if}
					</div>
					<span class="text-gray-400">{formatSchedule(job)}</span>
					<span
						class="text-gray-400"
						title={job.nextRun ? new Date(job.nextRun).toLocaleString() : ''}
					>
						{job.nextRun ? formatRelativeTime(job.nextRun) : '—'}
					</span>
					<span
						class="text-gray-400"
						title={job.lastRun ? new Date(job.lastRun).toLocaleString() : ''}
					>
						{job.lastRun ? formatRelativeTime(job.lastRun) : '—'}
					</span>
					<div class="flex justify-end">
						<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {badge.class}">
							{badge.text}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
