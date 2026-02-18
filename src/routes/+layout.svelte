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
	import MobileShell from '$lib/components/mobile/MobileShell.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import ConnectionErrorBanner from '$lib/components/ConnectionErrorBanner.svelte';
	import { isMobile } from '$lib/stores/viewport.js';

	let { children } = $props();

	let token: string | null = $state(null);
	let loading = $state(true);
	let hasToken = $derived(token !== null);
	let connected = $state(false);
	let mobile = $state(false);

	$effect(() => {
		const unsub = isMobile.subscribe((v) => {
			mobile = v;
		});
		return unsub;
	});

	// Subscribe to token store — picks up changes from config fetch or manual entry
	$effect(() => {
		const unsub = gatewayToken.subscribe((v) => {
			token = v;
		});
		return unsub;
	});

	// Fetch server config first, then mark loading complete.
	// This prevents the auto-connect effect from firing with a stale localStorage token
	// before the server config has been read.
	$effect(() => {
		fetch('/api/gateway-config')
			.then((res) => {
				if (!res.ok) return null;
				return res.json();
			})
			.then((data) => {
				if (data?.token) {
					gatewayToken.set(data.token);
					if (data.url) {
						gatewayUrl.set(data.url);
					}
				}
			})
			.catch(() => {
				// Config file unavailable — fall through to manual entry
			})
			.finally(() => {
				loading = false;
			});
	});

	// Connect ONLY after config fetch completes (loading === false) and we have a token.
	// The `connected` guard ensures we call connectToGateway() exactly once per startup.
	// If the token changes later (e.g. manual re-entry), we reconnect.
	$effect(() => {
		if (!loading && token && !connected) {
			connected = true;
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

{#if loading}
	<div class="flex h-screen items-center justify-center bg-gray-950">
		<div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
	</div>
{:else if hasToken}
	{#if mobile}
		<MobileShell>
			{@render children()}
		</MobileShell>
	{:else}
		<AppShell>
			<ConnectionErrorBanner />
			{@render children()}
		</AppShell>
	{/if}
{:else}
	<TokenEntry />
{/if}

<ToastContainer />
