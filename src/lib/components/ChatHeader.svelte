<script lang="ts">
	import { snapshot, call } from '$lib/stores/gateway.js';
	import { getAgentIdentity, connectionState } from '$lib/stores/agent-identity.js';
	import { activeSessionKey } from '$lib/stores/sessions.js';
	import { loadThreads } from '$lib/stores/threads.js';
	import ThreadList from '$lib/components/ThreadList.svelte';

	let {
		onsearchToggle
	}: {
		onsearchToggle?: () => void;
	} = $props();

	let showSettings = $state(false);
	let showThreads = $state(false);
	let model = $state('');
	let thinkingLevel = $state('off');
	let verbose = $state(false);

	// Read defaults from snapshot
	$effect(() => {
		const unsub = snapshot.sessionDefaults.subscribe((defaults) => {
			model = defaults.model ?? '';
			thinkingLevel = defaults.thinkingLevel ?? 'off';
		});
		return unsub;
	});

	let currentSessionKey = $state<string | null>(null);
	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			currentSessionKey = v;
		});
		return unsub;
	});

	let agentName = $state('Agent');
	$effect(() => {
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'CONNECTED') return;
			getAgentIdentity().then((identity) => {
				agentName = identity.name || 'Agent';
			});
		});
		return unsub;
	});

	async function updateSetting(field: string, value: unknown) {
		if (!currentSessionKey) return;
		await call('sessions.patch', { key: currentSessionKey, [field]: value });
	}

	async function handleModelChange(e: Event) {
		const input = e.target as HTMLInputElement;
		model = input.value;
		await updateSetting('model', model);
	}

	async function handleThinkingChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		thinkingLevel = select.value;
		await updateSetting('thinkingLevel', thinkingLevel);
	}

	async function toggleVerbose() {
		verbose = !verbose;
		await updateSetting('verbose', verbose);
	}

	async function resetSession() {
		if (!currentSessionKey) return;
		await call('sessions.reset', { sessionKey: currentSessionKey });
	}

	async function compactTranscript() {
		if (!currentSessionKey) return;
		await call('sessions.compact', { sessionKey: currentSessionKey });
	}

	function toggleSettings() {
		showSettings = !showSettings;
	}
</script>

<!-- Desktop header -->
<div class="hidden md:flex items-center justify-between border-b border-gray-800 px-4 py-2">
	<div class="text-sm font-medium text-white">Chat</div>
	<div class="flex items-center gap-3">
		{#if model}
			<span class="text-xs text-gray-400">{model}</span>
		{/if}
		{#if onsearchToggle}
			<button
				onclick={onsearchToggle}
				class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
				aria-label="Search messages"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
			</button>
		{/if}
		<button
			onclick={() => {
				showThreads = !showThreads;
				if (showThreads && currentSessionKey) loadThreads(currentSessionKey);
			}}
			class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
			aria-label="View threads"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
				/>
			</svg>
		</button>
		<button
			onclick={toggleSettings}
			class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
			aria-label="Chat settings"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
		</button>
	</div>
</div>

<!-- Mobile header (hidden — MobileHeader handles mobile chrome) -->
<div class="hidden">
	<div class="flex-1"></div>
	<div class="flex items-center gap-2">
		<div
			class="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white"
		>
			{agentName.charAt(0).toUpperCase()}
		</div>
		<span class="text-sm font-medium text-white">{agentName}</span>
	</div>
	<div class="flex flex-1 justify-end">
		<button
			onclick={toggleSettings}
			class="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
			aria-label="Chat settings"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
		</button>
	</div>
</div>

{#if showThreads}
	<div class="border-b border-gray-800 bg-gray-900">
		<ThreadList />
	</div>
{/if}

{#if showSettings}
	<div class="border-b border-gray-800 bg-gray-900 px-4 py-3">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<!-- Model override -->
			<div>
				<label for="model-input" class="mb-1 block text-xs text-gray-400">Model</label>
				<input
					id="model-input"
					type="text"
					value={model}
					onchange={handleModelChange}
					placeholder="Default model"
					class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<!-- Thinking level -->
			<div>
				<label for="thinking-select" class="mb-1 block text-xs text-gray-400">Thinking</label>
				<select
					id="thinking-select"
					value={thinkingLevel}
					onchange={handleThinkingChange}
					class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
				>
					<option value="off">Off</option>
					<option value="minimal">Minimal</option>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
					<option value="xhigh">X-High</option>
				</select>
			</div>
		</div>

		<div class="mt-3 flex items-center justify-between">
			<!-- Verbose toggle -->
			<label class="flex items-center gap-2 text-xs text-gray-400">
				<input type="checkbox" checked={verbose} onchange={toggleVerbose} class="rounded" />
				Verbose output
			</label>

			<!-- Action buttons -->
			<div class="flex gap-2">
				<button
					onclick={resetSession}
					class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
				>
					Reset
				</button>
				<button
					onclick={compactTranscript}
					class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
				>
					Compact
				</button>
			</div>
		</div>
	</div>
{/if}
