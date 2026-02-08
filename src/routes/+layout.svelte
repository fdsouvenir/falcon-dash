<script>
	import '../app.css';

	let sidebarOpen = false;

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeSidebar() {
		sidebarOpen = false;
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
		<!-- Logo -->
		<div class="flex h-14 items-center border-b border-slate-700 px-4">
			<span class="text-lg font-semibold text-slate-100">falcon-dash</span>
		</div>

		<!-- Channels section -->
		<div class="flex-1 overflow-y-auto px-3 py-4">
			<h3 class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
				Channels
			</h3>
			<ul class="space-y-1">
				<li>
					<span class="block rounded px-2 py-1.5 text-sm text-slate-400">No channels yet</span>
				</li>
			</ul>

			<!-- Apps section -->
			<h3 class="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
				Apps
			</h3>
			<ul class="space-y-1">
				<li>
					<a
						href="/projects"
						class="block rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
					>
						Projects
					</a>
				</li>
				<li>
					<a
						href="/files"
						class="block rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
					>
						Files
					</a>
				</li>
				<li>
					<a
						href="/jobs"
						class="block rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
					>
						Agent Jobs
					</a>
				</li>
			</ul>
		</div>

		<!-- Sidebar footer -->
		<div class="border-t border-slate-700 px-3 py-3">
			<ul class="space-y-1">
				<li>
					<a
						href="/settings"
						class="block rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
					>
						Settings
					</a>
				</li>
				<li>
					<a
						href="/passwords"
						class="block rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
					>
						Passwords
					</a>
				</li>
			</ul>
		</div>
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
		<main class="flex-1 overflow-y-auto">
			<slot />
		</main>
	</div>
</div>
