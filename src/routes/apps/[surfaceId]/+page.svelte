<script lang="ts">
	import { page } from '$app/stores';
	import { canvasStore } from '$lib/stores/gateway.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import { pinnedApps, unpinApp, isPinned } from '$lib/stores/pinned-apps.js';
	import { isMobile } from '$lib/stores/viewport.js';
	import InlineA2UI from '$lib/components/canvas/InlineA2UI.svelte';

	const surfaceId = $derived($page.params.surfaceId ?? '');
	let surface = $state<CanvasSurface | null>(null);
	let loadingTimedOut = $state(false);
	let confirmingUnpin = $state(false);
	let mobile = $state(false);

	$effect(() => {
		const unsub = isMobile.subscribe((v) => {
			mobile = v;
		});
		return unsub;
	});

	$effect(() => {
		if (!surfaceId) return;
		const unsub = canvasStore.surfaces.subscribe((surfaces) => {
			surface = surfaces.get(surfaceId) ?? null;
		});
		return unsub;
	});

	$effect(() => {
		if (surface && surface.messages.length === 0) {
			loadingTimedOut = false;
			const timer = setTimeout(() => {
				loadingTimedOut = true;
			}, 10_000);
			return () => clearTimeout(timer);
		}
	});

	let pinned = $derived(surfaceId ? isPinned(surfaceId, $pinnedApps) : false);

	function handleUnpin() {
		if (!confirmingUnpin) {
			confirmingUnpin = true;
			return;
		}
		if (surfaceId) unpinApp(surfaceId);
		confirmingUnpin = false;
	}

	function cancelUnpin() {
		confirmingUnpin = false;
	}
</script>

{#if mobile}
	<div class="flex h-full flex-col items-center justify-center bg-gray-950 px-6 text-center">
		<svg
			class="mb-4 h-12 w-12 text-gray-600"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
			/>
		</svg>
		<h2 class="text-lg font-semibold text-white">Desktop Only</h2>
		<p class="mt-2 text-sm text-gray-400">
			Canvas apps require a desktop browser for the best experience.
		</p>
	</div>
{:else if surface && surface.messages.length > 0}
	<div class="flex h-full flex-col p-4">
		<div class="mb-4 flex items-center gap-3">
			<h1 class="text-lg font-semibold text-white">{surface.title}</h1>
			{#if pinned}
				{#if confirmingUnpin}
					<span class="text-xs text-gray-400">Remove from sidebar?</span>
					<button
						class="rounded bg-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-900"
						onclick={handleUnpin}
					>
						Remove
					</button>
					<button
						class="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
						onclick={cancelUnpin}
					>
						Cancel
					</button>
				{:else}
					<button
						class="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
						onclick={handleUnpin}
					>
						Unpin
					</button>
				{/if}
			{/if}
		</div>
		<div class="flex-1 overflow-auto">
			<InlineA2UI messages={surface.messages} />
		</div>
	</div>
{:else if surface && loadingTimedOut}
	<div class="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
		<span>No canvas content received.</span>
		<span class="text-sm text-gray-500"
			>The agent created this surface but hasn't sent any content yet.</span
		>
	</div>
{:else if surface}
	<div class="flex h-full items-center justify-center">
		<div class="flex items-center gap-2 text-gray-400">
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-400"
			></div>
			<span>Loading canvas...</span>
		</div>
	</div>
{:else}
	<div class="flex h-full items-center justify-center text-gray-500">
		Surface not found. It may have been cleared or the gateway was restarted.
	</div>
{/if}
