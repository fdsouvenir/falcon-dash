<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { activeSessionKey } from '$lib/stores/sessions.js';
	import { mobileChatOpen, openMobileChat, closeMobileChat } from '$lib/stores/mobile-chat-nav.js';
	import MobileHeader from './MobileHeader.svelte';
	import BottomTabBar from './BottomTabBar.svelte';
	import BottomSheet from './BottomSheet.svelte';
	import MoreSheet from './MoreSheet.svelte';
	import ChatList from '$lib/components/ChatList.svelte';
	import ChatView from '$lib/components/ChatView.svelte';
	import ConnectionErrorBanner from '$lib/components/ConnectionErrorBanner.svelte';

	let { children }: { children: Snippet } = $props();

	let moreOpen = $state(false);
	let chatOpen = $state(false);
	let pathname = $state('/');
	let activeKey = $state<string | null>(null);

	$effect(() => {
		const unsub = page.subscribe((p) => {
			pathname = p.url.pathname;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = mobileChatOpen.subscribe((v) => {
			chatOpen = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			activeKey = v;
		});
		return unsub;
	});

	// Auto-close panel if active session is deleted
	$effect(() => {
		if (chatOpen && activeKey === null) {
			closeMobileChat();
		}
	});

	// Browser back gesture support
	$effect(() => {
		if (typeof window === 'undefined') return;
		function handlePopState() {
			if (chatOpen) {
				// Don't push another history entry — just close
				closeMobileChat();
			}
		}

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	});

	let isChatRoute = $derived(pathname === '/');

	function handleBack() {
		// Pop the history entry we pushed in openMobileChat
		if (typeof window !== 'undefined') {
			history.back();
		}
	}
</script>

<div class="flex h-screen flex-col bg-gray-950 text-white" style="height: 100dvh">
	<MobileHeader chatOpen={isChatRoute && chatOpen} onBack={handleBack} />

	{#if isChatRoute}
		<!-- Chat route: two-panel slide architecture -->
		<ConnectionErrorBanner />
		<div class="relative flex-1 overflow-hidden">
			<!-- Base layer: ChatList -->
			<div class="absolute inset-0 overflow-y-auto">
				<ChatList onselect={() => openMobileChat()} />
			</div>

			<!-- Overlay layer: ChatView (slides in from right) -->
			<div
				class="mobile-chat-panel absolute inset-0 bg-gray-950 transition-transform duration-300 ease-in-out"
				class:translate-x-0={chatOpen}
				class:translate-x-full={!chatOpen}
			>
				{#if activeKey}
					<ChatView />
				{/if}
			</div>
		</div>
	{:else}
		<!-- Non-chat routes: render children normally -->
		<main class="flex-1 overflow-y-auto">
			<ConnectionErrorBanner />
			{@render children()}
		</main>
	{/if}

	<BottomTabBar onmore={() => (moreOpen = true)} hidden={isChatRoute && chatOpen} />

	<BottomSheet open={moreOpen} onclose={() => (moreOpen = false)}>
		<MoreSheet />
	</BottomSheet>
</div>
