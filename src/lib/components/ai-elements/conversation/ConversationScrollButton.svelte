<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import { getStickToBottomContext } from './stick-to-bottom-context.svelte.js';
	import { fly } from 'svelte/transition';
	import { backOut } from 'svelte/easing';

	interface Props {
		class?: string;
		onclick?: (event: MouseEvent) => void;
		[key: string]: unknown;
	}

	let { class: className, onclick, ...restProps }: Props = $props();

	const context = getStickToBottomContext();

	const handleScrollToBottom = (event: MouseEvent) => {
		context.scrollToBottom();
		if (onclick) {
			onclick(event);
		}
	};
</script>

{#if !context.isAtBottom}
	<div
		in:fly={{ duration: 300, y: 10, easing: backOut }}
		out:fly={{ duration: 200, y: 10, easing: backOut }}
		class="absolute bottom-4 left-[50%] translate-x-[-50%]"
	>
		<Button
			class={cn(
				'bg-background/80 border-border/50 hover:bg-background/90 rounded-full shadow-lg backdrop-blur-sm hover:shadow-xl',
				className
			)}
			onclick={handleScrollToBottom}
			size="icon"
			type="button"
			variant="outline"
			{...restProps}
		>
			<ArrowDownIcon class="size-4" />
		</Button>
	</div>
{/if}
