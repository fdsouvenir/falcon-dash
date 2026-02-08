<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import CommandPalette from './CommandPalette.svelte';
	import { commands, findCommands } from '$lib/chat/commands';
	import type { SlashCommand, CommandContext } from '$lib/chat/commands';

	export let isRunning = false;
	export let commandContext: CommandContext | undefined = undefined;

	const dispatch = createEventDispatcher<{ send: string; abort: void }>();

	let content = '';
	let textarea: HTMLTextAreaElement;
	let paletteOpen = false;
	let commandFilter = '';
	let palette: CommandPalette;

	onMount(() => {
		if (textarea) textarea.focus();
	});

	$: {
		if (content.startsWith('/') && !isRunning) {
			paletteOpen = true;
			// Extract the filter text after /
			const spaceIdx = content.indexOf(' ');
			commandFilter = spaceIdx === -1 ? content.slice(1) : content.slice(1, spaceIdx);
		} else {
			paletteOpen = false;
			commandFilter = '';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// If palette is open, let it handle navigation keys
		if (paletteOpen && palette) {
			const handled = palette.handleKeydown(event);
			if (handled) return;
		}

		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			send();
		}
	}

	function handleCommandSelect(event: CustomEvent<SlashCommand>) {
		const cmd = event.detail;
		if (!cmd) {
			// Escape pressed — close palette, keep text
			paletteOpen = false;
			return;
		}

		if (commandContext) {
			// Extract args: everything after "/commandName "
			const prefix = '/' + cmd.name;
			const args = content.startsWith(prefix) ? content.slice(prefix.length).trim() : '';
			cmd.execute(args, commandContext);
		}

		content = '';
		paletteOpen = false;
		if (textarea) {
			textarea.style.height = 'auto';
		}
	}

	function send() {
		const trimmed = content.trim();
		if (!trimmed || isRunning) return;

		// Check if it's a slash command
		if (trimmed.startsWith('/') && commandContext) {
			const withoutSlash = trimmed.slice(1);
			const spaceIdx = withoutSlash.indexOf(' ');
			const cmdName = spaceIdx === -1 ? withoutSlash : withoutSlash.slice(0, spaceIdx);
			const args = spaceIdx === -1 ? '' : withoutSlash.slice(spaceIdx + 1).trim();

			const matched = commands.find((c) => c.name.toLowerCase() === cmdName.toLowerCase());
			if (matched) {
				matched.execute(args, commandContext);
				content = '';
				if (textarea) textarea.style.height = 'auto';
				return;
			}
		}

		// Normal message send
		dispatch('send', trimmed);
		content = '';
		if (textarea) {
			textarea.style.height = 'auto';
		}
	}

	function abort() {
		dispatch('abort');
	}

	function handleInput() {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
	}
</script>

<div class="relative flex items-end gap-2 border-t border-slate-700 bg-slate-800/50 px-4 py-3">
	{#if paletteOpen}
		<CommandPalette
			bind:this={palette}
			commands={findCommands(commandFilter)}
			filter={commandFilter}
			on:select={handleCommandSelect}
		/>
	{/if}

	<textarea
		bind:value={content}
		bind:this={textarea}
		on:keydown={handleKeydown}
		on:input={handleInput}
		disabled={isRunning}
		placeholder="Type a message... (/ for commands)"
		rows="1"
		class="flex-1 resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		style="max-height: 200px"
	/>
	{#if isRunning}
		<button
			on:click={abort}
			class="min-h-[44px] min-w-[44px] rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
		>
			Abort
		</button>
	{:else}
		<button
			on:click={send}
			disabled={!content.trim()}
			class="min-h-[44px] min-w-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Send
		</button>
	{/if}
</div>
