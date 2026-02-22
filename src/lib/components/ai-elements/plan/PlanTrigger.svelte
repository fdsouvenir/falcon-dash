<script lang="ts">
	import { CollapsibleTrigger } from '$lib/components/ui/collapsible/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className, children, ...restProps }: Props = $props();
</script>

<CollapsibleTrigger {...restProps}>
	<Button class={cn('size-8', className)} data-slot="plan-trigger" size="icon" variant="ghost">
		{#if children}
			{@render children()}
		{:else}
			<ChevronsUpDownIcon class="size-4" />
			<span class="sr-only">Toggle plan</span>
		{/if}
	</Button>
</CollapsibleTrigger>
