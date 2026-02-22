<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface ShimmerProps {
		children: Snippet;
		as?: string;
		class?: string;
		duration?: number;
		spread?: number;
		content_length?: number;
		[key: string]: unknown;
	}

	let {
		children,
		as = 'p',
		class: className,
		duration = 2,
		spread = 2,
		content_length = 30,
		...rest
	}: ShimmerProps = $props();

	let dynamicSpread = $derived(content_length * spread);
</script>

<svelte:element
	this={as}
	class={cn(
		'relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent',
		'[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))]',
		'animate-shimmer',
		className
	)}
	style="--spread: {dynamicSpread}px; --shimmer-duration: {duration}s; background-image: var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground)); background-position: 100% center;"
	{...rest}
>
	{@render children()}
</svelte:element>

<style>
	@keyframes shimmer {
		from {
			background-position: 100% center;
		}
		to {
			background-position: 0% center;
		}
	}

	:global(.animate-shimmer) {
		animation: shimmer var(--shimmer-duration, 2s) linear infinite;
	}
</style>
