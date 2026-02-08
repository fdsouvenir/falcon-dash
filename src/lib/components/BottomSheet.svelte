<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';

	export let open = false;
	export let title = '';

	const dispatch = createEventDispatcher<{ close: void }>();

	function close() {
		dispatch('close');
	}

	function handleBackdropClick() {
		close();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/50"
		on:click={handleBackdropClick}
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Panel -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-slate-800"
		role="dialog"
		aria-modal="true"
		aria-label={title || 'Bottom sheet'}
		transition:fly={{ y: 300, duration: 200 }}
	>
		<!-- Drag handle -->
		<div class="flex flex-shrink-0 flex-col items-center px-4 pb-2 pt-3">
			<div class="mb-2 h-1 w-12 rounded-full bg-slate-600"></div>
			{#if title}
				<h3 class="text-sm font-semibold text-slate-200">{title}</h3>
			{/if}
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-4 pb-4">
			<slot />
		</div>
	</div>
{/if}
