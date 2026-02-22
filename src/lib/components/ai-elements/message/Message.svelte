<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	interface MessageProps extends HTMLAttributes<HTMLDivElement> {
		from: 'user' | 'assistant';
		children?: Snippet;
	}

	let { class: className = '', from, children, ...restProps }: MessageProps = $props();

	const messageClasses = $derived.by(() =>
		cn(
			'group flex w-full items-end justify-end gap-2 py-4',
			from === 'user' ? 'is-user' : 'is-assistant flex-row-reverse justify-end',
			className
		)
	);
</script>

<div class={messageClasses} {...restProps}>
	{@render children?.()}
</div>
