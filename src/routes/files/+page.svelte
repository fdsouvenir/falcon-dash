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
		saveFile,
		deleteFile,
		createFile,
		createFolder,
		renameFile,
		navigateTo
	} from '$lib/stores';
	import { formatRelativeTime } from '$lib/utils/time';
	import { formatFileSize } from '$lib/utils/format';
	import FilePreview from '$lib/components/files/FilePreview.svelte';
	import FileEditor from '$lib/components/files/FileEditor.svelte';
	import FileActions from '$lib/components/files/FileActions.svelte';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';
	import { pullToRefresh } from '$lib/utils/gestures';

	async function refreshFileList() {
		await loadFiles($currentPath || undefined);
	}

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
	let editing = false;
	let saveError = '';

	// Inline rename state
	let renamingFile: string | null = null;
	let renameValue = '';
	let renameInputEl: HTMLInputElement;

	// Delete confirmation state
	let deleteTarget: WorkspaceFile | null = null;
	let showDeleteConfirm = false;

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
		editing = false;
		saveError = '';
		renamingFile = null;
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
		if (renamingFile === file.name) return;
		if (file.isDirectory) {
			const dir = $currentPath ? `${$currentPath}/${file.name}` : file.name;
			await handleNavigate(dir);
		} else {
			editing = false;
			saveError = '';
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

	function startEditing(): void {
		editing = true;
		saveError = '';
	}

	function cancelEditing(): void {
		editing = false;
		saveError = '';
	}

	async function handleSave(event: CustomEvent<{ content: string }>): Promise<void> {
		if (!$activeFile || !$activeFileName) return;
		saveError = '';
		try {
			const result = await saveFile($activeFileName, event.detail.content, $activeFile.hash);
			activeFile.set({
				content: event.detail.content,
				hash: result.hash,
				mtime: new Date().toISOString()
			});
			editing = false;
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to save file';
		}
	}

	// --- New File / New Folder ---

	async function handleNewFile(event: CustomEvent<{ name: string }>): Promise<void> {
		const name = event.detail.name;
		const filePath = $currentPath ? `${$currentPath}/${name}` : name;
		try {
			await createFile(filePath, '');
			await loadFiles($currentPath || undefined);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to create file';
		}
	}

	async function handleNewFolder(event: CustomEvent<{ name: string }>): Promise<void> {
		const name = event.detail.name;
		try {
			await createFolder($currentPath, name);
			await loadFiles($currentPath || undefined);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to create folder';
		}
	}

	// --- Inline Rename ---

	function startRename(file: WorkspaceFile): void {
		renamingFile = file.name;
		renameValue = file.name;
		requestAnimationFrame(() => {
			if (renameInputEl) {
				renameInputEl.focus();
				const dotIndex = renameValue.lastIndexOf('.');
				if (dotIndex > 0 && !file.isDirectory) {
					renameInputEl.setSelectionRange(0, dotIndex);
				} else {
					renameInputEl.select();
				}
			}
		});
	}

	async function submitRename(): Promise<void> {
		if (!renamingFile) return;
		const newName = renameValue.trim();
		if (!newName || newName === renamingFile) {
			renamingFile = null;
			return;
		}
		const filePath = $currentPath ? `${$currentPath}/${renamingFile}` : renamingFile;
		try {
			await renameFile(filePath, newName);
			// If the renamed file was the active file, update the active file name
			if ($activeFileName === filePath) {
				const newPath = $currentPath ? `${$currentPath}/${newName}` : newName;
				activeFileName.set(newPath);
			}
			await loadFiles($currentPath || undefined);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to rename file';
		}
		renamingFile = null;
	}

	function cancelRename(): void {
		renamingFile = null;
	}

	function handleRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitRename();
		} else if (event.key === 'Escape') {
			cancelRename();
		}
	}

	function handleNameDblClick(event: MouseEvent, file: WorkspaceFile): void {
		event.stopPropagation();
		startRename(file);
	}

	// --- Delete ---

	function requestDelete(event: MouseEvent, file: WorkspaceFile): void {
		event.stopPropagation();
		deleteTarget = file;
		showDeleteConfirm = true;
	}

	async function confirmDelete(): Promise<void> {
		if (!deleteTarget) return;
		showDeleteConfirm = false;
		const filePath = $currentPath ? `${$currentPath}/${deleteTarget.name}` : deleteTarget.name;
		try {
			await deleteFile(filePath);
			// If deleted file was the active file, clear the preview
			if ($activeFileName === filePath) {
				activeFile.set(null);
				activeFileName.set('');
				editing = false;
			}
			await loadFiles($currentPath || undefined);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to delete file';
		}
		deleteTarget = null;
	}

	function cancelDelete(): void {
		showDeleteConfirm = false;
		deleteTarget = null;
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
		<nav class="flex items-center space-x-1 text-sm" aria-label="File breadcrumb">
			<button
				on:click={() => handleNavigate('')}
				class="text-slate-400 transition-colors hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500"
				class:text-slate-100={pathSegments.length === 0}
			>
				Home aria-current={pathSegments.length === 0 ? 'page' : undefined}
			</button>
			{#each pathSegments as segment, i (i)}
				<span class="text-slate-600">/</span>
				<button
					on:click={() => handleNavigate(breadcrumbPath(i))}
					class="text-slate-400 transition-colors hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500"
					class:text-slate-100={i === pathSegments.length - 1}
				>
					aria-current={i === pathSegments.length - 1 ? 'page' : undefined}
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
			<!-- File actions toolbar -->
			<FileActions on:newfile={handleNewFile} on:newfolder={handleNewFolder} />

			{#if loading}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-slate-400">Loading files...</p>
				</div>
			{:else if errorMessage}
				<div
					class="flex flex-1 flex-col items-center justify-center space-y-3"
					aria-live="assertive"
				>
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
					class="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-700 px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-400 md:grid-cols-[1fr_auto_auto_auto]"
				>
					<button
						on:click={() => toggleSort('name')}
						class="text-left transition-colors hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500"
						aria-label="Sort by name"
					>
						Name{sortIndicator('name')}
					</button>
					<button
						on:click={() => toggleSort('mtime')}
						class="hidden w-24 text-right transition-colors hover:text-slate-200 md:block focus-visible:ring-2 focus-visible:ring-blue-500"
						aria-label="Sort by modified date"
					>
						Modified{sortIndicator('mtime')}
					</button>
					<button
						on:click={() => toggleSort('size')}
						class="hidden w-20 text-right transition-colors hover:text-slate-200 md:block focus-visible:ring-2 focus-visible:ring-blue-500"
						aria-label="Sort by size"
					>
						Size{sortIndicator('size')}
					</button>
					<span class="w-10"></span>
				</div>

				<!-- File rows -->
				<div class="flex-1 overflow-y-auto" use:pullToRefresh={{ onRefresh: refreshFileList }}>
					{#each sortedFiles as file (file.name)}
						<div
							class="group grid w-full grid-cols-[1fr_auto] gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-700/50 md:grid-cols-[1fr_auto_auto_auto] {isFileActive(
								file
							)
								? 'bg-slate-700/30'
								: ''}"
						>
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<span
								class="flex cursor-pointer items-center space-x-2 truncate"
								on:click={() => handleFileClick(file)}
							>
								<span class="flex-shrink-0 text-slate-400">
									{#if file.isDirectory}
										<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
											<path
												d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
											/>
										</svg>
									{:else}
										<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
											<path
												fill-rule="evenodd"
												d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
												clip-rule="evenodd"
											/>
										</svg>
									{/if}
								</span>
								{#if renamingFile === file.name}
									<!-- svelte-ignore a11y-click-events-have-key-events -->
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<span on:click|stopPropagation={() => {}}>
										<input
											bind:this={renameInputEl}
											bind:value={renameValue}
											on:keydown={handleRenameKeydown}
											on:blur={submitRename}
											class="w-full rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
											aria-label="Rename file"
										/>
									</span>
								{:else}
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<span
										class="truncate"
										class:text-slate-100={file.isDirectory}
										class:text-slate-300={!file.isDirectory}
										on:dblclick={(e) => handleNameDblClick(e, file)}
									>
										{file.name}
									</span>
								{/if}
							</span>
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<span
								class="hidden w-24 cursor-pointer text-right text-xs text-slate-500 md:block"
								title={new Date(file.mtime).toLocaleString()}
								on:click={() => handleFileClick(file)}
							>
								{formatRelativeTime(new Date(file.mtime).getTime(), now)}
							</span>
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<span
								class="hidden w-20 cursor-pointer text-right text-xs text-slate-500 md:block"
								on:click={() => handleFileClick(file)}
							>
								{file.isDirectory ? '--' : formatFileSize(file.size)}
							</span>
							<span class="flex w-10 items-center justify-center">
								<button
									on:click={(e) => requestDelete(e, file)}
									class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-slate-500 opacity-100 transition-all hover:bg-red-900/30 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
									aria-label="Delete {file.name}"
								>
									<svg
										class="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Preview pane (right pane) -->
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if $activeFile}
				{#if editing}
					{#if saveError}
						<div class="border-b border-red-800 bg-red-900/30 px-4 py-2" aria-live="assertive">
							<p class="text-sm text-red-400">{saveError}</p>
						</div>
					{/if}
					<FileEditor
						content={$activeFile.content}
						filename={$activeFileName}
						on:save={handleSave}
						on:cancel={cancelEditing}
					/>
				{:else}
					<div class="flex items-center justify-between border-b border-slate-700 px-4 py-2">
						<h3 class="text-sm font-medium text-slate-200">{$activeFileName}</h3>
						<button
							on:click={startEditing}
							class="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-600"
						>
							Edit
						</button>
					</div>
					<div class="flex-1 overflow-y-auto p-4">
						<FilePreview content={$activeFile.content} filename={$activeFileName} />
					</div>
				{/if}
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-slate-400">Select a file to preview</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	title="Delete {deleteTarget?.isDirectory ? 'folder' : 'file'}"
	message="Are you sure you want to delete &quot;{deleteTarget?.name ??
		''}&quot;? This action cannot be undone."
	confirmLabel="Delete"
	open={showDeleteConfirm}
	on:confirm={confirmDelete}
	on:cancel={cancelDelete}
/>
