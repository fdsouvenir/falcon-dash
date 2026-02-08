<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { WorkspaceFile } from '$lib/types';
	import {
		files,
		currentPath,
		activeFile,
		activeFileName,
		loadFiles,
		loadFile,
		navigateTo
	} from '$lib/stores';
	import { formatRelativeTime } from '$lib/utils/time';
	import { formatFileSize } from '$lib/utils/format';

	type SortKey = 'name' | 'mtime' | 'size';
	type SortDir = 'asc' | 'desc';

	function isFileActive(file: WorkspaceFile): boolean {
		if (file.isDirectory) return false;
		const path = $currentPath ? $currentPath + '/' + file.name : file.name;
		return $activeFileName === path;
	}

	let loading = true;
	let errorMessage = '';
	let sortKey: SortKey = 'name';
	let sortDir: SortDir = 'asc';
	let now = Date.now();

	$: pathSegments = $currentPath ? $currentPath.split('/').filter(Boolean) : [];

	$: sortedFiles = sortFiles($files, sortKey, sortDir);

	function sortFiles(list: WorkspaceFile[], key: SortKey, dir: SortDir): WorkspaceFile[] {
		const sorted = [...list].sort((a, b) => {
			// Directories always first
			if (a.isDirectory && !b.isDirectory) return -1;
			if (!a.isDirectory && b.isDirectory) return 1;

			let cmp = 0;
			if (key === 'name') {
				cmp = a.name.localeCompare(b.name);
			} else if (key === 'mtime') {
				cmp = new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
			} else if (key === 'size') {
				cmp = a.size - b.size;
			}
			return dir === 'asc' ? cmp : -cmp;
		});
		return sorted;
	}

	function toggleSort(key: SortKey): void {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function sortIndicator(key: SortKey): string {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? ' \u2191' : ' \u2193';
	}

	async function handleNavigate(dir: string): Promise<void> {
		loading = true;
		errorMessage = '';
		activeFile.set(null);
		activeFileName.set('');
		try {
			await navigateTo(dir);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load directory';
		} finally {
			loading = false;
		}
	}

	function breadcrumbPath(index: number): string {
		return pathSegments.slice(0, index + 1).join('/');
	}

	async function handleFileClick(file: WorkspaceFile): Promise<void> {
		if (file.isDirectory) {
			const dir = $currentPath ? `${$currentPath}/${file.name}` : file.name;
			await handleNavigate(dir);
		} else {
			const filePath = $currentPath ? `${$currentPath}/${file.name}` : file.name;
			try {
				await loadFile(filePath);
			} catch (err) {
				errorMessage = err instanceof Error ? err.message : 'Failed to load file';
			}
		}
	}

	async function retry(): Promise<void> {
		loading = true;
		errorMessage = '';
		try {
			await loadFiles($currentPath || undefined);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load directory';
		} finally {
			loading = false;
		}
	}

	let interval: ReturnType<typeof setInterval>;

	onMount(() => {
		interval = setInterval(() => {
			now = Date.now();
		}, 30000);

		loadFiles()
			.catch((err) => {
				errorMessage = err instanceof Error ? err.message : 'Failed to load directory';
			})
			.finally(() => {
				loading = false;
			});
	});

	onDestroy(() => {
		clearInterval(interval);
	});
</script>

<div class="flex h-full flex-col">
	<!-- Breadcrumb navigation -->
	<div class="border-b border-slate-700 px-4 py-3">
		<nav class="flex items-center space-x-1 text-sm">
			<button
				on:click={() => handleNavigate('')}
				class="text-slate-400 transition-colors hover:text-slate-100"
				class:text-slate-100={pathSegments.length === 0}
			>
				Home
			</button>
			{#each pathSegments as segment, i (i)}
				<span class="text-slate-600">/</span>
				<button
					on:click={() => handleNavigate(breadcrumbPath(i))}
					class="text-slate-400 transition-colors hover:text-slate-100"
					class:text-slate-100={i === pathSegments.length - 1}
				>
					{segment}
				</button>
			{/each}
		</nav>
	</div>

	<!-- Main content area -->
	<div class="flex flex-1 flex-col overflow-hidden md:flex-row">
		<!-- File list (left pane) -->
		<div
			class="flex flex-1 flex-col overflow-hidden border-b border-slate-700 md:border-b-0 md:border-r"
		>
			{#if loading}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-slate-400">Loading files...</p>
				</div>
			{:else if errorMessage}
				<div class="flex flex-1 flex-col items-center justify-center space-y-3">
					<p class="text-sm text-red-400">{errorMessage}</p>
					<button
						on:click={retry}
						class="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-600"
					>
						Retry
					</button>
				</div>
			{:else if sortedFiles.length === 0}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-slate-400">This directory is empty</p>
				</div>
			{:else}
				<!-- Column headers -->
				<div
					class="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-slate-700 px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-400"
				>
					<button
						on:click={() => toggleSort('name')}
						class="text-left transition-colors hover:text-slate-200"
					>
						Name{sortIndicator('name')}
					</button>
					<button
						on:click={() => toggleSort('mtime')}
						class="w-24 text-right transition-colors hover:text-slate-200"
					>
						Modified{sortIndicator('mtime')}
					</button>
					<button
						on:click={() => toggleSort('size')}
						class="w-20 text-right transition-colors hover:text-slate-200"
					>
						Size{sortIndicator('size')}
					</button>
				</div>

				<!-- File rows -->
				<div class="flex-1 overflow-y-auto">
					{#each sortedFiles as file (file.name)}
						<button
							on:click={() => handleFileClick(file)}
							class="grid w-full grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-700/50 {isFileActive(
								file
							)
								? 'bg-slate-700/30'
								: ''}"
						>
							<span class="flex items-center space-x-2 truncate">
								<span class="flex-shrink-0 text-slate-400">
									{#if file.isDirectory}
										<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
											<path
												d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
											/>
										</svg>
									{:else}
										<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
												clip-rule="evenodd"
											/>
										</svg>
									{/if}
								</span>
								<span
									class="truncate"
									class:text-slate-100={file.isDirectory}
									class:text-slate-300={!file.isDirectory}
								>
									{file.name}
								</span>
							</span>
							<span
								class="w-24 text-right text-xs text-slate-500"
								title={new Date(file.mtime).toLocaleString()}
							>
								{formatRelativeTime(new Date(file.mtime).getTime(), now)}
							</span>
							<span class="w-20 text-right text-xs text-slate-500">
								{file.isDirectory ? '--' : formatFileSize(file.size)}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Preview pane (right pane) -->
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if $activeFile}
				<div class="border-b border-slate-700 px-4 py-2">
					<h3 class="text-sm font-medium text-slate-200">{$activeFileName}</h3>
				</div>
				<div class="flex-1 overflow-y-auto p-4">
					<pre class="whitespace-pre-wrap text-sm text-slate-300">{$activeFile.content}</pre>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-slate-400">Select a file to preview</p>
				</div>
			{/if}
		</div>
	</div>
</div>
