<script lang="ts">
	import { Collapsible } from '$lib/components/ui/collapsible/index.js';
	import { Card } from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import { setPlanContext } from './plan-context.svelte.js';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		isStreaming?: boolean;
		children?: Snippet;
		open?: boolean;
		[key: string]: unknown;
	}

	let {
		class: className,
		isStreaming = false,
		children,
		open = $bindable(true),
		...restProps
	}: Props = $props();

	setPlanContext({ isStreaming });
</script>

<Collapsible data-slot="plan" bind:open {...restProps}>
	<Card class={cn('shadow-none', className)}>
		{@render children?.()}
	</Card>
</Collapsible>
