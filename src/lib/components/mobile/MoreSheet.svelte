<script lang="ts">
	import { pinnedApps, type PinnedApp } from '$lib/stores/pinned-apps.js';

	let apps = $state<PinnedApp[]>([]);

	$effect(() => {
		const unsub = pinnedApps.subscribe((v) => {
			apps = v;
		});
		return unsub;
	});
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static local routes -->
<nav class="flex flex-col gap-1 pb-4">
	{#if apps.length > 0}
		<h3 class="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
			Custom Apps
		</h3>
		{#each apps as app (app.id)}
			<a
				href="/apps/{app.surfaceId}"
				class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<path d="M3 9h18" />
					<path d="M9 21V9" />
				</svg>
				<span class="truncate">{app.name}</span>
			</a>
		{/each}
	{/if}
</nav>
