<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	class={cn(
		'bg-surface-container text-on-surface flex flex-col gap-5 rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 py-5 shadow-none',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
