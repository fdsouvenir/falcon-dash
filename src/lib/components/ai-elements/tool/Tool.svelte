<script lang="ts">
	import { Collapsible } from '$lib/components/ui/collapsible/index.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface ToolProps {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className = '', children, ...restProps }: ToolProps = $props();
</script>

<Collapsible class={cn('not-prose mb-4 w-full rounded-md border', className)} {...restProps}>
	{@render children?.()}
</Collapsible>
