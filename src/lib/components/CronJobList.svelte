<script lang="ts">
	import {
		cronJobs,
		cronLoading,
		cronError,
		loadCronJobs,
		subscribeToCronEvents,
		unsubscribeFromCronEvents,
		formatSchedule,
		deleteCronJob,
		toggleCronJob,
		runCronJob,
		type CronJob
	} from '$lib/stores/cron.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';
	import CronJobForm from './CronJobForm.svelte';

	let jobs = $state<CronJob[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let showForm = $state(false);
	let editingJob = $state<CronJob | null>(null);
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<CronJob | null>(null);

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

	function openCreateForm() {
		editingJob = null;
		showForm = true;
	}

	function openEditForm(job: CronJob) {
		editingJob = job;
		showForm = true;
	}

	function closeForm() {
		showForm = false;
		editingJob = null;
	}

	function confirmDeleteJob(job: CronJob) {
		deleteTarget = job;
		showDeleteConfirm = true;
	}

	async function handleDeleteJob() {
		if (!deleteTarget) return;
		await deleteCronJob(deleteTarget.id);
		deleteTarget = null;
		showDeleteConfirm = false;
	}

	async function handleToggle(job: CronJob) {
		await toggleCronJob(job.id, !job.enabled);
	}

	async function handleRunNow(job: CronJob) {
		await runCronJob(job.id);
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
		<h2 class="text-sm font-medium text-white">Scheduled Jobs</h2>
		<button
			onclick={openCreateForm}
			class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
		>
			+ Create Job
		</button>
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
			<button
				onclick={openCreateForm}
				class="text-xs text-blue-400 hover:text-blue-300 hover:underline"
			>
				Create a job to automate agent tasks
			</button>
		</div>
	{:else}
		<!-- Column headers -->
		<div
			class="grid grid-cols-[1fr_140px_100px_100px_80px_140px] gap-2 border-b border-gray-800 px-4 py-2 text-xs text-gray-500"
		>
			<span>Name</span>
			<span>Schedule</span>
			<span>Next Run</span>
			<span>Last Run</span>
			<span class="text-right">Status</span>
			<span class="text-right">Actions</span>
		</div>

		<!-- Job rows -->
		<div class="flex-1 overflow-y-auto">
			{#each jobs as job (job.id)}
				{@const badge = statusBadge(job)}
				<div
					class="grid grid-cols-[1fr_140px_100px_100px_80px_140px] gap-2 border-b border-gray-800/50 px-4 py-2 text-xs transition-colors hover:bg-gray-800"
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
					<div class="flex items-center justify-end gap-1">
						<button
							onclick={(e) => {
								e.stopPropagation();
								handleToggle(job);
							}}
							class="rounded px-1.5 py-0.5 text-[10px] {job.enabled
								? 'text-green-400 hover:text-green-300'
								: 'text-gray-500 hover:text-gray-400'}"
							title={job.enabled ? 'Disable' : 'Enable'}
						>
							{job.enabled ? 'ON' : 'OFF'}
						</button>
						<button
							onclick={(e) => {
								e.stopPropagation();
								handleRunNow(job);
							}}
							class="rounded px-1.5 py-0.5 text-[10px] text-blue-400 hover:text-blue-300"
							title="Run Now"
						>
							▶
						</button>
						<button
							onclick={(e) => {
								e.stopPropagation();
								openEditForm(job);
							}}
							class="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white"
							title="Edit"
						>
							✏️
						</button>
						<button
							onclick={(e) => {
								e.stopPropagation();
								confirmDeleteJob(job);
							}}
							class="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-red-400"
							title="Delete"
						>
							🗑️
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showForm}
	<CronJobForm job={editingJob} onclose={closeForm} />
{/if}

{#if showDeleteConfirm && deleteTarget}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={() => {
			showDeleteConfirm = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') showDeleteConfirm = false;
		}}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-2 text-sm font-medium text-white">Delete Job</h3>
			<p class="mb-4 text-xs text-gray-400">
				Are you sure you want to delete <span class="font-medium text-white"
					>{deleteTarget.name}</span
				>?
			</p>
			<div class="flex justify-end gap-2">
				<button
					onclick={() => {
						showDeleteConfirm = false;
					}}
					class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button
				>
				<button
					onclick={handleDeleteJob}
					class="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-500">Delete</button
				>
			</div>
		</div>
	</div>
{/if}
