<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SlashCommand } from '$lib/chat/commands';

	export let commands: SlashCommand[] = [];
	export let filter = '';

	const dispatch = createEventDispatcher<{ select: SlashCommand }>();

	let selectedIndex = 0;

	$: filtered = commands.filter((cmd) => cmd.name.toLowerCase().includes(filter.toLowerCase()));

	$: if (filtered.length > 0 && selectedIndex >= filtered.length) {
		selectedIndex = filtered.length - 1;
	}

	export function handleKeydown(event: KeyboardEvent): boolean {
		if (filtered.length === 0) return false;

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : filtered.length - 1;
			return true;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedIndex = selectedIndex < filtered.length - 1 ? selectedIndex + 1 : 0;
			return true;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			dispatch('select', filtered[selectedIndex]);
			return true;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			dispatch('select', undefined as unknown as SlashCommand);
			return true;
		}

		return false;
	}

	function selectCommand(cmd: SlashCommand) {
		dispatch('select', cmd);
	}
</script>

{#if filtered.length > 0}
	<div
		class="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 shadow-xl"
		role="listbox"
		aria-label="Slash commands"
	>
		{#each filtered as cmd, i (cmd.name)}
			<button
				class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors {i ===
				selectedIndex
					? 'bg-blue-600/30 text-slate-100'
					: 'text-slate-300 hover:bg-slate-700/50'}"
				on:click={() => selectCommand(cmd)}
				role="option"
				aria-selected={i === selectedIndex}
			>
				<span class="font-mono text-blue-400">/{cmd.name}</span>
				<span class="text-slate-400">{cmd.description}</span>
			</button>
		{/each}
	</div>
{/if}
