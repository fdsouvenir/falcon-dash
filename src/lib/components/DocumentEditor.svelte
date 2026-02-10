<script lang="ts">
	import {
		editor,
		hasUnsavedChanges,
		updateContent,
		saveFile,
		closeFile,
		type EditorState
	} from '$lib/stores/editor.js';
	import MarkdownRenderer from './MarkdownRenderer.svelte';

	let editorState = $state<EditorState | null>(null);
	let unsaved = $state(false);
	let showPreview = $state(false);

	$effect(() => {
		const unsub = editor.subscribe((v) => {
			editorState = v;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = hasUnsavedChanges.subscribe((v) => {
			unsaved = v;
		});
		return unsub;
	});

	function handleInput(e: Event) {
		const textarea = e.target as HTMLTextAreaElement;
		updateContent(textarea.value);
	}

	async function handleSave() {
		await saveFile();
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
	}

	function formatJson(content: string): string {
		try {
			return JSON.stringify(JSON.parse(content), null, 2);
		} catch {
			return content;
		}
	}
</script>

{#if editorState}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="flex h-full flex-col" role="application" onkeydown={handleKeydown}>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-800 px-4 py-2">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-white">{editorState.fileName}</span>
				{#if unsaved}
					<span class="text-xs text-yellow-400">● Unsaved</span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if editorState.fileType === 'markdown'}
					<button
						onclick={() => {
							showPreview = !showPreview;
						}}
						class="rounded px-2 py-1 text-xs {showPreview
							? 'bg-gray-700 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Preview
					</button>
				{/if}
				<button
					onclick={handleSave}
					disabled={!unsaved || editorState.isSaving}
					class="rounded bg-blue-600 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
				>
					{editorState.isSaving ? 'Saving...' : 'Save'}
				</button>
				<button
					onclick={closeFile}
					class="rounded p-1 text-gray-400 hover:text-white"
					aria-label="Close editor"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Error banner -->
		{#if editorState.error}
			<div class="border-b border-red-800 bg-red-900/50 px-4 py-2 text-xs text-red-300">
				{editorState.error}
			</div>
		{/if}

		<!-- Content area -->
		{#if editorState.isLoading}
			<div class="flex flex-1 items-center justify-center text-gray-500">Loading...</div>
		{:else if editorState.fileType === 'image'}
			<div class="flex flex-1 items-center justify-center overflow-auto bg-gray-950 p-4">
				<img
					src={editorState.content}
					alt={editorState.fileName}
					class="max-h-full max-w-full rounded"
				/>
			</div>
		{:else if editorState.fileType === 'markdown' && showPreview}
			<div class="flex flex-1 overflow-hidden">
				<!-- Editor -->
				<div class="flex-1 overflow-auto border-r border-gray-800">
					<textarea
						value={editorState.content}
						oninput={handleInput}
						class="h-full w-full resize-none bg-gray-950 p-4 font-mono text-sm text-gray-300 focus:outline-none"
						spellcheck="false"
					></textarea>
				</div>
				<!-- Preview -->
				<div class="flex-1 overflow-auto p-4">
					<MarkdownRenderer content={editorState.content} />
				</div>
			</div>
		{:else if editorState.fileType === 'json'}
			<textarea
				value={formatJson(editorState.content)}
				oninput={handleInput}
				class="flex-1 resize-none bg-gray-950 p-4 font-mono text-sm text-gray-300 focus:outline-none"
				spellcheck="false"
			></textarea>
		{:else}
			<textarea
				value={editorState.content}
				oninput={handleInput}
				class="flex-1 resize-none bg-gray-950 p-4 font-mono text-sm text-gray-300 focus:outline-none"
				spellcheck="false"
			></textarea>
		{/if}
	</div>
{/if}
