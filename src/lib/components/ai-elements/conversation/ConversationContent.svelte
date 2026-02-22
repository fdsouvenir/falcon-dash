<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import { getStickToBottomContext } from './stick-to-bottom-context.svelte.js';
	import { watch } from 'runed';

	interface ConversationContentProps {
		class?: string;
		children?: Snippet;
		ref?: HTMLDivElement | null;
		[key: string]: unknown;
	}

	let {
		class: className,
		children,
		ref = $bindable(null),
		...restProps
	}: ConversationContentProps = $props();

	const context = getStickToBottomContext();
	let element: HTMLDivElement;

	watch(
		() => element,
		() => {
			if (element) {
				context.setElement(element);
				ref = element;
				context.scrollToBottom('smooth');
			}
		}
	);
</script>

<div bind:this={element} class={cn('flex-1 overflow-y-auto p-4', className)} {...restProps}>
	{@render children?.()}
</div>
