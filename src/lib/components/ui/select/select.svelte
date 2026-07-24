<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLSelectAttributes, HTMLSelectElement> = $props();
</script>

<select
	bind:this={ref}
	bind:value
	data-slot="select"
	class={cn(
		'falcon-focus min-h-11 w-full rounded-[var(--md-sys-shape-corner-small)] border border-outline-variant bg-surface-container px-3 py-2 text-[length:var(--text-body)] text-on-surface disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</select>
