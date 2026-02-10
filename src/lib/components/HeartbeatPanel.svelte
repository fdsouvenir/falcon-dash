<script lang="ts">
	import {
		heartbeatConfig,
		heartbeatStatus,
		heartbeatTemplate,
		heartbeatLoading,
		heartbeatError,
		loadHeartbeatConfig,
		updateHeartbeatConfig,
		saveHeartbeatTemplate,
		subscribeToHeartbeatEvents,
		unsubscribeFromHeartbeatEvents,
		type HeartbeatConfig,
		type HeartbeatStatus
	} from '$lib/stores/heartbeat.js';
	import MarkdownRenderer from './MarkdownRenderer.svelte';
	import HeartbeatHistory from './HeartbeatHistory.svelte';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';

	let config = $state<HeartbeatConfig | null>(null);
	let status = $state<HeartbeatStatus | null>(null);
	let template = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Edit state
	let editingTemplate = $state(false);
	let templateDraft = $state('');
	let isSaving = $state(false);

	// Config edit state
	let editStart = $state('');
	let editEnd = $state('');
	let editTimezone = $state('');
	let editTarget = $state('');
	let showConfigEdit = $state(false);

	$effect(() => {
		const u = heartbeatConfig.subscribe((v) => {
			config = v;
		});
		return u;
	});
	$effect(() => {
		const u = heartbeatStatus.subscribe((v) => {
			status = v;
		});
		return u;
	});
	$effect(() => {
		const u = heartbeatTemplate.subscribe((v) => {
			template = v;
		});
		return u;
	});
	$effect(() => {
		const u = heartbeatLoading.subscribe((v) => {
			loading = v;
		});
		return u;
	});
	$effect(() => {
		const u = heartbeatError.subscribe((v) => {
			error = v;
		});
		return u;
	});

	$effect(() => {
		loadHeartbeatConfig();
		subscribeToHeartbeatEvents();
		return () => {
			unsubscribeFromHeartbeatEvents();
		};
	});

	function startEditTemplate() {
		templateDraft = template;
		editingTemplate = true;
	}

	async function handleSaveTemplate() {
		isSaving = true;
		const success = await saveHeartbeatTemplate(templateDraft);
		isSaving = false;
		if (success) editingTemplate = false;
	}

	function openConfigEdit() {
		if (!config) return;
		editStart = config.activeHours.start;
		editEnd = config.activeHours.end;
		editTimezone = config.activeHours.timezone;
		editTarget = config.deliveryTarget;
		showConfigEdit = true;
	}

	async function handleSaveConfig() {
		isSaving = true;
		await updateHeartbeatConfig({
			activeHours: { start: editStart, end: editEnd, timezone: editTimezone },
			deliveryTarget: editTarget
		});
		isSaving = false;
		showConfigEdit = false;
	}

	async function toggleHeartbeat() {
		if (!config) return;
		await updateHeartbeatConfig({ enabled: !config.enabled });
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
		<h2 class="text-sm font-medium text-white">Heartbeat Configuration</h2>
	</div>

	{#if loading}
		<div class="flex flex-1 items-center justify-center text-sm text-gray-500">Loading...</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center text-sm text-red-400">{error}</div>
	{:else}
		<div class="flex-1 overflow-y-auto p-4">
			<!-- Status Section -->
			<div class="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-xs font-medium uppercase tracking-wide text-gray-500">Status</h3>
					{#if config}
						<button
							onclick={toggleHeartbeat}
							class="rounded px-2 py-1 text-xs {config.enabled
								? 'bg-green-600/30 text-green-400'
								: 'bg-gray-700 text-gray-400'}"
						>
							{config.enabled ? 'Active' : 'Paused'}
						</button>
					{/if}
				</div>
				{#if status}
					<div class="grid grid-cols-3 gap-4 text-xs">
						<div>
							<span class="text-gray-500">Interval</span>
							<p class="mt-1 text-white">{config ? `${config.intervalMinutes}m` : '—'}</p>
						</div>
						<div>
							<span class="text-gray-500">Last Run</span>
							<p class="mt-1 text-white">
								{status.lastRun ? formatRelativeTime(status.lastRun) : '—'}
							</p>
						</div>
						<div>
							<span class="text-gray-500">Next Run</span>
							<p class="mt-1 text-white">
								{status.nextRun ? formatRelativeTime(status.nextRun) : '—'}
							</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Configuration Section -->
			<div class="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-xs font-medium uppercase tracking-wide text-gray-500">Configuration</h3>
					<button onclick={openConfigEdit} class="text-xs text-blue-400 hover:text-blue-300">
						Edit
					</button>
				</div>
				{#if config}
					<div class="grid grid-cols-2 gap-4 text-xs">
						<div>
							<span class="text-gray-500">Active Hours</span>
							<p class="mt-1 text-white">
								{config.activeHours.start} — {config.activeHours.end}
							</p>
						</div>
						<div>
							<span class="text-gray-500">Timezone</span>
							<p class="mt-1 text-white">{config.activeHours.timezone}</p>
						</div>
						<div>
							<span class="text-gray-500">Delivery Target</span>
							<p class="mt-1 text-white">{config.deliveryTarget}</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- HEARTBEAT.md Section -->
			<div class="rounded-lg border border-gray-800 bg-gray-900 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-xs font-medium uppercase tracking-wide text-gray-500">
						HEARTBEAT.md Template
					</h3>
					{#if !editingTemplate}
						<button onclick={startEditTemplate} class="text-xs text-blue-400 hover:text-blue-300">
							Edit
						</button>
					{/if}
				</div>
				{#if editingTemplate}
					<textarea
						bind:value={templateDraft}
						class="mb-3 h-64 w-full resize-none rounded border border-gray-700 bg-gray-950 p-3 font-mono text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
						spellcheck="false"
					></textarea>
					<div class="flex justify-end gap-2">
						<button
							onclick={() => {
								editingTemplate = false;
							}}
							class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
						>
							Cancel
						</button>
						<button
							onclick={handleSaveTemplate}
							disabled={isSaving}
							class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
						>
							{isSaving ? 'Saving...' : 'Save'}
						</button>
					</div>
					{#if templateDraft}
						<div class="mt-3 border-t border-gray-800 pt-3">
							<span class="mb-2 block text-[10px] font-medium uppercase tracking-wide text-gray-600"
								>Preview</span
							>
							<MarkdownRenderer content={templateDraft} />
						</div>
					{/if}
				{:else if template}
					<MarkdownRenderer content={template} />
				{:else}
					<p class="text-xs text-gray-500">No HEARTBEAT.md template found</p>
				{/if}
			</div>

			<!-- History Section -->
			<div class="mt-6">
				<HeartbeatHistory />
			</div>
		</div>
	{/if}

	<!-- Config Edit Dialog -->
	{#if showConfigEdit}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={() => {
				showConfigEdit = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') showConfigEdit = false;
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="w-96 rounded-lg border border-gray-700 bg-gray-800 p-5"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="mb-4 text-sm font-medium text-white">Edit Heartbeat Config</h3>
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs text-gray-400">Start Hour</label>
							<input
								type="text"
								bind:value={editStart}
								placeholder="09:00"
								class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
							/>
						</div>
						<div>
							<label class="mb-1 block text-xs text-gray-400">End Hour</label>
							<input
								type="text"
								bind:value={editEnd}
								placeholder="17:00"
								class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
							/>
						</div>
					</div>
					<div>
						<label class="mb-1 block text-xs text-gray-400">Timezone</label>
						<input
							type="text"
							bind:value={editTimezone}
							placeholder="America/New_York"
							class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs text-gray-400">Delivery Target</label>
						<select
							bind:value={editTarget}
							class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
						>
							<option value="last">Last Active Channel</option>
							<option value="none">None (Disabled)</option>
						</select>
						<!-- For custom channel, user can type in the field above — or we can add a text input -->
					</div>
				</div>
				<div class="mt-4 flex justify-end gap-2">
					<button
						onclick={() => {
							showConfigEdit = false;
						}}
						class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button
					>
					<button
						onclick={handleSaveConfig}
						disabled={isSaving}
						class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
					>
						{isSaving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
