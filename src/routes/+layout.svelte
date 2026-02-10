<script lang="ts">
	import '../app.css';
	import { gatewayToken, gatewayUrl } from '$lib/stores/token.js';
	import { connection, connectToGateway } from '$lib/stores/gateway.js';
	import {
		ensureGeneralSession,
		subscribeToEvents,
		unsubscribeFromEvents
	} from '$lib/stores/sessions.js';
	import TokenEntry from '$lib/components/TokenEntry.svelte';
	import AppShell from '$lib/components/AppShell.svelte';

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

	// Set up general session and event subscriptions when connection is ready
	$effect(() => {
		const unsub = connection.state.subscribe((state) => {
			if (state === 'READY') {
				ensureGeneralSession();
				subscribeToEvents();
			}
		});
		return () => {
			unsub();
			unsubscribeFromEvents();
		};
	});
</script>

{#if hasToken}
	<AppShell>
		{@render children()}
	</AppShell>
{:else}
	<TokenEntry />
{/if}
