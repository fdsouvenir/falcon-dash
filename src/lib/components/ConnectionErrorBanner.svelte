<script lang="ts">
	import { connection, connectToGateway } from '$lib/stores/gateway.js';
	import { gatewayToken, gatewayUrl } from '$lib/stores/token.js';
	import type { ConnectionState } from '$lib/gateway/types.js';

	let connectionState = $state<ConnectionState>('DISCONNECTED');

	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	function handleReenterToken() {
		gatewayToken.clear();
	}

	function handleRetryConnection() {
		let url = 'ws://127.0.0.1:18789';
		let token: string | null = null;
		const unsubUrl = gatewayUrl.subscribe((v) => {
			url = v;
		});
		const unsubToken = gatewayToken.subscribe((v) => {
			token = v;
		});
		unsubUrl();
		unsubToken();
		if (token) {
			connectToGateway(url, token);
		}
	}

	let visible = $derived(
		connectionState === 'AUTH_FAILED' || connectionState === 'PAIRING_REQUIRED'
	);
</script>

{#if visible}
	{#if connectionState === 'AUTH_FAILED'}
		<div
			class="flex items-center justify-between gap-3 border-b border-red-900/50 bg-red-950/80 px-4 py-2.5 text-sm text-red-200"
		>
			<span>Authentication failed. Your token may be invalid or expired.</span>
			<button
				class="shrink-0 rounded bg-red-800 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
				onclick={handleReenterToken}
			>
				Re-enter Token
			</button>
		</div>
	{:else if connectionState === 'PAIRING_REQUIRED'}
		<div
			class="flex items-center justify-between gap-3 border-b border-yellow-900/50 bg-yellow-950/80 px-4 py-2.5 text-sm text-yellow-200"
		>
			<span>Device pairing required. Approve this device in the gateway admin.</span>
			<button
				class="shrink-0 rounded bg-yellow-800 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700 transition-colors"
				onclick={handleRetryConnection}
			>
				Retry Connection
			</button>
		</div>
	{/if}
{/if}
