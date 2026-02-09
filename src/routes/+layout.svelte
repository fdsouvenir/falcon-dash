<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MobileTabBar from '$lib/components/MobileTabBar.svelte';
	import MobileMoreMenu from '$lib/components/MobileMoreMenu.svelte';
	import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
	import { OnboardingWizard } from '$lib/components/onboarding';
	import { sessions } from '$lib/stores';
	import { initOfflineListeners } from '$lib/stores/offline';
	import { initTheme, destroyTheme } from '$lib/stores/theme';
	import { updateTabTitle, showNotification } from '$lib/services/notifications';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	let sidebarOpen = $state(false);
	let moreMenuOpen = $state(false);
	let showOnboarding = $state(false);

	let totalUnread = $derived([...$sessions.values()].reduce((sum, s) => sum + s.unreadCount, 0));

	// Update tab title with unread count
	$effect(() => {
		updateTabTitle(totalUnread);
	});

	onMount(() => {
		initOfflineListeners();
		initTheme();

		// Show onboarding wizard on first visit
		try {
			const completed = localStorage.getItem('falcon-dash:onboarding-completed');
			const hasUrl = localStorage.getItem('falcon-dash:gateway-url');
			if (completed !== 'true' && !hasUrl) {
				showOnboarding = true;
			}
		} catch {
			// localStorage unavailable
		}
	});

	onDestroy(() => {
		destroyTheme();
	});

	function handleOnboardingComplete() {
		showOnboarding = false;
		goto('/chat');
	}

	function handleOnboardingSkip() {
		showOnboarding = false;
	}

	// Notify on unread count increase (when tab is not focused)
	let prevUnread = $state(0);
	$effect(() => {
		if (totalUnread > prevUnread && prevUnread >= 0) {
			const diff = totalUnread - prevUnread;
			if (diff > 0 && prevUnread > 0) {
				showNotification('Falcon Dash', {
					body: `${diff} new message${diff > 1 ? 's' : ''}`,
					tag: 'unread-messages'
				});
			}
		}
		prevUnread = totalUnread;
	});

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeSidebar() {
		sidebarOpen = false;
	}

	function handleMore() {
		moreMenuOpen = true;
	}

	function closeMoreMenu() {
		moreMenuOpen = false;
	}
</script>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
	>Skip to main content</a
>

<OfflineIndicator />

<div class="flex h-screen bg-slate-900 text-slate-100">
	<!-- Mobile sidebar overlay -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40 bg-black/50 md:hidden" onclick={closeSidebar}></div>
	{/if}

	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-700 bg-slate-800 transition-transform md:static md:translate-x-0"
		class:translate-x-0={sidebarOpen}
		class:-translate-x-full={!sidebarOpen}
		aria-label="Main sidebar navigation"
	>
		<Sidebar />
	</aside>

	<!-- Main content area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Mobile header -->
		<header class="flex h-14 items-center border-b border-slate-700 px-4 md:hidden">
			<button
				onclick={toggleSidebar}
				class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-slate-100"
				aria-label="Toggle sidebar"
			>
				<svg
					class="h-6 w-6"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>
			<span class="ml-3 text-lg font-semibold">falcon-dash</span>
		</header>

		<!-- Page content -->
		<main class="flex-1 overflow-y-auto pb-14 md:pb-0" id="main-content">
			{@render children?.()}
		</main>
	</div>

	<!-- Mobile bottom tab bar -->
	<MobileTabBar {totalUnread} onmore={handleMore} />

	<!-- Mobile "More" menu -->
	<MobileMoreMenu open={moreMenuOpen} onclose={closeMoreMenu} />
</div>

{#if showOnboarding}
	<OnboardingWizard on:complete={handleOnboardingComplete} on:skip={handleOnboardingSkip} />
{/if}
