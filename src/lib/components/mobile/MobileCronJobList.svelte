<script lang="ts">
	import {
		cronJobs,
		cronLoading,
		cronError,
		loadCronJobs,
		deleteCronJob,
		runCronJob,
		toggleCronJob,
		subscribeToCronEvents,
		unsubscribeFromCronEvents,
		formatSchedule,
		type CronJob
	} from '$lib/stores/cron.js';
	import { describeCron } from '$lib/cron-utils.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';
	import BottomSheet from './BottomSheet.svelte';
	import MobileCronJobForm from './MobileCronJobForm.svelte';
	import MobileCronRunHistory from './MobileCronRunHistory.svelte';

	let jobs = $state<CronJob[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let search = $state('');

	let view = $state<'list' | 'form' | 'history'>('list');
	let editingJob = $state<CronJob | null>(null);
	let historyJob = $state<CronJob | null>(null);

	let deleteTarget = $state<CronJob | null>(null);
	let deleteSheetOpen = $state(false);

	$effect(() => {
		const unsub = cronJobs.subscribe((v) => {
			jobs = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = cronLoading.subscribe((v) => {
			loading = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = cronError.subscribe((v) => {
			error = v;
		});
		return unsub;
	});

	$effect(() => {
		loadCronJobs();
		subscribeToCronEvents();
		return () => unsubscribeFromCronEvents();
	});

	let filtered = $derived(
		search.trim()
			? jobs.filter(
					(j) =>
						j.name.toLowerCase().includes(search.toLowerCase()) ||
						(j.description ?? '').toLowerCase().includes(search.toLowerCase())
				)
			: jobs
	);

	function handleCreate() {
		editingJob = null;
		view = 'form';
	}

	function handleEdit(job: CronJob) {
		editingJob = job;
		view = 'form';
	}

	function handleHistory(job: CronJob) {
		historyJob = job;
		view = 'history';
	}

	function handleFormBack() {
		view = 'list';
		editingJob = null;
	}

	function handleHistoryBack() {
		view = 'list';
		historyJob = null;
	}

	function confirmDelete(job: CronJob) {
		deleteTarget = job;
		deleteSheetOpen = true;
	}

	async function handleDelete() {
		if (deleteTarget) {
			await deleteCronJob(deleteTarget.id);
		}
		deleteSheetOpen = false;
		deleteTarget = null;
	}

	async function handleRun(job: CronJob) {
		await runCronJob(job.id);
	}

	async function handleToggle(job: CronJob) {
		await toggleCronJob(job.id, !job.enabled);
	}

	function scheduleLabel(job: CronJob): string {
		if (job.scheduleType === 'cron') return describeCron(job.schedule);
		return formatSchedule(job);
	}
</script>

{#if view === 'form'}
	<MobileCronJobForm job={editingJob} onback={handleFormBack} />
{:else if view === 'history' && historyJob}
	<MobileCronRunHistory job={historyJob} onback={handleHistoryBack} />
{:else}
	<div class="flex h-full flex-col bg-gray-950">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
			<h1 class="text-lg font-semibold text-white">Cron Jobs</h1>
			<button
				onclick={handleCreate}
				class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white active:bg-blue-700"
			>
				<svg
					class="mr-1.5 h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				New
			</button>
		</div>

		<!-- Search -->
		<div class="px-4 py-2">
			<input
				type="text"
				placeholder="Search jobs..."
				bind:value={search}
				class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
			/>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-4 pb-[calc(1rem+var(--safe-bottom))]">
			{#if loading && jobs.length === 0}
				<div class="flex items-center justify-center py-12 text-gray-500">
					<span>Loading jobs...</span>
				</div>
			{:else if error}
				<div class="rounded-lg border border-red-900/50 bg-red-950/50 p-4 text-sm text-red-300">
					{error}
				</div>
			{:else if filtered.length === 0}
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
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{search ? 'No matching jobs' : 'No cron jobs yet'}</span>
				</div>
			{:else}
				<div class="space-y-3 py-2">
					{#each filtered as job (job.id)}
						<div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
							<!-- Top row: name + toggle -->
							<div class="flex items-center justify-between">
								<button onclick={() => handleEdit(job)} class="flex-1 text-left">
									<span class="text-sm font-medium text-white">{job.name}</span>
								</button>
								<button
									onclick={() => handleToggle(job)}
									class="relative ml-3 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors {job.enabled
										? 'bg-blue-600'
										: 'bg-gray-600'}"
									role="switch"
									aria-checked={job.enabled}
								>
									<span
										class="inline-block h-4 w-4 rounded-full bg-white transition-transform {job.enabled
											? 'translate-x-6'
											: 'translate-x-1'}"
									></span>
								</button>
							</div>

							<!-- Description -->
							{#if job.description}
								<p class="mt-1 text-xs text-gray-400">{job.description}</p>
							{/if}

							<!-- Schedule -->
							<div class="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
								<svg
									class="h-3.5 w-3.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<span>{scheduleLabel(job)}</span>
							</div>

							<!-- Session badge -->
							{#if job.sessionTarget}
								<div class="mt-1.5">
									<span class="inline-block rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
										{job.sessionTarget}
									</span>
								</div>
							{/if}

							<!-- Times + status -->
							<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
								{#if job.lastRun}
									<span>Last: {formatRelativeTime(job.lastRun)}</span>
								{/if}
								{#if job.nextRun}
									<span>Next: {formatRelativeTime(job.nextRun)}</span>
								{/if}
								{#if job.lastStatus === 'error'}
									<span class="rounded bg-red-900/50 px-1.5 py-0.5 text-red-400">Error</span>
								{:else if job.enabled}
									<span class="rounded bg-green-900/50 px-1.5 py-0.5 text-green-400">Active</span>
								{:else}
									<span class="rounded bg-gray-800 px-1.5 py-0.5 text-gray-500">Disabled</span>
								{/if}
							</div>

							<!-- Actions -->
							<div class="mt-3 flex items-center gap-2">
								<button
									onclick={() => handleRun(job)}
									class="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-blue-600/20 text-sm font-medium text-blue-400 active:bg-blue-600/30"
								>
									Run Now
								</button>
								<button
									onclick={() => handleHistory(job)}
									class="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-gray-800 text-sm font-medium text-gray-300 active:bg-gray-700"
								>
									History
								</button>
								<button
									onclick={() => confirmDelete(job)}
									class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-red-900/20 text-red-400 active:bg-red-900/30"
								>
									<svg
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Delete confirmation -->
	<BottomSheet open={deleteSheetOpen} onclose={() => (deleteSheetOpen = false)}>
		<div class="pb-4">
			<h3 class="text-lg font-semibold text-white">Delete Job</h3>
			<p class="mt-2 text-sm text-gray-400">
				Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
			</p>
			<div class="mt-4 flex gap-3">
				<button
					onclick={() => (deleteSheetOpen = false)}
					class="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-gray-800 text-sm font-medium text-gray-300 active:bg-gray-700"
				>
					Cancel
				</button>
				<button
					onclick={handleDelete}
					class="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-red-600 text-sm font-medium text-white active:bg-red-700"
				>
					Delete
				</button>
			</div>
		</div>
	</BottomSheet>
{/if}
