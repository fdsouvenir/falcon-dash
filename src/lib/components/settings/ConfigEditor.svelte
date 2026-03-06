<script lang="ts">
	import { rpc, gatewayEvents } from '$lib/gateway-api.js';

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

	let connectionState = $state('disconnected');
	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		if (connectionState === 'ready') loadConfig();
	});

	async function loadConfig() {
		loading = true;
		error = null;
		try {
			const result = await rpc<{ raw: string; hash: string; schema?: object }>('config.get', {});
			config = result.raw;
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
			const result = await rpc<{ hash: string }>('config.set', { config, baseHash });
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
			await rpc('config.apply', { raw: config, baseHash });
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
	<h2 class="text-2xl font-bold text-white">Gateway Configuration Editor</h2>

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
		<div class="text-status-muted">Loading configuration...</div>
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
					class="bg-surface-3 hover:bg-surface-3 text-white px-4 py-2 rounded"
				>
					Format JSON
				</button>
				<button
					onclick={saveConfig}
					disabled={!isDirty}
					class="bg-blue-600 hover:bg-blue-700 disabled:bg-surface-3 disabled:cursor-not-allowed text-white px-4 py-2 rounded"
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
					class="bg-surface-3 hover:bg-surface-3 text-white px-4 py-2 rounded"
				>
					Reload
				</button>
				{#if schema}
					<button
						onclick={() => (showSchema = !showSchema)}
						class="bg-surface-3 hover:bg-surface-3 text-white px-4 py-2 rounded ml-auto"
					>
						{showSchema ? 'Hide Schema' : 'Show Schema'}
					</button>
				{/if}
			</div>

			{#if isDirty}
				<div class="text-yellow-400 text-sm">Unsaved changes</div>
			{/if}

			<!-- Config Editor -->
			<div class="bg-surface-2 rounded-lg p-4">
				<textarea
					bind:value={config}
					oninput={handleInput}
					class="w-full h-96 bg-surface-1 text-white border border-surface-border rounded px-3 py-2 font-mono text-sm resize-y"
					spellcheck="false"
				></textarea>
			</div>

			<!-- Schema Display -->
			{#if showSchema && schema}
				<div class="bg-surface-2 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-white mb-3">Configuration Schema</h3>
					<pre
						class="bg-surface-1 text-white/70 p-3 rounded overflow-x-auto text-sm font-mono">{JSON.stringify(
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
			<div class="bg-surface-2 rounded-lg p-6 max-w-md w-full mx-4">
				<h3 class="text-xl font-bold text-white mb-4">Confirm Apply + Restart</h3>
				<p class="text-white/70 mb-6">
					This will apply the configuration changes and restart the gateway. All active connections
					will be disconnected.
				</p>
				<div class="flex gap-3 justify-end">
					<button
						onclick={() => (showApplyConfirm = false)}
						class="bg-surface-3 hover:bg-surface-3 text-white px-4 py-2 rounded"
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
