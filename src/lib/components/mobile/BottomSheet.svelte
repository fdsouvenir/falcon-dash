<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		onclose,
		children,
		maxHeight = '80vh'
	}: {
		open: boolean;
		onclose: () => void;
		children: Snippet;
		maxHeight?: string;
	} = $props();

	let sheetEl: HTMLDivElement | undefined = $state();
	let translateY = $state(0);
	let dragging = $state(false);
	let startY = 0;

	function handlePointerDown(e: PointerEvent) {
		dragging = true;
		startY = e.clientY;
		translateY = 0;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dy = e.clientY - startY;
		translateY = Math.max(0, dy);
	}

	function handlePointerUp() {
		if (!dragging) return;
		dragging = false;
		if (sheetEl && translateY > sheetEl.offsetHeight * 0.3) {
			onclose();
		}
		translateY = 0;
	}

	function handleBackdropClick() {
		onclose();
	}

	$effect(() => {
		if (open) {
			document.body.classList.add('sheet-open');
		} else {
			document.body.classList.remove('sheet-open');
		}
		return () => document.body.classList.remove('sheet-open');
	});
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/50"
		onclick={handleBackdropClick}
		role="presentation"
	></div>

	<!-- Sheet -->
	<div
		bind:this={sheetEl}
		class="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-gray-900"
		style="max-height: {maxHeight}; transform: translateY({translateY}px); transition: {dragging
			? 'none'
			: 'transform 0.2s ease-out'};"
	>
		<!-- Drag handle -->
		<div
			class="flex shrink-0 cursor-grab items-center justify-center py-3 active:cursor-grabbing"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			role="presentation"
		>
			<div class="h-1 w-10 rounded-full bg-gray-600"></div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-4 pb-[calc(1rem+var(--safe-bottom))]">
			{@render children()}
		</div>
	</div>
{/if}
