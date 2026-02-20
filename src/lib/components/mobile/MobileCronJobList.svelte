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
	import { describeCron, describeScheduleObject } from '$lib/cron-utils.js';
	import ChatView from '$lib/components/ChatView.svelte';
	import { formatRelativeTime, formatCountdown } from '$lib/chat/time-utils.js';
	import { setActiveSession } from '$lib/stores/sessions.js';
	import { addToast } from '$lib/stores/toast.js';
	import BottomSheet from './BottomSheet.svelte';
	import MobileCronJobForm from './MobileCronJobForm.svelte';

	let jobs = $state<CronJob[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let search = $state('');

	let view = $state<'list' | 'form'>('list');
	let editingJob = $state<CronJob | null>(null);

	let chatSlideOpen = $state(false);
	let deleteTarget = $state<CronJob | null>(null);
	let deleteSheetOpen = $state(false);
	let overflowTarget = $state<CronJob | null>(null);
	let overflowSheetOpen = $state(false);

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
		if (job.sessionTarget) {
			setActiveSession(job.sessionTarget);
			chatSlideOpen = true;
			history.pushState({ jobChatOpen: true }, '');
		} else {
			addToast('No chat session linked to this job', 'info');
		}
	}

	function closeChatSlide() {
		chatSlideOpen = false;
	}

	$effect(() => {
		function onPopState(e: PopStateEvent) {
			if (chatSlideOpen && !e.state?.jobChatOpen) {
				chatSlideOpen = false;
			}
		}
		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	});

	function handleFormBack() {
		view = 'list';
		editingJob = null;
	}

	function confirmDelete(job: CronJob) {
		deleteTarget = job;
		deleteSheetOpen = true;
		overflowSheetOpen = false;
		overflowTarget = null;
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

	function openOverflow(job: CronJob) {
		overflowTarget = job;
		overflowSheetOpen = true;
	}

	function scheduleLabel(job: CronJob): string {
		if (job.rawSchedule) return describeScheduleObject(job.rawSchedule);
		if (job.scheduleType === 'cron') return describeCron(job.schedule);
		return formatSchedule(job);
	}

	function statusDotClass(job: CronJob): string {
		if (!job.enabled) return 'bg-gray-500';
		if (job.lastStatus === 'error') return 'bg-red-400';
		return 'bg-green-400';
	}

	function showIsolatedChip(job: CronJob): boolean {
		return job.payloadType === 'system-event' || !!job.sessionTarget;
	}
</script>

{#if view === 'form'}
	<MobileCronJobForm job={editingJob} onback={handleFormBack} />
{:else}
	<div class="flex h-full flex-col bg-gray-950">
		<!-- Header -->
		<div class="flex items-center justify-end border-b border-gray-700 px-4 py-3">
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
						<div
							class="rounded-xl border border-gray-700 bg-gray-900 p-4 {job.enabled
								? ''
								: 'opacity-60'}"
						>
							<!-- Row 1: name + toggle -->
							<div class="flex items-center justify-between">
								<span class="min-w-0 flex-1 truncate text-sm font-medium text-white">
									{job.name}
								</span>
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
							<div class="mt-2 flex items-center gap-1.5 text-xs text-gray-300">
								<svg
									class="h-3.5 w-3.5 shrink-0 text-gray-500"
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

							<!-- Timing row: Next / Last + status dot -->
							<div class="mt-2 flex items-center gap-x-4 text-xs text-gray-500">
								{#if job.enabled && job.nextRun}
									<span title={new Date(job.nextRun).toLocaleString()}>
										Next: {formatCountdown(job.nextRun)}
									</span>
								{:else if !job.enabled}
									<span class="text-gray-600">Paused</span>
								{/if}
								{#if job.lastRun}
									<span title={new Date(job.lastRun).toLocaleString()}>
										Last: {formatRelativeTime(job.lastRun)}
									</span>
								{/if}
								<span class="ml-auto h-2 w-2 shrink-0 rounded-full {statusDotClass(job)}"></span>
							</div>

							<!-- Actions row: chip + icon buttons -->
							<div class="mt-3 flex items-center justify-between">
								<div>
									{#if showIsolatedChip(job)}
										<span
											class="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400"
										>
											{job.payloadType === 'system-event' ? 'system' : 'isolated'}
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-1">
									{#if job.enabled}
										<button
											onclick={() => handleRun(job)}
											class="flex h-[44px] w-[44px] items-center justify-center rounded-lg text-gray-400 active:bg-gray-800"
											title="Run now"
										>
											<svg class="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24">
												<path d="M8 5v14l11-7z" />
											</svg>
										</button>
									{/if}
									<button
										onclick={() => handleHistory(job)}
										class="flex h-[44px] w-[44px] items-center justify-center rounded-lg text-gray-400 active:bg-gray-800"
										title="Chat history"
									>
										<svg
											class="h-4.5 w-4.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
											/>
										</svg>
									</button>
									<button
										onclick={() => handleEdit(job)}
										class="flex h-[44px] w-[44px] items-center justify-center rounded-lg text-gray-400 active:bg-gray-800"
										title="Edit"
									>
										<svg
											class="h-4.5 w-4.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
											/>
										</svg>
									</button>
									<button
										onclick={() => openOverflow(job)}
										class="flex h-[44px] w-[44px] items-center justify-center rounded-lg text-gray-400 active:bg-gray-800"
										title="More"
									>
										<svg class="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24">
											<circle cx="12" cy="5" r="1.5" />
											<circle cx="12" cy="12" r="1.5" />
											<circle cx="12" cy="19" r="1.5" />
										</svg>
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Overflow sheet -->
	<BottomSheet open={overflowSheetOpen} onclose={() => (overflowSheetOpen = false)}>
		<div class="pb-4">
			{#if overflowTarget}
				<h3 class="mb-3 text-sm font-medium text-white">{overflowTarget.name}</h3>
				<button
					onclick={() => {
						if (overflowTarget) confirmDelete(overflowTarget);
					}}
					class="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm text-red-400 active:bg-gray-800"
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
					Delete Job
				</button>
			{/if}
		</div>
	</BottomSheet>

	<!-- Chat slide-in overlay -->
	<div
		class="fixed inset-0 z-50 bg-gray-950 transition-transform duration-300 ease-in-out"
		class:translate-x-0={chatSlideOpen}
		class:translate-x-full={!chatSlideOpen}
	>
		{#if chatSlideOpen}
			<div class="flex items-center border-b border-gray-800 px-2 py-2">
				<button
					onclick={closeChatSlide}
					class="flex h-[44px] w-[44px] items-center justify-center rounded-lg text-gray-400"
				>
					<svg
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<span class="text-sm font-medium text-gray-300">Job Chat</span>
			</div>
			<div class="h-[calc(100%-52px)]">
				<ChatView />
			</div>
		{/if}
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
