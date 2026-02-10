<script lang="ts">
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import ChatList from './ChatList.svelte';

	let { collapsed = false, onToggle }: { collapsed: boolean; onToggle: () => void } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- routes will be created in later stories -->
<aside
	class="flex h-full w-64 flex-col border-r border-gray-800 bg-gray-900 transition-transform duration-200 {collapsed
		? '-translate-x-full'
		: 'translate-x-0'} fixed inset-y-0 left-0 z-40 md:relative md:translate-x-0"
>
	<!-- Header -->
	<div class="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
		<ConnectionStatus />
		<span class="text-sm font-semibold text-white">Falcon Dashboard</span>
		<button
			class="ml-auto text-gray-400 hover:text-white md:hidden"
			onclick={onToggle}
			aria-label="Close sidebar"
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

	<!-- Scrollable content -->
	<nav class="flex flex-1 flex-col overflow-y-auto">
		<!-- Chats section -->
		<div class="px-3 py-3">
			<h2 class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Chats</h2>
			<ChatList />
		</div>

		<!-- Apps section -->
		<div class="px-3 py-3">
			<h2 class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Apps</h2>
			<a
				href="/projects"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
				Projects
			</a>
			<a
				href="/documents"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
					/>
				</svg>
				Documents
			</a>
			<a
				href="/jobs"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				Agent Jobs
			</a>
		</div>
	</nav>

	<!-- Bottom section -->
	<div class="border-t border-gray-800 px-3 py-3">
		<a
			href="/settings"
			class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
			Settings
		</a>
		<a
			href="/passwords"
			class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
			Passwords
		</a>
	</div>
</aside>
