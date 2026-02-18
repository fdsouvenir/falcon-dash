<script lang="ts">
	import { connection, connectToGateway, pairingState } from '$lib/stores/gateway.js';
	import { gatewayToken, gatewayUrl } from '$lib/stores/token.js';
	import type { ConnectionState } from '$lib/gateway/types.js';
	import type { PairingState } from '$lib/stores/gateway.js';

	let connectionState = $state<ConnectionState>('DISCONNECTED');
	let pairing = $state<PairingState>({ status: 'idle', retryCount: 0, maxRetries: 10 });

	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = pairingState.subscribe((s) => {
			pairing = s;
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
			class="flex flex-wrap items-center justify-between gap-3 border-b border-red-900/50 bg-red-950/80 px-4 py-2.5 text-sm text-red-200"
		>
			<span>Authentication failed. Your token may be invalid or expired.</span>
			<button
				class="min-h-[44px] min-w-[44px] shrink-0 rounded bg-red-800 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
				onclick={handleReenterToken}
			>
				Re-enter Token
			</button>
		</div>
	{:else if connectionState === 'PAIRING_REQUIRED'}
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-b border-yellow-900/50 bg-yellow-950/80 px-4 py-2.5 text-sm text-yellow-200"
		>
			<div>
				<span>Device pairing required.</span>
				{#if pairing.status === 'waiting'}
					<span class="ml-1 text-yellow-300"
						>Retrying ({pairing.retryCount}/{pairing.maxRetries})...</span
					>
				{:else if pairing.status === 'timeout'}
					<span class="ml-1 text-red-300">Retries exhausted.</span>
				{/if}
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
