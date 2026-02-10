<script lang="ts">
	import { gatewayToken, gatewayUrl } from '$lib/stores/token.js';

	let token = $state('');
	let url = $state('ws://127.0.0.1:18789');
	let error = $state('');

	// Initialize url from store
	$effect(() => {
		const unsub = gatewayUrl.subscribe((v) => {
			url = v;
		});
		return unsub;
	});

	function handleSubmit() {
		const trimmed = token.trim();
		if (!trimmed) {
			error = 'Please enter a gateway token';
			return;
		}
		error = '';
		gatewayUrl.set(url.trim() || 'ws://127.0.0.1:18789');
		gatewayToken.set(trimmed);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-950 p-4">
	<div class="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6">
		<h1 class="mb-2 text-xl font-bold text-white">Falcon Dashboard</h1>
		<p class="mb-6 text-sm text-gray-400">
			Connect to your OpenClaw Gateway. Enter the gateway token to authenticate.
		</p>

		<div class="mb-4">
			<label for="gateway-url" class="mb-1 block text-sm font-medium text-gray-300">
				Gateway URL
			</label>
			<input
				id="gateway-url"
				type="text"
				bind:value={url}
				placeholder="ws://127.0.0.1:18789"
				class="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
			/>
		</div>

		<div class="mb-4">
			<label for="gateway-token" class="mb-1 block text-sm font-medium text-gray-300">
				Gateway Token
			</label>
			<input
				id="gateway-token"
				type="password"
				bind:value={token}
				onkeydown={handleKeydown}
				placeholder="Paste your gateway token"
				class="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
			/>
		</div>

		{#if error}
			<p class="mb-4 text-sm text-red-400">{error}</p>
		{/if}

		<button
			onclick={handleSubmit}
			class="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
		>
			Connect
		</button>

		<p class="mt-4 text-xs text-gray-500">
			Requires <code class="text-gray-400">gateway.controlUi.allowInsecureAuth: true</code> in gateway
			config for token-only auth.
		</p>
	</div>
</div>
