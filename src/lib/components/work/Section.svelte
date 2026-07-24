<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		count?: number;
		description?: string;
		eyebrow?: string;
		accent?: 'default' | 'info' | 'warning' | 'danger' | 'purple';
		id?: string;
		actions?: Snippet;
		children: Snippet;
	}

	let {
		title,
		count,
		description,
		eyebrow,
		accent = 'default',
		id,
		actions,
		children
	}: Props = $props();

	const accentClass = $derived(
		{
			default: 'border-outline-variant/70',
			info: 'border-status-info/45',
			warning: 'border-status-warning/45',
			danger: 'border-status-danger/45',
			purple: 'border-status-purple/45'
		}[accent]
	);
</script>

<section
	{id}
	class="scroll-mt-24 rounded-[var(--md-sys-shape-corner-large)] border bg-surface-container shadow-none {accentClass}"
>
	<div
		class="flex flex-col gap-3 border-b border-outline-variant/70 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"
	>
		<div>
			{#if eyebrow}
				<p
					class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
				>
					{eyebrow}
				</p>
			{/if}
			<h2 class="font-semibold text-on-surface">
				{title}{#if count !== undefined}<span class="ml-1.5 font-normal text-on-surface-variant"
						>({count})</span
					>{/if}
			</h2>
			{#if description}
				<p class="mt-1 text-[length:var(--text-label)] leading-relaxed text-on-surface-variant">
					{description}
				</p>
			{/if}
		</div>
		{@render actions?.()}
	</div>
	<div class="p-4 sm:p-5">{@render children()}</div>
</section>
