<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		heartbeatConfig,
		heartbeatFileContent,
		heartbeatFileHash,
		loadHeartbeatConfig,
		updateHeartbeatConfig,
		loadHeartbeatFile,
		saveHeartbeatFile
	} from '$lib/stores';
	import { formatRelativeTime } from '$lib/utils/time';
	import FilePreview from '$lib/components/files/FilePreview.svelte';
	import FileEditor from '$lib/components/files/FileEditor.svelte';

	type Tab = 'heartbeat' | 'cron';

	let activeTab: Tab = 'heartbeat';
	let loading = true;
	let errorMessage = '';
	let editing = false;
	let saveError = '';
	let now = Date.now();

	let intervalValue = 30;

	$: intervalDirty = intervalValue !== $heartbeatConfig.intervalMinutes;

	let refreshInterval: ReturnType<typeof setInterval>;

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

	async function handleSave(event: CustomEvent<{ content: string }>): Promise<void> {
		saveError = '';
		try {
			await saveHeartbeatFile(event.detail.content, $heartbeatFileHash);
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

	onMount(() => {
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
	});
</script>

<div class="flex h-full flex-col">
	<!-- Tab bar -->
	<div class="flex border-b border-slate-700">
		<button
			on:click={() => (activeTab = 'heartbeat')}
			class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'heartbeat'
				? 'border-b-2 border-blue-500 text-slate-100'
				: 'text-slate-400 hover:text-slate-200'}"
		>
			Heartbeat
		</button>
		<button
			on:click={() => (activeTab = 'cron')}
			class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'cron'
				? 'border-b-2 border-blue-500 text-slate-100'
				: 'text-slate-400 hover:text-slate-200'}"
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
				<div class="flex flex-col items-center justify-center space-y-3 p-8">
					<p class="text-sm text-red-400">{errorMessage}</p>
					<button
						on:click={retry}
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
									on:click={toggleEnabled}
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
									/>
									<span class="text-xs text-slate-400">min</span>
									{#if intervalDirty}
										<button
											on:click={saveInterval}
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
									on:click={startEditing}
									class="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-600"
								>
									Edit
								</button>
							{/if}
						</div>

						{#if saveError}
							<div class="border-b border-red-800 bg-red-900/30 px-5 py-2">
								<p class="text-sm text-red-400">{saveError}</p>
							</div>
						{/if}

						{#if editing}
							<FileEditor
								content={$heartbeatFileContent}
								filename="HEARTBEAT.md"
								on:save={handleSave}
								on:cancel={cancelEditing}
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
			<div class="flex items-center justify-center p-8">
				<p class="text-sm text-slate-400">Cron job management coming soon.</p>
			</div>
		{/if}
	</div>
</div>
