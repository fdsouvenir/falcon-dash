<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, tick } from 'svelte';

	interface Props {
		items?: unknown[];
		itemHeight?: number;
		buffer?: number;
		scrollToEnd?: boolean;
		children?: Snippet<[{ item: unknown; index: number }]>;
	}
	let { items = [], itemHeight = 60, buffer = 5, scrollToEnd = false, children }: Props = $props();

	let viewport: HTMLDivElement;
	let visibleStart = $state(0);
	let visibleEnd = $state(0);
	let topOffset = $state(0);
	let bottomOffset = $state(0);
	let viewportHeight = $state(0);
	let prevItemCount = $state(0);
	let wasAtBottom = $state(true);

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

	let visibleItems = $derived(items.slice(visibleStart, visibleEnd));

	$effect(() => {
		// Track items.length to re-run when items change
		const len = items.length;
		if (len !== prevItemCount) {
			if (scrollToEnd && wasAtBottom) {
				tick().then(() => {
					if (viewport) {
						viewport.scrollTop = viewport.scrollHeight;
					}
				});
			}
			prevItemCount = len;
		}
		update();
	});
</script>

<div class="flex-1 overflow-y-auto" bind:this={viewport} onscroll={handleScroll}>
	<div style="padding-top: {topOffset}px; padding-bottom: {bottomOffset}px;">
		{#each visibleItems as item, i (visibleStart + i)}
			{@render children?.({ item, index: visibleStart + i })}
		{/each}
	</div>
</div>
