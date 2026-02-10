<script lang="ts">
	import { filterCommands, type SlashCommand } from '$lib/chat/commands.js';

	let {
		query = '',
		visible = false,
		selectedIndex = 0,
		onSelect
	}: {
		query: string;
		visible: boolean;
		selectedIndex: number;
		onSelect: (command: SlashCommand) => void;
	} = $props();

	let filtered = $derived(filterCommands(query));
</script>

{#if visible && filtered.length > 0}
	<div
		class="absolute bottom-full left-0 mb-1 w-80 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl max-h-64 overflow-y-auto"
	>
		{#each filtered as cmd, i (cmd.name)}
			<button
				onclick={() => onSelect(cmd)}
				class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-700 transition-colors {i ===
				selectedIndex
					? 'bg-gray-700'
					: ''}"
			>
				<span class="font-mono text-sm text-blue-400 flex-shrink-0">/{cmd.name}</span>
				<span class="text-xs text-gray-400 flex-1">{cmd.description}</span>
				{#if cmd.args}
					<span class="text-xs text-gray-600 flex-shrink-0">{cmd.args}</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}
