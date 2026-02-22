<script lang="ts">
	import {
		Reasoning,
		ReasoningTrigger,
		ReasoningContent
	} from '$lib/components/ai-elements/reasoning/index.js';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';

	let {
		thinkingText = '',
		isStreaming = false,
		startedAt = 0,
		completedAt
	}: {
		thinkingText: string;
		isStreaming: boolean;
		startedAt: number;
		completedAt?: number;
	} = $props();

	let duration = $derived.by(() => {
		if (completedAt && startedAt) {
			return Math.floor((completedAt - startedAt) / 1000);
		}
		return undefined;
	});
</script>

{#if thinkingText}
	<Reasoning {isStreaming} {duration}>
		<ReasoningTrigger />
		<ReasoningContent>
			<div class="max-h-64 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
				<MarkdownRenderer content={thinkingText} {isStreaming} />
			</div>
		</ReasoningContent>
	</Reasoning>
{/if}
