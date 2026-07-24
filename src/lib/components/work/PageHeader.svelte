<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import StatusBadge from './StatusBadge.svelte';

	interface Props {
		eyebrow: string;
		title: string;
		id?: string;
		version?: number;
		status?: string | null;
		statusType?: string;
		description?: string | null;
		backHref?: string;
		backLabel?: string;
		metadata?: Snippet;
		actions?: Snippet;
	}

	let {
		eyebrow,
		title,
		id,
		version,
		status,
		statusType = 'task',
		description,
		backHref = resolve('/work'),
		backLabel = 'Work',
		metadata,
		actions
	}: Props = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- backHref is resolved by the caller -->
<header class="space-y-4 border-b border-outline-variant pb-5" data-work-page-header>
	<a
		href={backHref}
		class="falcon-focus touch-target inline-flex items-center text-[length:var(--text-label)] font-semibold text-primary hover:text-primary/80"
	>
		← {backLabel}
	</a>
	<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
		<div class="min-w-0 space-y-2">
			<p
				class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
			>
				{eyebrow}
			</p>
			<div class="flex flex-wrap items-center gap-2">
				<h1
					class="min-w-0 break-words text-[length:var(--md-sys-typescale-headline-medium-size)] font-semibold leading-tight text-on-surface"
				>
					{title}
				</h1>
				{#if status}<StatusBadge type={statusType} value={status} />{/if}
			</div>
			{#if id}
				<p class="break-all font-mono text-[length:var(--text-label)] text-on-surface-variant">
					{id}{version !== undefined ? ` · v${version}` : ''}
				</p>
			{/if}
			{#if description}
				<p class="max-w-3xl text-[length:var(--text-body)] leading-relaxed text-on-surface-variant">
					{description}
				</p>
			{/if}
			{@render metadata?.()}
		</div>
		{#if actions}
			<div class="shrink-0">{@render actions()}</div>
		{/if}
	</div>
</header>
