<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';

	export let items: unknown[] = [];
	export let itemHeight: number = 60;
	export let buffer: number = 5;
	export let scrollToEnd: boolean = false;

	let viewport: HTMLDivElement;
	let visibleStart = 0;
	let visibleEnd = 0;
	let topOffset = 0;
	let bottomOffset = 0;
	let viewportHeight = 0;
	let prevItemCount = 0;
	let wasAtBottom = true;

	/** Expose viewport element for external use (e.g. pull-to-refresh) */
	export function getViewport(): HTMLDivElement {
		return viewport;
	}

	function isAtBottom(): boolean {
		if (!viewport) return true;
		const threshold = 40;
		return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;
	}

	function update() {
		if (!viewport) return;

		viewportHeight = viewport.clientHeight;
		const scrollTop = viewport.scrollTop;
		const totalHeight = items.length * itemHeight;

		const rawStart = Math.floor(scrollTop / itemHeight);
		const rawEnd = Math.ceil((scrollTop + viewportHeight) / itemHeight);

		visibleStart = Math.max(0, rawStart - buffer);
		visibleEnd = Math.min(items.length, rawEnd + buffer);

		topOffset = visibleStart * itemHeight;
		bottomOffset = Math.max(0, totalHeight - visibleEnd * itemHeight);
	}

	function handleScroll() {
		wasAtBottom = isAtBottom();
		update();
	}

	onMount(() => {
		update();
		if (scrollToEnd && viewport) {
			viewport.scrollTop = viewport.scrollHeight;
		}
	});

	afterUpdate(() => {
		if (items.length !== prevItemCount) {
			if (scrollToEnd && wasAtBottom) {
				requestAnimationFrame(() => {
					if (viewport) {
						viewport.scrollTop = viewport.scrollHeight;
					}
				});
			}
			prevItemCount = items.length;
		}
		update();
	});

	$: visibleItems = items.slice(visibleStart, visibleEnd);
	$: if (items) update();
</script>

<div class="flex-1 overflow-y-auto" bind:this={viewport} on:scroll={handleScroll}>
	<div style="padding-top: {topOffset}px; padding-bottom: {bottomOffset}px;">
		{#each visibleItems as item, i (visibleStart + i)}
			<slot {item} index={visibleStart + i} />
		{/each}
	</div>
</div>
