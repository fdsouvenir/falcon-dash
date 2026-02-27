<script lang="ts">
	import '../app.css';
	import { gatewayToken, gatewayUrl } from '$lib/stores/token.js';
	import { connection, connectToGateway } from '$lib/stores/gateway.js';
	import {
		subscribeToNotificationEvents,
		unsubscribeFromNotificationEvents
	} from '$lib/stores/notifications.js';
	import {
		subscribeToApprovalEvents,
		unsubscribeFromApprovalEvents
	} from '$lib/stores/exec-approvals.js';
	import TokenEntry from '$lib/components/TokenEntry.svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import MobileShell from '$lib/components/mobile/MobileShell.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import ConnectionErrorBanner from '$lib/components/ConnectionErrorBanner.svelte';
	import { isMobile } from '$lib/stores/viewport.js';
	import {
		registerServiceWorker,
		listenForInstallPrompt
	} from '$lib/pwa/service-worker-registration.js';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import { browser } from '$app/environment';
	import { measureWebVitals } from '$lib/performance/web-vitals.js';
	import { preloadHighlighter } from '$lib/utils/highlighter.js';

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

	$effect(() => {
		if (browser) {
			registerServiceWorker();
			listenForInstallPrompt();
			measureWebVitals();
			preloadHighlighter();

			// Clean up stale localStorage keys from removed chat feature
			for (const key of [
				'falcon-dash:channels',
				'falcon-dash:activeChannelId',
				'falcon-dash:activeSessionKey',
				'falcon-dash:pinnedSessions'
			]) {
				localStorage.removeItem(key);
			}
		}
	});

	$effect(() => {
		const unsub = gatewayToken.subscribe((v) => {
			token = v;
		});
		return unsub;
	});

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
				// Config file unavailable
			})
			.finally(() => {
				loading = false;
			});
	});

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

	$effect(() => {
		const unsub = connection.state.subscribe((state) => {
			if (state === 'READY') {
				subscribeToNotificationEvents();
				subscribeToApprovalEvents();
			}
		});
		return () => {
			unsub();
			unsubscribeFromNotificationEvents();
			unsubscribeFromApprovalEvents();
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
<InstallPrompt />
