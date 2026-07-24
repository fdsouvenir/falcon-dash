<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		value?: string | number | null;
		children?: Snippet;
		mono?: boolean;
	}

	let { label, value, children, mono = false }: Props = $props();
</script>

<div
	class="grid gap-1 border-b border-outline-variant/60 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr]"
>
	<dt
		class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
	>
		{label}
	</dt>
	<dd class={mono ? 'break-words font-mono text-[length:var(--text-mono)]' : 'text-on-surface'}>
		{#if children}{@render children()}{:else}{value ?? '—'}{/if}
	</dd>
</div>
