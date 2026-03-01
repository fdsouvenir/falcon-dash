<script lang="ts">
	import '../app.css';
	import { gatewayEvents } from '$lib/gateway-api.js';
	import {
		subscribeToNotificationEvents,
		unsubscribeFromNotificationEvents
	} from '$lib/stores/notifications.js';
	import {
		subscribeToApprovalEvents,
		unsubscribeFromApprovalEvents
	} from '$lib/stores/exec-approvals.js';
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

			// Clean up stale localStorage keys from removed features
			for (const key of [
				'falcon-dash:channels',
				'falcon-dash:activeChannelId',
				'falcon-dash:activeSessionKey',
				'falcon-dash:pinnedSessions',
				'falcon-dash:gateway-token',
				'falcon-dash:gateway-url'
			]) {
				localStorage.removeItem(key);
			}
		}
	});

	// Connect to gateway SSE stream
	$effect(() => {
		if (browser) {
			gatewayEvents.connect();
			return () => gatewayEvents.disconnect();
		}
	});

	// Subscribe to notification/approval events when connected
	$effect(() => {
		const unsub = gatewayEvents.connected.subscribe((connected) => {
			if (connected) {
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

<ToastContainer />
<InstallPrompt />
