<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Props {
		label: string;
		value: number | string;
		description?: string;
		breakdown?: string;
		href?: string;
		tone?: 'active' | 'warning' | 'danger' | 'info' | 'muted' | 'purple';
	}

	let { label, value, description, breakdown, href, tone = 'info' }: Props = $props();

	const accentClass = $derived(
		{
			active: 'bg-status-active',
			warning: 'bg-status-warning',
			danger: 'bg-status-danger',
			info: 'bg-status-info',
			muted: 'bg-status-muted',
			purple: 'bg-status-purple'
		}[tone]
	);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class={cn(
		'group relative block min-h-32 overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container p-4 shadow-none',
		href && 'falcon-focus touch-target hover:bg-surface-container-high'
	)}
>
	<span class="absolute inset-y-0 left-0 w-1 {accentClass}" aria-hidden="true"></span>
	<p
		class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.13em] text-on-surface-variant"
	>
		{label}
	</p>
	<p class="mt-2 text-3xl font-semibold leading-none text-on-surface">{value}</p>
	{#if breakdown}
		<p class="mt-2 text-[length:var(--text-label)] font-medium text-on-surface">{breakdown}</p>
	{/if}
	{#if description}
		<p class="mt-1 text-[length:var(--text-label)] leading-relaxed text-on-surface-variant">
			{description}
		</p>
	{/if}
</svelte:element>
