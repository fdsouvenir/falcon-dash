<script lang="ts">
	import { isOffline, offlineQueue } from '$lib/stores/offline';
	import { slide } from 'svelte/transition';

	let queueCount = $derived($offlineQueue.length);
</script>

{#if $isOffline}
	<div
		transition:slide={{ duration: 300 }}
		class="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
		role="alert"
		aria-live="assertive"
	>
		<svg
			class="h-4 w-4 flex-shrink-0"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 4h.01"
			/>
		</svg>
		<span>You're offline — viewing cached data</span>
		{#if queueCount > 0}
			<span class="rounded-full bg-amber-800 px-2 py-0.5 text-xs">
				{queueCount} pending {queueCount === 1 ? 'action' : 'actions'}
			</span>
		{/if}
	</div>
{/if}
