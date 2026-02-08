<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let content: string;
	export let filename: string;

	const dispatch = createEventDispatcher<{
		save: { content: string };
		cancel: void;
	}>();

	let editContent = content;

	$: isDirty = editContent !== content;

	function handleSave(): void {
		dispatch('save', { content: editContent });
	}

	function handleCancel(): void {
		dispatch('cancel');
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.ctrlKey && event.key === 's') {
			event.preventDefault();
			if (isDirty) handleSave();
		}
		if (event.key === 'Escape') {
			handleCancel();
		}
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between border-b border-slate-700 px-4 py-2">
		<span class="text-sm text-slate-400">{filename}</span>
		<div class="flex items-center space-x-2">
			<button
				on:click={handleCancel}
				class="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-600"
			>
				Cancel
			</button>
			<button
				on:click={handleSave}
				disabled={!isDirty}
				class="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Save
			</button>
		</div>
	</div>
	<textarea
		bind:value={editContent}
		on:keydown={handleKeydown}
		class="flex-1 resize-none border-0 bg-slate-900 p-3 font-mono text-sm text-slate-200 focus:outline-none"
		spellcheck="false"
	></textarea>
</div>
