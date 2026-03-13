<script lang="ts">
	import { pinnedApps, type PinnedApp } from '$lib/stores/pinned-apps.js';

	let { onclose }: { onclose?: () => void } = $props();

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
	<h3 class="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-status-muted">
		Navigate
	</h3>
	<a
		href="/ops"
		onclick={onclose}
		class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-surface-2"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
			/>
		</svg>
		<span class="truncate">Ops</span>
	</a>
	<a
		href="/skills"
		onclick={onclose}
		class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-surface-2"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M11.42 15.17l-5.384 3.18.64-5.94L2 7.862l5.96-.514L11.42 2l3.46 5.348L20.84 7.862l-4.676 4.548.64 5.94z"
			/>
		</svg>
		<span class="truncate">Skills</span>
	</a>
	<a
		href="/passwords"
		onclick={onclose}
		class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-surface-2"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
			/>
		</svg>
		<span class="truncate">Passwords</span>
	</a>
	<a
		href="/secrets"
		onclick={onclose}
		class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-surface-2"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
			/>
		</svg>
		<span class="truncate">Secrets</span>
	</a>

	{#if apps.length > 0}
		<h3 class="mb-1 mt-3 px-2 text-xs font-semibold uppercase tracking-wider text-status-muted">
			Custom Apps
		</h3>
		{#each apps as app (app.id)}
			<a
				href="/apps/{app.surfaceId}"
				onclick={onclose}
				class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-surface-2"
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
