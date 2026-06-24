<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		eyebrow: string;
		title: string;
		description: string;
		active?: string;
		children?: Snippet;
	}

	let { eyebrow, title, description, active = '', children }: Props = $props();
</script>

<div
	class="min-h-full bg-background text-on-surface"
	data-falcon-module={active}
	aria-label={`${eyebrow}: ${title}. ${description}`}
>
	{@render children?.()}
</div>
