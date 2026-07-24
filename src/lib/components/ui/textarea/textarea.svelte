<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...restProps
	}: WithElementRef<HTMLTextareaAttributes, HTMLTextAreaElement> = $props();
</script>

<textarea
	bind:this={ref}
	bind:value
	data-slot="textarea"
	class={cn(
		'falcon-focus touch-target min-h-28 w-full resize-y rounded-[var(--md-sys-shape-corner-small)] border border-outline-variant bg-surface-container px-3 py-2 text-[length:var(--text-body)] text-on-surface placeholder:text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
		className
	)}
	{...restProps}
></textarea>
