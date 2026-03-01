<script lang="ts">
	import { gatewayEvents } from '$lib/gateway-api.js';

	let connectionState = $state<string>('disconnected');

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	function handleRetryConnection() {
		// Server-side SSE reconnects automatically; force by reconnecting the EventSource
		gatewayEvents.disconnect();
		gatewayEvents.connect();
	}

	let visible = $derived(
		connectionState === 'auth_failed' || connectionState === 'pairing_required'
	);
</script>

{#if visible}
	{#if connectionState === 'auth_failed'}
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-b border-red-900/50 bg-red-950/80 px-4 py-2.5 text-sm text-red-200"
		>
			<span>Authentication failed. Check server gateway configuration.</span>
			<button
				class="min-h-[44px] min-w-[44px] shrink-0 rounded bg-red-800 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
				onclick={handleRetryConnection}
			>
				Retry
			</button>
		</div>
	{:else if connectionState === 'pairing_required'}
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-b border-yellow-900/50 bg-yellow-950/80 px-4 py-2.5 text-sm text-yellow-200"
		>
			<div>
				<span>Device pairing required.</span>
				<span class="ml-1 text-xs text-yellow-200/70">
					Run <code class="font-mono">openclaw devices approve</code> to approve.
				</span>
			</div>
			<button
				class="min-h-[44px] min-w-[44px] shrink-0 rounded bg-yellow-800 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-yellow-700"
				onclick={handleRetryConnection}
			>
				Retry Connection
			</button>
		</div>
	{/if}
{/if}
