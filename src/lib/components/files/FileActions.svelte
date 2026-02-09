<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		newfile: { name: string };
		newfolder: { name: string };
	}>();

	let showNewFileInput = $state(false);
	let showNewFolderInput = $state(false);
	let newFileName = $state('');
	let newFolderName = $state('');
	let fileInputEl: HTMLInputElement;
	let folderInputEl: HTMLInputElement;

	function startNewFile(): void {
		showNewFileInput = true;
		showNewFolderInput = false;
		newFileName = '';
		requestAnimationFrame(() => fileInputEl?.focus());
	}

	function startNewFolder(): void {
		showNewFolderInput = true;
		showNewFileInput = false;
		newFolderName = '';
		requestAnimationFrame(() => folderInputEl?.focus());
	}

	function submitNewFile(): void {
		const name = newFileName.trim();
		if (!name) return;
		dispatch('newfile', { name });
		showNewFileInput = false;
		newFileName = '';
	}

	function submitNewFolder(): void {
		const name = newFolderName.trim();
		if (!name) return;
		dispatch('newfolder', { name });
		showNewFolderInput = false;
		newFolderName = '';
	}

	function cancelNewFile(): void {
		showNewFileInput = false;
		newFileName = '';
	}

	function cancelNewFolder(): void {
		showNewFolderInput = false;
		newFolderName = '';
	}

	function handleFileKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitNewFile();
		} else if (event.key === 'Escape') {
			cancelNewFile();
		}
	}

	function handleFolderKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitNewFolder();
		} else if (event.key === 'Escape') {
			cancelNewFolder();
		}
	}
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-slate-700 px-4 py-2">
	<button
		onclick={startNewFile}
		class="flex items-center space-x-1 rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-600"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
		</svg>
		<span>New File</span>
	</button>
	<button
		onclick={startNewFolder}
		class="flex items-center space-x-1 rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-600"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
			/>
		</svg>
		<span>New Folder</span>
	</button>

	{#if showNewFileInput}
		<div class="flex items-center space-x-2">
			<input
				bind:this={fileInputEl}
				bind:value={newFileName}
				onkeydown={handleFileKeydown}
				onblur={cancelNewFile}
				class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
				placeholder="filename.txt"
				aria-label="New file name"
			/>
		</div>
	{/if}

	{#if showNewFolderInput}
		<div class="flex items-center space-x-2">
			<input
				bind:this={folderInputEl}
				bind:value={newFolderName}
				onkeydown={handleFolderKeydown}
				onblur={cancelNewFolder}
				class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
				placeholder="folder-name"
				aria-label="New folder name"
			/>
		</div>
	{/if}
</div>
