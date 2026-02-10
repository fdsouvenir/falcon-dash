<script lang="ts">
	import Sidebar from './Sidebar.svelte';

	let { children }: { children: import('svelte').Snippet } = $props();
	let sidebarCollapsed = $state(false);

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}
</script>

<div class="flex h-screen bg-gray-950 text-white">
	<Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

	<!-- Mobile overlay -->
	{#if !sidebarCollapsed}
		<button
			class="fixed inset-0 z-30 bg-black/50 md:hidden"
			onclick={toggleSidebar}
			aria-label="Close sidebar"
		></button>
	{/if}

	<!-- Main content -->
	<main class="flex flex-1 flex-col overflow-hidden">
		<!-- Mobile header with menu button -->
		<header class="flex items-center border-b border-gray-800 px-4 py-2 md:hidden">
			<button
				class="text-gray-400 hover:text-white"
				onclick={toggleSidebar}
				aria-label="Open sidebar"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>
			<span class="ml-3 text-sm font-semibold">Falcon Dashboard</span>
		</header>

		<div class="flex-1 overflow-y-auto">
			{@render children()}
		</div>
	</main>
</div>
