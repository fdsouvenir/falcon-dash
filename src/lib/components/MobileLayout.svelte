<script lang="ts">
	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	let activeTab = $state('chat');

	const tabs = [
		{ id: 'chat', label: 'Chat', icon: '💬' },
		{ id: 'projects', label: 'Projects', icon: '📁' },
		{ id: 'docs', label: 'Docs', icon: '📄' },
		{ id: 'jobs', label: 'Jobs', icon: '⚙️' },
		{ id: 'more', label: 'More', icon: '⋯' }
	];

	// TODO: Wire up unread count when sessions store is implemented
	const unreadCount = $state(0);
</script>

<div class="flex h-screen flex-col md:hidden">
	<!-- Main content area -->
	<div class="flex-1 overflow-y-auto pb-16">
		{@render children()}
	</div>

	<!-- Bottom tab bar -->
	<nav
		class="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex h-16 items-center justify-around">
			{#each tabs as tab (tab.id)}
				<button
					class="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 py-2"
					class:text-blue-600={activeTab === tab.id}
					class:dark:text-blue-400={activeTab === tab.id}
					class:text-gray-600={activeTab !== tab.id}
					class:dark:text-gray-400={activeTab !== tab.id}
					onclick={() => (activeTab = tab.id)}
					aria-label={tab.label}
					aria-current={activeTab === tab.id ? 'page' : undefined}
				>
					<span class="relative text-xl">
						{tab.icon}
						{#if tab.id === 'chat' && unreadCount > 0}
							<span
								class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
							>
								{unreadCount}
							</span>
						{/if}
					</span>
					<span class="text-xs">{tab.label}</span>
				</button>
			{/each}
		</div>
	</nav>

	{#if activeTab === 'more'}
		<div class="fixed inset-0 z-50 bg-white dark:bg-gray-900">
			<div
				class="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700"
			>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">More</h2>
				<button
					class="min-h-[44px] min-w-[44px] text-gray-600 dark:text-gray-400"
					onclick={() => (activeTab = 'chat')}
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<div class="divide-y divide-gray-200 dark:divide-gray-700">
				<button
					class="flex w-full min-h-[44px] items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
				>
					<span class="text-xl">⚙️</span>
					<span class="text-gray-900 dark:text-white">Settings</span>
				</button>
				<button
					class="flex w-full min-h-[44px] items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
				>
					<span class="text-xl">🔐</span>
					<span class="text-gray-900 dark:text-white">Passwords</span>
				</button>
				<button
					class="flex w-full min-h-[44px] items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
				>
					<span class="text-xl">🧩</span>
					<span class="text-gray-900 dark:text-white">Custom Apps</span>
				</button>
			</div>
		</div>
	{/if}
</div>
