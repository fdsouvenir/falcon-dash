<script lang="ts">
	import type { ReactionInfo } from '$lib/stores/chat.js';

	let { reactions, onToggle }: { reactions: ReactionInfo[]; onToggle: (emoji: string) => void } =
		$props();
</script>

<div class="mt-1 flex flex-wrap gap-1">
	{#each reactions as reaction (reaction.emoji)}
		<button
			onclick={() => onToggle(reaction.emoji)}
			class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors {reaction.reacted
				? 'border-blue-500 bg-blue-500/20 text-blue-300'
				: 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'}"
			title={reaction.users.join(', ')}
		>
			<span>{reaction.emoji}</span>
			<span>{reaction.count}</span>
		</button>
	{/each}
</div>
