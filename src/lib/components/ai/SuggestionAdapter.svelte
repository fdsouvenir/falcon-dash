<script lang="ts">
	import { Suggestions, Suggestion } from '$lib/components/ai-elements/suggestion/index.js';

	let {
		suggestions,
		onselect
	}: {
		suggestions: string[];
		onselect: (text: string) => void;
	} = $props();
</script>

{#if suggestions.length > 0}
	<Suggestions class="py-2">
		{#each suggestions as text (text)}
			<Suggestion suggestion={text} onclick={onselect} />
		{/each}
	</Suggestions>
{/if}
