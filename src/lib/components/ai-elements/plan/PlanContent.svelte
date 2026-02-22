<script lang="ts">
	import { CollapsibleContent } from '$lib/components/ui/collapsible/index.js';
	import { CardContent } from '$lib/components/ui/card/index.js';
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		[key: string]: unknown;
	}

	let { children, ...restProps }: Props = $props();
</script>

<CollapsibleContent>
	<CardContent data-slot="plan-content" {...restProps}>
		{@render children?.()}
	</CardContent>
</CollapsibleContent>
