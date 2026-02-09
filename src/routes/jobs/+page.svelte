<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		heartbeatConfig,
		heartbeatFileContent,
		heartbeatFileHash,
		loadHeartbeatConfig,
		updateHeartbeatConfig,
		loadHeartbeatFile,
		saveHeartbeatFile,
		cronJobs,
		loadCronJobs,
		addCronJob,
		editCronJob,
		removeCronJob,
		enableCronJob,
		disableCronJob,
		runCronJob,
		initCronListeners,
		destroyCronListeners
	} from '$lib/stores';
	import type { CronJob, CronAddParams, CronEditParams } from '$lib/gateway/types';
	import { formatRelativeTime } from '$lib/utils/time';
	import FilePreview from '$lib/components/files/FilePreview.svelte';
	import FileEditor from '$lib/components/files/FileEditor.svelte';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';
	import CronJobList from '$lib/components/jobs/CronJobList.svelte';
	import CronJobForm from '$lib/components/jobs/CronJobForm.svelte';
	import CronRunHistory from '$lib/components/jobs/CronRunHistory.svelte';

	type Tab = 'heartbeat' | 'cron';

	let activeTab = $state<Tab>('heartbeat');
	let loading = $state(true);
	let errorMessage = $state('');
	let editing = $state(false);
	let saveError = $state('');
	let now = $state(Date.now());

	let intervalValue = $state(30);

	let intervalDirty = $derived(intervalValue !== $heartbeatConfig.intervalMinutes);

	let refreshInterval: ReturnType<typeof setInterval>;

	// --- Cron state ---
	let cronLoading = $state(false);
	let cronError = $state('');
	let cronLoaded = $state(false);
	let formOpen = $state(false);
	let editingJob = $state<CronJob | null>(null);
	let deleteConfirmOpen = $state(false);
	let deleteTarget = $state<CronJob | null>(null);
	let selectedJobId = $state<string | null>(null);

	async function loadCronTab(): Promise<void> {
		if (cronLoaded) return;
		cronLoading = true;
		cronError = '';
		try {
			await loadCronJobs();
			cronLoaded = true;
		} catch (err) {
			cronError = err instanceof Error ? err.message : 'Failed to load cron jobs';
		} finally {
			cronLoading = false;
		}
	}

	function handleCreateJob(): void {
		editingJob = null;
		formOpen = true;
	}

	function handleEditJob(data: { job: CronJob }): void {
		editingJob = data.job;
		formOpen = true;
	}

	async function handleFormSave(data: { params: CronAddParams | CronEditParams }): Promise<void> {
		formOpen = false;
		try {
			if ('jobId' in data.params) {
				await editCronJob(data.params as CronEditParams);
			} else {
				await addCronJob(data.params as CronAddParams);
			}
		} catch (err) {
			cronError = err instanceof Error ? err.message : 'Failed to save cron job';
		}
	}

	function handleFormCancel(): void {
		formOpen = false;
		editingJob = null;
	}

	function handleDeleteRequest(data: { job: CronJob }): void {
		deleteTarget = data.job;
		deleteConfirmOpen = true;
	}

	async function handleDeleteConfirm(): Promise<void> {
		deleteConfirmOpen = false;
		if (!deleteTarget) return;
		const jobId = deleteTarget.id;
		deleteTarget = null;
		if (selectedJobId === jobId) selectedJobId = null;
		try {
			await removeCronJob(jobId);
		} catch (err) {
			cronError = err instanceof Error ? err.message : 'Failed to delete cron job';
		}
	}

	function handleDeleteCancel(): void {
		deleteConfirmOpen = false;
		deleteTarget = null;
	}

	async function handleToggle(data: { job: CronJob }): Promise<void> {
		const job = data.job;
		try {
			if (job.enabled) {
				await disableCronJob(job.id);
			} else {
				await enableCronJob(job.id);
			}
		} catch (err) {
			cronError = err instanceof Error ? err.message : 'Failed to toggle cron job';
		}
	}

	async function handleRunNow(data: { job: CronJob }): Promise<void> {
		try {
			await runCronJob(data.job.id);
		} catch (err) {
			cronError = err instanceof Error ? err.message : 'Failed to run cron job';
		}
	}

	function handleSelectJob(data: { job: CronJob }): void {
		selectedJobId = selectedJobId === data.job.id ? null : data.job.id;
	}

	// --- Heartbeat ---

	async function toggleEnabled(): Promise<void> {
		try {
			await updateHeartbeatConfig({ enabled: !$heartbeatConfig.enabled });
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to update config';
		}
	}

	async function saveInterval(): Promise<void> {
		if (!intervalDirty) return;
		try {
			await updateHeartbeatConfig({ intervalMinutes: intervalValue });
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to update interval';
		}
	}

	function startEditing(): void {
		editing = true;
		saveError = '';
	}

	function cancelEditing(): void {
		editing = false;
		saveError = '';
	}

	async function handleSave(data: { content: string }): Promise<void> {
		saveError = '';
		try {
			await saveHeartbeatFile(data.content, $heartbeatFileHash);
			editing = false;
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to save file';
		}
	}

	async function retry(): Promise<void> {
		loading = true;
		errorMessage = '';
		try {
			await Promise.all([loadHeartbeatConfig(), loadHeartbeatFile()]);
			intervalValue = $heartbeatConfig.intervalMinutes;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load heartbeat data';
		} finally {
			loading = false;
		}
	}

	function switchTab(tab: Tab): void {
		activeTab = tab;
		if (tab === 'cron') {
			loadCronTab();
		}
	}

	onMount(() => {
		initCronListeners();

		refreshInterval = setInterval(() => {
			now = Date.now();
		}, 30000);

		Promise.all([loadHeartbeatConfig(), loadHeartbeatFile()])
			.then(() => {
				intervalValue = $heartbeatConfig.intervalMinutes;
			})
			.catch((err) => {
				errorMessage = err instanceof Error ? err.message : 'Failed to load heartbeat data';
			})
			.finally(() => {
				loading = false;
			});
	});

	onDestroy(() => {
		clearInterval(refreshInterval);
		destroyCronListeners();
	});
</script>

<div class="flex h-full flex-col">
	<!-- Tab bar -->
	<div class="flex border-b border-slate-700" role="tablist" aria-label="Job type tabs">
		<button
			onclick={() => switchTab('heartbeat')}
			class="px-6 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 {activeTab ===
			'heartbeat'
				? 'border-b-2 border-blue-500 text-slate-100'
				: 'text-slate-400 hover:text-slate-200'}"
			role="tab"
			aria-selected={activeTab === 'heartbeat'}
		>
			Heartbeat
		</button>
		<button
			onclick={() => switchTab('cron')}
			class="px-6 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 {activeTab ===
			'cron'
				? 'border-b-2 border-blue-500 text-slate-100'
				: 'text-slate-400 hover:text-slate-200'}"
			role="tab"
			aria-selected={activeTab === 'cron'}
		>
			Cron Jobs
		</button>
	</div>

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{#if activeTab === 'heartbeat'}
			{#if loading}
				<div class="flex items-center justify-center p-8">
					<p class="text-sm text-slate-400">Loading heartbeat configuration...</p>
				</div>
			{:else if errorMessage}
				<div class="flex flex-col items-center justify-center space-y-3 p-8" aria-live="assertive">
					<p class="text-sm text-red-400">{errorMessage}</p>
					<button
						onclick={retry}
						class="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-600"
					>
						Retry
					</button>
				</div>
			{:else}
				<div class="space-y-6 p-6">
					<!-- Status card -->
					<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
						<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
							Heartbeat Configuration
						</h3>
						<div class="space-y-4">
							<!-- Enabled/Disabled -->
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium text-slate-200">Status</p>
									<p class="text-xs text-slate-400">
										{$heartbeatConfig.enabled ? 'Heartbeat is active' : 'Heartbeat is paused'}
									</p>
								</div>
								<button
									onclick={toggleEnabled}
									class="rounded px-4 py-1.5 text-sm font-medium transition-colors {$heartbeatConfig.enabled
										? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
										: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
								>
									{$heartbeatConfig.enabled ? 'Enabled' : 'Disabled'}
								</button>
							</div>

							<!-- Interval -->
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium text-slate-200">Interval</p>
									<p class="text-xs text-slate-400">Minutes between heartbeat checks</p>
								</div>
								<div class="flex items-center space-x-2">
									<input
										type="number"
										min="1"
										max="1440"
										bind:value={intervalValue}
										class="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-right text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
										aria-label="Heartbeat interval in minutes"
									/>
									<span class="text-xs text-slate-400">min</span>
									{#if intervalDirty}
										<button
											onclick={saveInterval}
											class="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-500"
										>
											Save
										</button>
									{/if}
								</div>
							</div>

							<!-- Last Run -->
							{#if $heartbeatConfig.lastRun}
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-medium text-slate-200">Last Run</p>
										<p class="text-xs text-slate-400">Most recent heartbeat execution</p>
									</div>
									<span
										class="text-sm text-slate-300"
										title={new Date($heartbeatConfig.lastRun).toLocaleString()}
									>
										{formatRelativeTime($heartbeatConfig.lastRun, now)}
									</span>
								</div>
							{/if}

							<!-- Status -->
							{#if $heartbeatConfig.status}
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-medium text-slate-200">Run Status</p>
									</div>
									<span class="text-sm text-slate-300">
										{$heartbeatConfig.status}
									</span>
								</div>
							{/if}
						</div>
					</div>

					<!-- HEARTBEAT.md section -->
					<div class="rounded-lg border border-slate-700 bg-slate-800/50">
						<div class="flex items-center justify-between border-b border-slate-700 px-5 py-3">
							<h3 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
								HEARTBEAT.md
							</h3>
							{#if !editing}
								<button
									onclick={startEditing}
									class="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-600"
								>
									Edit
								</button>
							{/if}
						</div>

						{#if saveError}
							<div class="border-b border-red-800 bg-red-900/30 px-5 py-2" aria-live="assertive">
								<p class="text-sm text-red-400">{saveError}</p>
							</div>
						{/if}

						{#if editing}
							<FileEditor
								content={$heartbeatFileContent}
								filename="HEARTBEAT.md"
								onsave={handleSave}
								oncancel={cancelEditing}
							/>
						{:else if $heartbeatFileContent}
							<div class="p-5">
								<FilePreview content={$heartbeatFileContent} filename="HEARTBEAT.md" />
							</div>
						{:else}
							<div class="p-5">
								<p class="text-sm text-slate-400">
									No HEARTBEAT.md file found. Click Edit to create one.
								</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{:else if activeTab === 'cron'}
			<div class="p-6">
				<!-- Toolbar -->
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Cron Jobs</h3>
					<button
						onclick={handleCreateJob}
						class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500"
					>
						New Job
					</button>
				</div>

				{#if cronError}
					<div
						class="mb-4 rounded border border-red-800 bg-red-900/30 px-4 py-2"
						aria-live="assertive"
					>
						<p class="text-sm text-red-400">{cronError}</p>
					</div>
				{/if}

				{#if cronLoading}
					<div class="flex items-center justify-center p-8">
						<p class="text-sm text-slate-400">Loading cron jobs...</p>
					</div>
				{:else}
					<div class="rounded-lg border border-slate-700 bg-slate-800/50">
						<CronJobList
							jobs={$cronJobs}
							{now}
							{selectedJobId}
							onedit={handleEditJob}
							ondelete={handleDeleteRequest}
							onrun={handleRunNow}
							ontoggle={handleToggle}
							onselect={handleSelectJob}
						/>
					</div>

					{#if selectedJobId}
						<div class="mt-4 rounded-lg border border-slate-700 bg-slate-800/50">
							<div class="border-b border-slate-700 px-5 py-3">
								<h4 class="text-sm font-semibold text-slate-300">Run History</h4>
							</div>
							<CronRunHistory jobId={selectedJobId} {now} />
						</div>
					{/if}
				{/if}
			</div>

			<CronJobForm
				open={formOpen}
				job={editingJob}
				onsave={handleFormSave}
				oncancel={handleFormCancel}
			/>

			<ConfirmDialog
				title="Delete Cron Job"
				message="Are you sure you want to delete &quot;{deleteTarget?.name ??
					''}&quot;? This action cannot be undone."
				confirmLabel="Delete"
				open={deleteConfirmOpen}
				onconfirm={handleDeleteConfirm}
				oncancel={handleDeleteCancel}
			/>
		{/if}
	</div>
</div>
