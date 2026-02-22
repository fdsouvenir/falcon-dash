<script lang="ts">
	import { CardHeader } from '$lib/components/ui/card/index.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className, children, ...restProps }: Props = $props();
</script>

<CardHeader
	class={cn('flex items-start justify-between', className)}
	data-slot="plan-header"
	{...restProps}
>
	{@render children?.()}
</CardHeader>
