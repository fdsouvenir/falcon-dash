<script lang="ts">
	import { page } from '$app/state';
	import { focusCounts, focusDefinitionsForType } from '$lib/work3/focus.js';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	interface Props {
		type: string;
		items: Array<Record<string, unknown>>;
		active?: string | null;
		now?: number;
	}

	let { type, items, active = null, now = Date.now() }: Props = $props();

	const definitions = $derived(focusDefinitionsForType(type));
	const counts = $derived(focusCounts(items, type, now));

	function hrefFor(focus: string | null): string {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (focus) params.set('focus', focus);
		else params.delete('focus');
		const query = params.toString();
		return `${page.url.pathname}${query ? `?${query}` : ''}`;
	}
</script>

{#if definitions.length}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- focus links preserve the current resolved route -->
	<nav class="flex flex-wrap gap-2" aria-label="Focus filters">
		<a
			href={hrefFor(null)}
			aria-current={!active ? 'page' : undefined}
			class="falcon-focus touch-target inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[length:var(--text-label)] font-semibold {!active
				? 'border-primary bg-primary-container text-on-primary-container'
				: 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}"
		>
			All
			<span class="font-mono">{items.length}</span>
		</a>
		{#each definitions as definition (definition.key)}
			<a
				href={hrefFor(definition.key)}
				title={definition.description}
				aria-current={active === definition.key ? 'page' : undefined}
				class="falcon-focus touch-target inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[length:var(--text-label)] font-semibold {active ===
				definition.key
					? 'border-primary bg-primary-container text-on-primary-container'
					: 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}"
			>
				{definition.label}
				<span class="font-mono">{counts[definition.key] ?? 0}</span>
			</a>
		{/each}
	</nav>
{/if}
