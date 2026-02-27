<script lang="ts">
	import { call, connection } from '$lib/stores/gateway.js';

	let config = $state('');
	let baseHash = $state('');
	let schema = $state<object | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let isDirty = $state(false);
	let showSchema = $state(false);
	let showApplyConfirm = $state(false);
	let unavailable = $state(false);

	let connectionState = $state('DISCONNECTED');
	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		if (connectionState === 'READY') loadConfig();
	});

	async function loadConfig() {
		loading = true;
		error = null;
		try {
			const result = await call<{ config: string; hash: string; schema?: object }>(
				'config.get',
				{}
			);
			config = result.config;
			baseHash = result.hash;
			schema = result.schema || null;
			isDirty = false;
			unavailable = false;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			unavailable = true;
		} finally {
			loading = false;
		}
	}

	function formatConfig() {
		try {
			const parsed = JSON.parse(config);
			config = JSON.stringify(parsed, null, 2);
			success = 'Config formatted';
			setTimeout(() => (success = null), 3000);
		} catch (e) {
			error = 'Invalid JSON: ' + (e instanceof Error ? e.message : String(e));
		}
	}

	async function saveConfig() {
		error = null;
		success = null;
		try {
			JSON.parse(config);
		} catch (e) {
			error = 'Invalid JSON: ' + (e instanceof Error ? e.message : String(e));
			return;
		}

		try {
			const result = await call<{ hash: string }>('config.set', { config, baseHash });
			baseHash = result.hash;
			isDirty = false;
			success = 'Config saved successfully';
			setTimeout(() => (success = null), 3000);
		} catch (e) {
			if (e instanceof Error && e.message.includes('409')) {
				error = 'Conflict: Config was modified by another client. Please reload.';
			} else {
				error = e instanceof Error ? e.message : String(e);
			}
		}
	}

	function confirmApply() {
		showApplyConfirm = true;
	}

	async function applyConfig() {
		showApplyConfirm = false;
		error = null;
		success = null;

		try {
			JSON.parse(config);
		} catch (e) {
			error = 'Invalid JSON: ' + (e instanceof Error ? e.message : String(e));
			return;
		}

		try {
			await call('config.apply', { raw: config, baseHash });
			success = 'Config applied. Gateway is restarting...';
			setTimeout(() => {
				success = null;
				loadConfig();
			}, 3000);
		} catch (e) {
			if (e instanceof Error && e.message.includes('409')) {
				error = 'Conflict: Config was modified by another client. Please reload.';
			} else {
				error = e instanceof Error ? e.message : String(e);
			}
		}
	}

	function handleInput() {
		isDirty = true;
	}
</script>

<div class="p-6 space-y-6">
	<h2 class="text-2xl font-bold text-gray-100">Gateway Configuration Editor</h2>

	<div class="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
		<p class="text-sm text-yellow-400">
			Warning: Editing gateway configuration can affect system stability. Changes are applied
			directly to the running gateway.
		</p>
	</div>

	{#if error}
		<div class="bg-red-900/20 border border-red-500 text-red-300 px-4 py-3 rounded">
			{error}
		</div>
	{/if}

	{#if success}
		<div class="bg-green-900/20 border border-green-500 text-green-300 px-4 py-3 rounded">
			{success}
		</div>
	{/if}

	{#if loading}
		<div class="text-gray-400">Loading configuration...</div>
	{:else if unavailable}
		<div class="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
			<p class="text-sm text-yellow-400">
				Configuration editor requires the config.get gateway method. This feature may not be
				available in all gateway versions.
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			<!-- Editor Toolbar -->
			<div class="flex gap-2 items-center">
				<button
					onclick={formatConfig}
					class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
				>
					Format JSON
				</button>
				<button
					onclick={saveConfig}
					disabled={!isDirty}
					class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded"
				>
					Save
				</button>
				<button
					onclick={confirmApply}
					class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded"
				>
					Apply + Restart
				</button>
				<button
					onclick={loadConfig}
					class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
				>
					Reload
				</button>
				{#if schema}
					<button
						onclick={() => (showSchema = !showSchema)}
						class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded ml-auto"
					>
						{showSchema ? 'Hide Schema' : 'Show Schema'}
					</button>
				{/if}
			</div>

			{#if isDirty}
				<div class="text-yellow-400 text-sm">Unsaved changes</div>
			{/if}

			<!-- Config Editor -->
			<div class="bg-gray-800 rounded-lg p-4">
				<textarea
					bind:value={config}
					oninput={handleInput}
					class="w-full h-96 bg-gray-900 text-gray-100 border border-gray-600 rounded px-3 py-2 font-mono text-sm resize-y"
					spellcheck="false"
				></textarea>
			</div>

			<!-- Schema Display -->
			{#if showSchema && schema}
				<div class="bg-gray-800 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-100 mb-3">Configuration Schema</h3>
					<pre
						class="bg-gray-900 text-gray-300 p-3 rounded overflow-x-auto text-sm font-mono">{JSON.stringify(
							schema,
							null,
							2
						)}</pre>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Apply Confirmation Dialog -->
	{#if showApplyConfirm}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
				<h3 class="text-xl font-bold text-gray-100 mb-4">Confirm Apply + Restart</h3>
				<p class="text-gray-300 mb-6">
					This will apply the configuration changes and restart the gateway. All active connections
					will be disconnected.
				</p>
				<div class="flex gap-3 justify-end">
					<button
						onclick={() => (showApplyConfirm = false)}
						class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
					>
						Cancel
					</button>
					<button
						onclick={applyConfig}
						class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded"
					>
						Confirm Restart
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
