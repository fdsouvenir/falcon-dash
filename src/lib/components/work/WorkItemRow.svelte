<script lang="ts">
	import StatusBadge from './StatusBadge.svelte';
	import { typeLabel, workHref } from '$lib/work3/hrefs.js';

	interface Props {
		type: string;
		id: string;
		title: string;
		status?: string | null;
		why?: string | null;
		href?: string | null;
	}

	let { type, id, title, status, why, href }: Props = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- href comes from workHref or a resolved caller value -->
<article
	class="group flex min-h-14 gap-3 border-b border-outline-variant/60 py-3 last:border-b-0"
	data-work-item-row
>
	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-center gap-2">
			<span
				class="rounded-full bg-surface-container-high px-2 py-0.5 font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
			>
				{typeLabel(type)}
			</span>
			{#if status}
				<StatusBadge type={type === 'change_request' ? 'change_execution' : type} value={status} />
			{/if}
		</div>
		{#if href === null}
			<p class="mt-1 break-words font-medium text-on-surface">{title}</p>
		{:else}
			<a
				href={href ?? workHref(type, id)}
				class="falcon-focus touch-target -ml-1 mt-1 block break-words rounded px-1 font-medium text-on-surface hover:text-primary"
			>
				{title}
			</a>
		{/if}
		{#if why}
			<p
				class="mt-1 line-clamp-3 text-[length:var(--text-label)] leading-relaxed text-on-surface-variant"
			>
				{why}
			</p>
		{/if}
	</div>
	{#if href !== null}
		<span class="shrink-0 self-center text-on-surface-variant" aria-hidden="true">→</span>
	{/if}
</article>
