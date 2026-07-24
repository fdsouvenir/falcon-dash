<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type ValueInputType =
		| 'text'
		| 'search'
		| 'email'
		| 'password'
		| 'tel'
		| 'url'
		| 'number'
		| 'range'
		| 'date'
		| 'datetime-local'
		| 'month'
		| 'week'
		| 'time'
		| 'color'
		| 'hidden';

	type InputProps = WithElementRef<
		Omit<HTMLInputAttributes, 'type' | 'value'> & {
			type?: ValueInputType;
			value?: string | number;
		},
		HTMLInputElement
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...restProps
	}: InputProps = $props();
</script>

<input
	bind:this={ref}
	bind:value
	data-slot="input"
	class={cn(
		'falcon-focus touch-target w-full rounded-[var(--md-sys-shape-corner-small)] border border-outline-variant bg-surface-container px-3 py-2 text-[length:var(--text-body)] text-on-surface placeholder:text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
		className
	)}
	{...restProps}
/>
