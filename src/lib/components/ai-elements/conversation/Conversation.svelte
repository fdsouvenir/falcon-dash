<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import { setStickToBottomContext } from './stick-to-bottom-context.svelte.js';

	interface ConversationProps {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className, children, ...restProps }: ConversationProps = $props();

	setStickToBottomContext();
</script>

<div
	class={cn('relative flex h-full flex-col overflow-hidden', className)}
	role="log"
	{...restProps}
>
	{@render children?.()}
</div>
