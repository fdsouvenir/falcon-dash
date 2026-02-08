<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let isRunning = false;

	const dispatch = createEventDispatcher<{ send: string; abort: void }>();

	let content = '';
	let textarea: HTMLTextAreaElement;

	onMount(() => {
		if (textarea) textarea.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			send();
		}
	}

	function send() {
		const trimmed = content.trim();
		if (!trimmed || isRunning) return;
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

<div class="flex items-end gap-2 border-t border-slate-700 bg-slate-800/50 px-4 py-3">
	<textarea
		bind:value={content}
		bind:this={textarea}
		on:keydown={handleKeydown}
		on:input={handleInput}
		disabled={isRunning}
		placeholder="Type a message..."
		rows="1"
		class="flex-1 resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		style="max-height: 200px"
	/>
	{#if isRunning}
		<button
			on:click={abort}
			class="rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
		>
			Abort
		</button>
	{:else}
		<button
			on:click={send}
			disabled={!content.trim()}
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Send
		</button>
	{/if}
</div>
