<script lang="ts">
	import { gatewayEvents } from '$lib/gateway-api.js';

	let connectionState = $state<string>('disconnected');

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	function handleRetry() {
		gatewayEvents.disconnect();
		gatewayEvents.connect();
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-8">
	<div class="w-full max-w-md space-y-6">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-2xl font-bold text-white">Self-Hosted</h1>
			<p class="mt-1 text-sm text-gray-400">Connecting to your OpenClaw Gateway</p>
		</div>

		<!-- Connection state feedback -->
		{#if connectionState === 'connecting' || connectionState === 'authenticating'}
			<div
				class="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-3"
			>
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"
				></div>
				<span class="text-sm text-blue-300">Connecting to gateway...</span>
			</div>
		{:else if connectionState === 'pairing_required'}
			<div class="rounded-xl border border-yellow-500/20 bg-yellow-950/30 px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="h-4 w-4 animate-pulse rounded-full bg-yellow-400"></div>
					<span class="text-sm text-yellow-300">Waiting for device approval...</span>
				</div>
				<p class="mt-2 text-xs text-gray-400">
					Run <code class="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-yellow-300"
						>openclaw devices approve</code
					> in your terminal
				</p>
			</div>
		{:else if connectionState === 'auth_failed'}
			<div class="rounded-xl border border-red-500/20 bg-red-950/30 px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="h-4 w-4 rounded-full bg-red-400"></div>
					<span class="text-sm text-red-300">Authentication failed</span>
				</div>
				<p class="mt-2 text-xs text-gray-400">
					Check server gateway configuration and restart the application.
				</p>
				<button
					onclick={handleRetry}
					class="mt-3 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
				>
					Retry Connection
				</button>
			</div>
		{:else if connectionState === 'disconnected'}
			<div class="rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="h-4 w-4 rounded-full bg-gray-500"></div>
					<span class="text-sm text-gray-300">Disconnected from gateway</span>
				</div>
				<button
					onclick={handleRetry}
					class="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
				>
					Retry Connection
				</button>
			</div>
		{/if}

		<!-- What is device pairing? -->
		<details class="rounded-xl border border-gray-800 bg-gray-900/60">
			<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-300 hover:text-white">
				What is device pairing?
			</summary>
			<div class="px-4 pb-3 text-xs leading-relaxed text-gray-400">
				<p>
					Device pairing ensures only authorized devices can connect to your gateway. When you
					connect for the first time, the gateway requires approval.
				</p>
				<p class="mt-2">
					To approve this device, run <code
						class="rounded bg-gray-800 px-1 py-0.5 font-mono text-teal-300"
						>openclaw devices approve</code
					> in your terminal, or ask your agent to approve it.
				</p>
			</div>
		</details>
	</div>
</div>
