<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Props {
		label: string;
		value: number | string;
		/** Accepted for API compatibility; the signal-cell layout does not render it. */
		description?: string;
		breakdown?: string;
		href?: string;
		tone?: 'active' | 'warning' | 'danger' | 'info' | 'muted' | 'purple' | 'primary';
		/** Set when the tile sits inside a shared divided panel (no own border). */
		bare?: boolean;
	}

	let { label, value, description, breakdown, href, tone = 'info', bare = false }: Props = $props();
	void description;

	const accentClass = $derived(
		{
			active: 'bg-status-active',
			warning: 'bg-status-warning',
			danger: 'bg-status-danger',
			info: 'bg-status-info',
			muted: 'bg-status-muted',
			purple: 'bg-status-purple',
			primary: 'bg-primary'
		}[tone]
	);
	const valueClass = $derived(
		{
			active: 'text-status-active',
			warning: 'text-status-warning',
			danger: 'text-status-danger',
			info: 'text-status-info',
			muted: 'text-on-surface',
			purple: 'text-status-purple',
			primary: 'text-on-surface'
		}[tone]
	);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	data-work-stat-tile
	class={cn(
		'group relative block min-h-28 p-4 shadow-none',
		!bare &&
			'overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container',
		href && 'falcon-focus touch-target hover:bg-surface-container-high/50'
	)}
>
	<span class="absolute inset-x-0 top-0 h-0.5 {accentClass}" aria-hidden="true"></span>
	<div class="flex items-baseline justify-between gap-4">
		<p class="text-[length:var(--text-body)] font-semibold text-on-surface">{label}</p>
		<p class="text-3xl font-semibold leading-none tabular-nums {valueClass}">{value}</p>
	</div>
	{#if breakdown}
		<p class="mt-3 text-[length:var(--text-body)] leading-6 text-on-surface-variant">{breakdown}</p>
	{/if}
</svelte:element>
