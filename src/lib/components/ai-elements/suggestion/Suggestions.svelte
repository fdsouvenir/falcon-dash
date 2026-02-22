<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		class?: string;
	}

	let { children, class: className, ...restProps }: Props = $props();
</script>

<div class="w-full overflow-x-auto whitespace-nowrap" {...restProps}>
	<div class={cn('flex w-max flex-nowrap items-center gap-2', className)}>
		{@render children?.()}
	</div>
</div>
