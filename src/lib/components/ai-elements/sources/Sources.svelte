<script lang="ts">
	import { Collapsible } from '$lib/components/ui/collapsible/index.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className = '', children, ...restProps }: Props = $props();
</script>

<Collapsible class={cn('not-prose text-primary mb-4 text-xs', className)} {...restProps}>
	{@render children?.()}
</Collapsible>
