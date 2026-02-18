<script lang="ts">
	import {
		sortedEntries,
		currentPath,
		breadcrumbs,
		isLoading,
		fileError,
		loadDirectory
	} from '$lib/stores/files.js';
	import { editor, openFile, closeFile } from '$lib/stores/editor.js';
	import type { EditorState } from '$lib/stores/editor.js';
	import type { FileEntry } from '$lib/stores/files.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';

	let view = $state<'list' | 'viewer'>('list');
	let entries = $state<FileEntry[]>([]);
	let path = $state('');
	let crumbs = $state<Array<{ name: string; path: string }>>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let editorState = $state<EditorState | null>(null);

	$effect(() => {
		const unsub = sortedEntries.subscribe((v) => {
			entries = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = currentPath.subscribe((v) => {
			path = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = breadcrumbs.subscribe((v) => {
			crumbs = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = isLoading.subscribe((v) => {
			loading = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = fileError.subscribe((v) => {
			error = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = editor.subscribe((v) => {
			editorState = v;
		});
		return unsub;
	});

	$effect(() => {
		loadDirectory('');
	});

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function handleEntryTap(entry: FileEntry) {
		if (entry.type === 'directory') {
			loadDirectory(entry.path);
		} else {
			openFile(entry.path);
			view = 'viewer';
		}
	}

	function handleBack() {
		if (view === 'viewer') {
			closeFile();
			view = 'list';
		} else if (path) {
			const parts = path.split('/').filter(Boolean);
			parts.pop();
			loadDirectory(parts.join('/'));
		}
	}

	function handleCrumbTap(crumbPath: string) {
		loadDirectory(crumbPath);
	}
</script>

<div class="flex h-full flex-col bg-gray-950">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
		{#if view === 'viewer' || path}
			<button
				class="flex min-h-[44px] items-center gap-2 text-sm text-blue-400"
				onclick={handleBack}
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
				Back
			</button>
		{:else}
			<h1 class="text-lg font-semibold text-white">Documents</h1>
		{/if}

		{#if view === 'viewer' && editorState}
			<span class="truncate text-sm text-gray-400">{editorState.fileName}</span>
		{/if}
	</div>

	{#if view === 'viewer'}
		<!-- Viewer -->
		<div class="flex-1 overflow-auto px-4 py-3 pb-[calc(1rem+var(--safe-bottom))]">
			{#if editorState?.isLoading}
				<div class="flex items-center justify-center py-12 text-gray-400">
					<span>Loading file...</span>
				</div>
			{:else if editorState?.error}
				<div class="flex items-center justify-center py-12 text-red-400">
					<span>{editorState.error}</span>
				</div>
			{:else if editorState}
				{#if editorState.fileType === 'markdown'}
					<div class="prose prose-invert max-w-none">
						<MarkdownRenderer content={editorState.content} />
					</div>
				{:else if editorState.fileType === 'code' || editorState.fileType === 'json'}
					<pre class="overflow-x-auto text-sm text-green-400">{editorState.content}</pre>
				{:else if editorState.fileType === 'image'}
					<div class="flex items-center justify-center">
						<img src={editorState.content} alt={editorState.fileName} class="max-w-full rounded" />
					</div>
				{:else}
					<pre class="overflow-x-auto text-sm text-gray-300">{editorState.content}</pre>
				{/if}
			{/if}
		</div>
	{:else}
		<!-- Breadcrumbs -->
		{#if crumbs.length > 1}
			<div class="flex items-center gap-1 overflow-x-auto border-b border-gray-800 px-4 py-2">
				{#each crumbs as crumb, i (crumb.path)}
					{#if i > 0}
						<span class="text-xs text-gray-600">/</span>
					{/if}
					<button
						class="whitespace-nowrap text-xs {i === crumbs.length - 1
							? 'text-white'
							: 'text-blue-400'}"
						onclick={() => handleCrumbTap(crumb.path)}
					>
						{crumb.name}
					</button>
				{/each}
			</div>
		{/if}

		<!-- File List -->
		<div class="flex-1 overflow-auto pb-[calc(1rem+var(--safe-bottom))]">
			{#if loading}
				<div class="flex items-center justify-center py-12 text-gray-400">
					<span>Loading...</span>
				</div>
			{:else if error}
				<div class="flex flex-col items-center justify-center gap-2 py-12">
					<span class="text-sm text-red-400">{error}</span>
					<button
						class="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white"
						onclick={() => loadDirectory(path)}
					>
						Retry
					</button>
				</div>
			{:else if entries.length === 0}
				<div class="flex flex-col items-center justify-center gap-2 py-12">
					<svg
						class="h-10 w-10 text-gray-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
						/>
					</svg>
					<span class="text-sm text-gray-400">No files in this directory</span>
				</div>
			{:else}
				<div class="divide-y divide-gray-800">
					{#each entries as entry (entry.path)}
						<button
							class="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-900"
							onclick={() => handleEntryTap(entry)}
						>
							<!-- Icon -->
							{#if entry.type === 'directory'}
								<svg
									class="h-5 w-5 shrink-0 text-blue-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
									/>
								</svg>
							{:else}
								<svg
									class="h-5 w-5 shrink-0 text-gray-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
									/>
								</svg>
							{/if}

							<!-- Details -->
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm text-white">{entry.name}</div>
								<div class="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
									{#if entry.type === 'file'}
										<span>{formatSize(entry.size)}</span>
										<span>·</span>
									{/if}
									<span>{formatRelativeTime(entry.modified)}</span>
								</div>
							</div>

							<!-- Chevron -->
							{#if entry.type === 'directory'}
								<svg
									class="h-4 w-4 shrink-0 text-gray-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
