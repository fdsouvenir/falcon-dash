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
	import AgentRail from './AgentRail.svelte';
	import MobileNotificationSheet from './MobileNotificationSheet.svelte';
	import ThreadList from '$lib/components/ThreadList.svelte';
	import MobileChatSettings from './MobileChatSettings.svelte';
	import { loadThreads } from '$lib/stores/threads.js';
	import ExecApprovalPrompt from '$lib/components/ExecApprovalPrompt.svelte';
	import { pendingApprovals, resolveApproval, addToDenylist } from '$lib/stores/exec-approvals.js';
	import type { PendingApproval } from '$lib/stores/exec-approvals.js';

	let { children }: { children: Snippet } = $props();

	let moreOpen = $state(false);
	let notificationsOpen = $state(false);
	let threadsOpen = $state(false);
	let showMobileSettings = $state(false);
	let chatOpen = $state(false);
	let pathname = $state('/');
	let activeKey = $state<string | null>(null);
	let approvals = $state<PendingApproval[]>([]);
	let approvalsSheetOpen = $derived(approvals.length > 0);

	$effect(() => {
		const unsub = pendingApprovals.subscribe((v) => {
			approvals = v;
		});
		return unsub;
	});

	function handleResolve(requestId: string, decision: 'allow-once' | 'allow-always' | 'deny') {
		resolveApproval(requestId, decision).catch(() => {});
	}

	function handleAlwaysDeny(requestId: string, command: string) {
		addToDenylist(command);
		resolveApproval(requestId, 'deny').catch(() => {});
	}

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

	// Close settings when chat panel closes
	$effect(() => {
		if (!chatOpen) {
			showMobileSettings = false;
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

	function handleThreads() {
		if (activeKey) {
			loadThreads(activeKey).catch(() => {});
		}
		threadsOpen = true;
	}
</script>

<div class="flex h-screen flex-col bg-gray-950 text-white" style="height: 100dvh">
	<MobileHeader
		chatOpen={isChatRoute && chatOpen}
		settingsOpen={showMobileSettings}
		onBack={handleBack}
		onNotifications={() => (notificationsOpen = true)}
		onThreads={handleThreads}
		onSettingsToggle={() => (showMobileSettings = !showMobileSettings)}
	/>

	{#if isChatRoute}
		<!-- Chat route: two-panel slide architecture -->
		<ConnectionErrorBanner />
		<MobileChatSettings open={showMobileSettings} />
		<div class="relative flex-1 overflow-hidden">
			<!-- Base layer: AgentRail + ChatList -->
			<div class="absolute inset-0 flex">
				<AgentRail />
				<div class="flex-1 overflow-y-auto pl-1.5">
					<ChatList variant="mobile" onselect={() => openMobileChat()} />
				</div>
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

	<BottomTabBar onmore={() => (moreOpen = true)} />

	<BottomSheet open={moreOpen} onclose={() => (moreOpen = false)}>
		<MoreSheet />
	</BottomSheet>

	<MobileNotificationSheet open={notificationsOpen} onclose={() => (notificationsOpen = false)} />

	<BottomSheet open={approvalsSheetOpen} onclose={() => {}}>
		{#if approvals.length > 0}
			<ExecApprovalPrompt
				approval={approvals[0]}
				pendingCount={approvals.length}
				onResolve={handleResolve}
				onAlwaysDeny={handleAlwaysDeny}
			/>
		{/if}
	</BottomSheet>

	{#if threadsOpen}
		<div class="fixed inset-0 z-50 flex flex-col bg-gray-950">
			<div class="flex items-center justify-between border-b border-gray-800 px-3 py-2">
				<span class="text-sm font-medium text-white">Threads</span>
				<button
					onclick={() => (threadsOpen = false)}
					class="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
					aria-label="Close threads"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto">
				<ThreadList />
			</div>
		</div>
	{/if}
</div>
