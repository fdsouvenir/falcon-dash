<script lang="ts">
	import type { ThinkingBlock } from '$lib/gateway/types';

	interface Props {
		thinking: ThinkingBlock;
	}

	let { thinking }: Props = $props();

	let open = $state(false);

	let isStreaming = $derived(!thinking.completedAt);
	let durationText = $derived(
		thinking.durationMs
			? `${(thinking.durationMs / 1000).toFixed(1)}s`
			: thinking.completedAt && thinking.startedAt
				? `${((thinking.completedAt - thinking.startedAt) / 1000).toFixed(1)}s`
				: ''
	);
	let summaryText = $derived(isStreaming ? 'Thinking...' : `Thought for ${durationText}`);
</script>

<details bind:open class="my-1">
	<summary
		class="cursor-pointer select-none text-sm text-slate-400 hover:text-slate-300 transition-colors"
	>
		{summaryText}
	</summary>
	<div
		class="mt-1 ml-4 pl-3 border-l-2 border-slate-600 text-sm text-slate-400 whitespace-pre-wrap"
	>
		{thinking.content}
	</div>
</details>
