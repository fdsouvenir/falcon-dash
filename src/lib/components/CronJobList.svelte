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
	import { formatRelativeTime } from '$lib/utils/time.js';
	import { describeCron, describeScheduleObject } from '$lib/cron-utils.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CronJobForm from './CronJobForm.svelte';
	import { getAgentIdentity, connectionState } from '$lib/stores/agent-identity.js';
	import { setActiveSession } from '$lib/stores/sessions.js';
	import { addToast } from '$lib/stores/toast.js';

	let jobs = $state<CronJob[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let showForm = $state(false);
	let editingJob = $state<CronJob | null>(null);
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<CronJob | null>(null);
	let agentName = $state('Agent');
	let searchQuery = $state('');
	let sortBy = $state<'name' | 'schedule' | 'lastRun'>('name');
	let sortAsc = $state(true);

	let filteredAndSortedJobs = $derived.by(() => {
		let result = jobs;

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(job) =>
					job.name.toLowerCase().includes(query) ||
					job.description?.toLowerCase().includes(query) ||
					job.schedule.toLowerCase().includes(query)
			);
		}

		// Sort
		result = [...result].sort((a, b) => {
			let cmp = 0;
			if (sortBy === 'name') {
				cmp = a.name.localeCompare(b.name);
			} else if (sortBy === 'schedule') {
				cmp = a.schedule.localeCompare(b.schedule);
			} else if (sortBy === 'lastRun') {
				const aTime = a.lastRun ?? 0;
				const bTime = b.lastRun ?? 0;
				cmp = aTime - bTime;
			}
			return sortAsc ? cmp : -cmp;
		});

		return result;
	});

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

	$effect(() => {
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'CONNECTED') return;
			getAgentIdentity().then((identity) => {
				agentName = identity.name || 'Agent';
			});
		});
		return unsub;
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

	function openHistory(job: CronJob) {
		if (job.sessionTarget) {
			setActiveSession(job.sessionTarget);
			goto(resolve('/'));
		} else {
			addToast('No chat session linked to this job', 'info');
		}
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

	function toggleSort(field: 'name' | 'schedule' | 'lastRun') {
		if (sortBy === field) {
			sortAsc = !sortAsc;
		} else {
			sortBy = field;
			sortAsc = true;
		}
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-gray-800 px-4 py-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-medium text-white">{agentName}'s Jobs</h2>
			<button
				onclick={openCreateForm}
				class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
			>
				+ Create Job
			</button>
		</div>
		{#if jobs.length > 0}
			<div class="mt-3">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search jobs..."
					class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
				/>
			</div>
		{/if}
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
			<button
				onclick={() => toggleSort('name')}
				class="text-left hover:text-white"
				title="Sort by name"
			>
				Name {sortBy === 'name' ? (sortAsc ? '▲' : '▼') : ''}
			</button>
			<button
				onclick={() => toggleSort('schedule')}
				class="text-left hover:text-white"
				title="Sort by schedule"
			>
				Schedule {sortBy === 'schedule' ? (sortAsc ? '▲' : '▼') : ''}
			</button>
			<span>Next Run</span>
			<button
				onclick={() => toggleSort('lastRun')}
				class="text-left hover:text-white"
				title="Sort by last run"
			>
				Last Run {sortBy === 'lastRun' ? (sortAsc ? '▲' : '▼') : ''}
			</button>
			<span class="text-right">Status</span>
			<span class="text-right">Actions</span>
		</div>

		<!-- Job rows -->
		<div class="flex-1 overflow-y-auto">
			{#each filteredAndSortedJobs as job (job.id)}
				{@const badge = statusBadge(job)}
				{@const humanSchedule = job.rawSchedule
					? describeScheduleObject(job.rawSchedule)
					: job.scheduleType === 'cron'
						? describeCron(job.schedule)
						: null}
				<div
					class="grid grid-cols-[1fr_140px_100px_100px_80px_140px] gap-2 border-b border-gray-800/50 px-4 py-2 text-xs transition-colors hover:bg-gray-800"
				>
					<div class="truncate">
						<span class="font-medium text-white">{job.name}</span>
						{#if job.description}
							<span class="ml-1 text-gray-500">— {job.description}</span>
						{/if}
					</div>
					<div class="truncate">
						{#if humanSchedule && humanSchedule !== job.schedule}
							<span class="text-gray-300" title={job.schedule}>{humanSchedule}</span>
						{:else}
							<span class="text-gray-400">{formatSchedule(job)}</span>
						{/if}
					</div>
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
								openHistory(job);
							}}
							class="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white"
							title="Run History"
						>
							📊
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
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-label="Delete job confirmation"
		onclick={(e) => {
			if (e.target === e.currentTarget) showDeleteConfirm = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') showDeleteConfirm = false;
		}}
	>
		<div class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4">
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
