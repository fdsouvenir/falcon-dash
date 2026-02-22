<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { tv, type VariantProps } from 'tailwind-variants';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	const messageContentVariants = tv({
		base: 'flex flex-col gap-2 overflow-hidden text-sm',
		variants: {
			variant: {
				contained: [
					'max-w-[80%] rounded-lg px-4 py-3',
					'group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground',
					'group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground'
				],
				flat: [
					'group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:max-w-[80%] group-[.is-user]:rounded-lg group-[.is-user]:px-4 group-[.is-user]:py-3',
					'group-[.is-assistant]:text-foreground'
				]
			}
		},
		defaultVariants: {
			variant: 'contained'
		}
	});

	type MessageContentProps = HTMLAttributes<HTMLDivElement> &
		VariantProps<typeof messageContentVariants> & {
			children?: Snippet;
		};

	let { class: className = '', variant, children, ...restProps }: MessageContentProps = $props();
</script>

<div class={cn(messageContentVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</div>
