<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MobileTabBar from '$lib/components/MobileTabBar.svelte';
	import MobileMoreMenu from '$lib/components/MobileMoreMenu.svelte';
	import { sessions } from '$lib/stores';

	let sidebarOpen = false;
	let moreMenuOpen = false;

	$: totalUnread = [...$sessions.values()].reduce((sum, s) => sum + s.unreadCount, 0);

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

<div class="flex h-screen bg-slate-900 text-slate-100">
	<!-- Mobile sidebar overlay -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="fixed inset-0 z-40 bg-black/50 md:hidden" on:click={closeSidebar}></div>
	{/if}

	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-700 bg-slate-800 transition-transform md:static md:translate-x-0"
		class:translate-x-0={sidebarOpen}
		class:-translate-x-full={!sidebarOpen}
	>
		<Sidebar />
	</aside>

	<!-- Main content area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Mobile header -->
		<header class="flex h-14 items-center border-b border-slate-700 px-4 md:hidden">
			<button
				on:click={toggleSidebar}
				class="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
				aria-label="Toggle sidebar"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
		<main class="flex-1 overflow-y-auto pb-14 md:pb-0">
			<slot />
		</main>
	</div>

	<!-- Mobile bottom tab bar -->
	<MobileTabBar {totalUnread} on:more={handleMore} />

	<!-- Mobile "More" menu -->
	<MobileMoreMenu open={moreMenuOpen} on:close={closeMoreMenu} />
</div>
