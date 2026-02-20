<script lang="ts">
	import { goto } from '$app/navigation';
	import { settingsNavGroups, type SettingsNavItem } from './settings/settings-nav-items.js';
	import { gatewayToken } from '$lib/stores/token.js';

	let { onnavigate }: { onnavigate: (id: string) => void } = $props();

	function handleTap(item: SettingsNavItem) {
		if (item.id === 'cron') {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- static route
			goto('/jobs');
		} else if (item.id === 'disconnect') {
			gatewayToken.clear();
		} else if (item.id === 'logout') {
			window.location.href = '/cdn-cgi/access/logout';
		} else {
			onnavigate(item.id);
		}
	}
</script>

<div class="flex h-full flex-col bg-gray-950">
	<div class="flex-1 overflow-y-auto pb-[calc(1rem+var(--safe-bottom))]">
		{#each settingsNavGroups as group (group.label)}
			<div class="px-4 pt-4">
				<h2 class="mb-2 text-xs font-semibold tracking-wider text-gray-500">{group.label}</h2>
				<div class="overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
					{#each group.items as item, i (item.id)}
						{#if i > 0}
							<div class="border-t border-gray-800"></div>
						{/if}
						<button
							onclick={() => handleTap(item)}
							class="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-800"
						>
							<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-800">
								<svg
									class="h-4 w-4 text-gray-300"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d={item.iconPath} />
								</svg>
							</div>
							<div class="flex-1">
								<div class="text-sm font-medium text-white">{item.title}</div>
								<div class="text-xs text-gray-500">{item.subtitle}</div>
							</div>
							<svg
								class="h-4 w-4 text-gray-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
