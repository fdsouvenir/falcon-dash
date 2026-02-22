<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { watch } from 'runed';
	import { Collapsible } from '$lib/components/ui/collapsible/index.js';
	import { ReasoningContext, setReasoningContext } from './reasoning-context.svelte.js';

	interface Props {
		class?: string;
		isStreaming?: boolean;
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		duration?: number;
		children?: import('svelte').Snippet;
	}

	let {
		class: className = '',
		isStreaming = false,
		open = $bindable(),
		defaultOpen = true,
		onOpenChange,
		duration = $bindable(),
		children,
		...props
	}: Props = $props();

	let AUTO_CLOSE_DELAY = 1000;
	let MS_IN_S = 1000;

	let reasoningContext = new ReasoningContext({
		isStreaming,
		isOpen: open ?? defaultOpen,
		duration: duration ?? 0
	});

	let isOpen = $state(open ?? defaultOpen);
	let hasAutoClosed = $state(false);
	let startTime = $state<number | null>(null);

	$effect(() => {
		reasoningContext.isStreaming = isStreaming;
	});

	$effect(() => {
		if (open !== undefined) {
			isOpen = open;
			reasoningContext.isOpen = open;
		}
	});

	$effect(() => {
		if (duration !== undefined) {
			reasoningContext.duration = duration;
		}
	});

	watch(
		() => isStreaming,
		(isStreamingValue) => {
			if (isStreamingValue) {
				if (startTime === null) {
					startTime = Date.now();
				}
			} else if (startTime !== null) {
				let newDuration = Math.ceil((Date.now() - startTime) / MS_IN_S);
				reasoningContext.duration = newDuration;
				if (duration !== undefined) {
					duration = newDuration;
				}
				startTime = null;
			}
		}
	);

	watch(
		() => [isStreaming, isOpen, defaultOpen, hasAutoClosed] as const,
		([isStreamingValue, isOpenValue, defaultOpenValue, hasAutoClosedValue]) => {
			if (defaultOpenValue && !isStreamingValue && isOpenValue && !hasAutoClosedValue) {
				let timer = setTimeout(() => {
					handleOpenChange(false);
					hasAutoClosed = true;
				}, AUTO_CLOSE_DELAY);

				return () => clearTimeout(timer);
			}
		}
	);

	let handleOpenChange = (newOpen: boolean) => {
		isOpen = newOpen;
		reasoningContext.setIsOpen(newOpen);

		if (open !== undefined) {
			open = newOpen;
		}

		onOpenChange?.(newOpen);
	};

	setReasoningContext(reasoningContext);
</script>

<Collapsible
	class={cn('not-prose mb-4', className)}
	bind:open={isOpen}
	onOpenChange={handleOpenChange}
	{...props}
>
	{@render children?.()}
</Collapsible>
