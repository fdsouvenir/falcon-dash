<script lang="ts">
	import '../app.css';
	import { gatewayToken, gatewayUrl } from '$lib/stores/token.js';
	import { connectToGateway } from '$lib/stores/gateway.js';
	import TokenEntry from '$lib/components/TokenEntry.svelte';

	let { children } = $props();

	let token: string | null = $state(null);
	let hasToken = $derived(token !== null);

	$effect(() => {
		const unsub = gatewayToken.subscribe((v) => {
			token = v;
		});
		return unsub;
	});

	// Auto-connect when token becomes available
	$effect(() => {
		if (token) {
			let url = 'ws://127.0.0.1:18789';
			const unsub = gatewayUrl.subscribe((v) => {
				url = v;
			});
			unsub();
			connectToGateway(url, token);
		}
	});
</script>

{#if hasToken}
	{@render children()}
{:else}
	<TokenEntry />
{/if}
