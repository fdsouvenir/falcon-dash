<script lang="ts">
	import {
		sortedEntries,
		currentPath,
		breadcrumbs,
		isLoading,
		fileError,
		fileSearchQuery,
		loadDirectory,
		navigateUp,
		setSortField,
		sortField,
		sortDirection,
		createFile,
		createFolder,
		deleteEntry,
		renameEntry,
		uploadFile,
		selectedPaths,
		selectedCount,
		toggleSelection,
		selectAll,
		clearSelection,
		selectRange,
		bulkDelete,
		bulkMove,
		bulkDownload,
		type FileEntry,
		type SortField
	} from '$lib/stores/files.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';
	import { openFile } from '$lib/stores/editor.js';

	let entries = $state<FileEntry[]>([]);
	let path = $state('');
	let crumbs = $state<Array<{ name: string; path: string }>>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let query = $state('');
	let currentSort = $state<SortField>('name');
	let currentDirection = $state<'asc' | 'desc'>('asc');

	// Dialog state
	let showNewFileDialog = $state(false);
	let showNewFolderDialog = $state(false);
	let showDeleteConfirm = $state(false);
	let newFileName = $state('');
	let newFolderName = $state('');
	let deleteTarget = $state<FileEntry | null>(null);
	let renamingPath = $state<string | null>(null);
	let renameValue = $state('');
	let isDragging = $state(false);
	let contextMenu = $state<{ x: number; y: number; entry: FileEntry } | null>(null);

	// Bulk selection state
	let selected = $state<Set<string>>(new Set());
	let selCount = $state(0);
	let lastSelectedPath = $state<string | null>(null);
	let showBulkDeleteConfirm = $state(false);
	let showMoveDialog = $state(false);
	let moveDestination = $state('');

	let fileInputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		const u = sortedEntries.subscribe((v) => {
			entries = v;
		});
		return u;
	});
	$effect(() => {
		const u = currentPath.subscribe((v) => {
			path = v;
		});
		return u;
	});
	$effect(() => {
		const u = breadcrumbs.subscribe((v) => {
			crumbs = v;
		});
		return u;
	});
	$effect(() => {
		const u = isLoading.subscribe((v) => {
			loading = v;
		});
		return u;
	});
	$effect(() => {
		const u = fileError.subscribe((v) => {
			error = v;
		});
		return u;
	});
	$effect(() => {
		const u = sortField.subscribe((v) => {
			currentSort = v;
		});
		return u;
	});
	$effect(() => {
		const u = sortDirection.subscribe((v) => {
			currentDirection = v;
		});
		return u;
	});
	$effect(() => {
		const u = selectedPaths.subscribe((v) => {
			selected = v;
		});
		return u;
	});
	$effect(() => {
		const u = selectedCount.subscribe((v) => {
			selCount = v;
		});
		return u;
	});

	// Close context menu on click anywhere
	$effect(() => {
		function handleClick() {
			contextMenu = null;
		}
		document.addEventListener('click', handleClick);
		return () => document.removeEventListener('click', handleClick);
	});

	// Load root on mount
	$effect(() => {
		loadDirectory('');
	});

	function handleNavigate(entry: FileEntry) {
		if (entry.type === 'directory') {
			loadDirectory(entry.path);
		} else {
			openFile(entry.path);
		}
	}

	function handleSearch(e: Event) {
		const input = e.target as HTMLInputElement;
		query = input.value;
		fileSearchQuery.set(input.value);
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '—';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	function getIcon(entry: FileEntry): string {
		if (entry.type === 'directory') return '📁';
		const ext = entry.extension?.toLowerCase();
		if (['.md', '.mdx'].includes(ext ?? '')) return '📝';
		if (['.ts', '.js', '.py', '.go', '.rs', '.svelte', '.vue'].includes(ext ?? '')) return '💻';
		if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext ?? '')) return '🖼️';
		if (['.pdf'].includes(ext ?? '')) return '📄';
		if (['.json', '.yaml', '.yml', '.toml'].includes(ext ?? '')) return '⚙️';
		return '📄';
	}

	function sortIndicator(field: SortField): string {
		if (currentSort !== field) return '';
		return currentDirection === 'asc' ? ' ↑' : ' ↓';
	}

	// --- File operations ---
	async function handleCreateFile() {
		if (!newFileName.trim()) return;
		await createFile(newFileName.trim());
		newFileName = '';
		showNewFileDialog = false;
	}

	async function handleCreateFolder() {
		if (!newFolderName.trim()) return;
		await createFolder(newFolderName.trim());
		newFolderName = '';
		showNewFolderDialog = false;
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		await deleteEntry(deleteTarget.path);
		deleteTarget = null;
		showDeleteConfirm = false;
	}

	function confirmDelete(entry: FileEntry) {
		deleteTarget = entry;
		showDeleteConfirm = true;
		contextMenu = null;
	}

	function startRename(entry: FileEntry) {
		renamingPath = entry.path;
		renameValue = entry.name;
		contextMenu = null;
	}

	async function handleRename(entryPath: string) {
		if (!renameValue.trim() || !renamingPath) return;
		await renameEntry(entryPath, renameValue.trim());
		renamingPath = null;
		renameValue = '';
	}

	function handleRenameKeydown(e: KeyboardEvent, entryPath: string) {
		if (e.key === 'Enter') {
			handleRename(entryPath);
		} else if (e.key === 'Escape') {
			renamingPath = null;
			renameValue = '';
		}
	}

	async function copyPath(entry: FileEntry) {
		try {
			await navigator.clipboard.writeText(entry.path);
		} catch {
			// Fallback
			const ta = document.createElement('textarea');
			ta.value = entry.path;
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
		contextMenu = null;
	}

	function downloadFile(entry: FileEntry) {
		const url = `/api/files/${encodeURIComponent(entry.path)}`;
		const a = document.createElement('a');
		a.href = url;
		a.download = entry.name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		contextMenu = null;
	}

	// --- Upload ---
	function handleUploadClick() {
		fileInputEl?.click();
	}

	async function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (!files) return;
		for (const file of files) {
			await uploadFile(file);
		}
		input.value = '';
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const files = e.dataTransfer?.files;
		if (!files) return;
		for (const file of files) {
			await uploadFile(file);
		}
	}

	function handleContextMenu(e: MouseEvent, entry: FileEntry) {
		e.preventDefault();
		contextMenu = { x: e.clientX, y: e.clientY, entry };
	}

	function handleCheckbox(e: Event, entry: FileEntry) {
		e.stopPropagation();
		const mouseEvt = e as unknown as MouseEvent;
		if (mouseEvt.shiftKey && lastSelectedPath) {
			selectRange(lastSelectedPath, entry.path);
		} else {
			toggleSelection(entry.path);
		}
		lastSelectedPath = entry.path;
	}

	async function handleBulkDelete() {
		const paths = Array.from(selected);
		await bulkDelete(paths);
		showBulkDeleteConfirm = false;
	}

	async function handleBulkMove() {
		const paths = Array.from(selected);
		await bulkMove(paths, moveDestination);
		showMoveDialog = false;
		moveDestination = '';
	}

	async function handleBulkDownload() {
		const paths = Array.from(selected);
		await bulkDownload(paths);
	}

	function getAvailableFolders(): Array<{ name: string; path: string }> {
		const folders = entries.filter((e) => e.type === 'directory' && !selected.has(e.path));
		const result: Array<{ name: string; path: string }> = [];
		if (path) {
			const parts = path.split('/').filter(Boolean);
			parts.pop();
			result.push({ name: '.. (parent)', path: parts.join('/') });
		}
		for (const f of folders) {
			result.push({ name: f.name, path: f.path });
		}
		return result;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-full flex-col"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<!-- Breadcrumbs -->
	<div class="flex items-center gap-1 border-b border-gray-800 px-4 py-2">
		{#each crumbs as crumb, i (crumb.path)}
			{#if i > 0}
				<span class="text-xs text-gray-600">/</span>
			{/if}
			<button
				onclick={() => loadDirectory(crumb.path)}
				class="text-xs text-gray-400 transition-colors hover:text-white {i === crumbs.length - 1
					? 'font-medium text-white'
					: ''}"
			>
				{crumb.name}
			</button>
		{/each}
	</div>

	<!-- Search and toolbar -->
	<div class="flex items-center gap-2 border-b border-gray-800 px-4 py-2">
		<input
			type="text"
			value={query}
			oninput={handleSearch}
			placeholder="Search files..."
			class="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
		/>
		<button
			onclick={() => {
				showNewFileDialog = true;
			}}
			class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
		>
			+ File
		</button>
		<button
			onclick={() => {
				showNewFolderDialog = true;
			}}
			class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
		>
			+ Folder
		</button>
		<button
			onclick={handleUploadClick}
			class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
		>
			Upload
		</button>
		<input bind:this={fileInputEl} type="file" multiple class="hidden" onchange={handleFileInput} />
	</div>

	<!-- Bulk action bar -->
	{#if selCount > 0}
		<div class="flex items-center gap-2 border-b border-gray-800 bg-gray-800/50 px-4 py-2">
			<span class="text-xs text-white">{selCount} selected</span>
			<button onclick={selectAll} class="text-xs text-blue-400 hover:text-blue-300">
				Select All
			</button>
			<button onclick={clearSelection} class="text-xs text-gray-400 hover:text-white">
				Clear
			</button>
			<div class="ml-auto flex gap-2">
				<button
					onclick={handleBulkDownload}
					class="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 hover:text-white"
				>
					Download
				</button>
				<button
					onclick={() => {
						showMoveDialog = true;
					}}
					class="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 hover:text-white"
				>
					Move
				</button>
				<button
					onclick={() => {
						showBulkDeleteConfirm = true;
					}}
					class="rounded bg-red-600/80 px-2 py-1 text-xs text-white hover:bg-red-600"
				>
					Delete
				</button>
			</div>
		</div>
	{/if}

	<!-- Column headers -->
	<div
		class="grid grid-cols-[24px_1fr_120px_100px] gap-2 border-b border-gray-800 px-4 py-1.5 text-xs text-gray-500"
	>
		<input
			type="checkbox"
			checked={selCount > 0 && selCount === entries.length}
			onclick={selCount > 0 ? clearSelection : selectAll}
			class="h-3 w-3 accent-blue-500"
		/>
		<button onclick={() => setSortField('name')} class="text-left hover:text-white">
			Name{sortIndicator('name')}
		</button>
		<button onclick={() => setSortField('modified')} class="text-left hover:text-white">
			Modified{sortIndicator('modified')}
		</button>
		<button onclick={() => setSortField('size')} class="text-right hover:text-white">
			Size{sortIndicator('size')}
		</button>
	</div>

	<!-- Entries -->
	<div class="relative flex-1 overflow-y-auto">
		<!-- Drag overlay -->
		{#if isDragging}
			<div
				class="absolute inset-0 z-10 flex items-center justify-center rounded border-2 border-dashed border-blue-500 bg-blue-900/20"
			>
				<span class="text-sm text-blue-300">Drop files to upload</span>
			</div>
		{/if}

		{#if loading}
			<div class="py-8 text-center text-xs text-gray-500">Loading...</div>
		{:else if error}
			<div class="py-8 text-center text-xs text-red-400">{error}</div>
		{:else}
			<!-- Back entry -->
			{#if path}
				<button
					onclick={navigateUp}
					class="grid w-full grid-cols-[24px_1fr_120px_100px] gap-2 px-4 py-1.5 text-left text-xs text-gray-400 transition-colors hover:bg-gray-800"
				>
					<span></span>
					<span>📁 ..</span>
					<span></span>
					<span></span>
				</button>
			{/if}

			{#each entries as entry (entry.path)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					onclick={() => handleNavigate(entry)}
					oncontextmenu={(e) => handleContextMenu(e, entry)}
					class="group grid w-full cursor-pointer grid-cols-[24px_1fr_120px_100px] gap-2 px-4 py-1.5 text-left text-xs transition-colors hover:bg-gray-800 {entry.type ===
					'directory'
						? 'text-white'
						: 'text-gray-300'}"
				>
					<input
						type="checkbox"
						checked={selected.has(entry.path)}
						onclick={(e) => handleCheckbox(e, entry)}
						class="h-3 w-3 accent-blue-500"
					/>
					<span class="flex items-center gap-1 truncate">
						{#if renamingPath === entry.path}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								type="text"
								value={renameValue}
								oninput={(e) => {
									renameValue = (e.target as HTMLInputElement).value;
								}}
								onkeydown={(e) => handleRenameKeydown(e, entry.path)}
								onblur={() => handleRename(entry.path)}
								autofocus
								class="w-full rounded border border-gray-600 bg-gray-800 px-1 py-0.5 text-xs text-white focus:outline-none"
								onclick={(e) => e.stopPropagation()}
							/>
						{:else}
							{getIcon(entry)}
							{entry.name}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<span class="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<span
									onclick={(e) => {
										e.stopPropagation();
										startRename(entry);
									}}
									class="cursor-pointer rounded px-1 text-gray-500 hover:text-white"
									title="Rename"
								>
									✏️
								</span>
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<span
									onclick={(e) => {
										e.stopPropagation();
										copyPath(entry);
									}}
									class="cursor-pointer rounded px-1 text-gray-500 hover:text-white"
									title="Copy path"
								>
									📋
								</span>
								{#if entry.type === 'file'}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<span
										onclick={(e) => {
											e.stopPropagation();
											downloadFile(entry);
										}}
										class="cursor-pointer rounded px-1 text-gray-500 hover:text-white"
										title="Download"
									>
										⬇️
									</span>
								{/if}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<span
									onclick={(e) => {
										e.stopPropagation();
										confirmDelete(entry);
									}}
									class="cursor-pointer rounded px-1 text-gray-500 hover:text-red-400"
									title="Delete"
								>
									🗑️
								</span>
							</span>
						{/if}
					</span>
					<span class="text-gray-500" title={new Date(entry.modified).toLocaleString()}>
						{formatRelativeTime(entry.modified)}
					</span>
					<span class="text-right text-gray-500">{formatSize(entry.size)}</span>
				</div>
			{/each}

			{#if entries.length === 0 && !path}
				<div class="py-8 text-center text-xs text-gray-500">
					Empty folder — drag files here or use the toolbar to create
				</div>
			{/if}
		{/if}
	</div>

	<!-- Context menu -->
	{#if contextMenu}
		<div
			class="fixed z-50 min-w-[140px] rounded border border-gray-700 bg-gray-800 py-1 shadow-lg"
			style="left: {contextMenu.x}px; top: {contextMenu.y}px"
		>
			<button
				onclick={() => startRename(contextMenu!.entry)}
				class="block w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
			>
				Rename
			</button>
			<button
				onclick={() => copyPath(contextMenu!.entry)}
				class="block w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
			>
				Copy Path
			</button>
			{#if contextMenu.entry.type === 'file'}
				<button
					onclick={() => downloadFile(contextMenu!.entry)}
					class="block w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
				>
					Download
				</button>
			{/if}
			<hr class="my-1 border-gray-700" />
			<button
				onclick={() => confirmDelete(contextMenu!.entry)}
				class="block w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-gray-700"
			>
				Delete
			</button>
		</div>
	{/if}

	<!-- New File Dialog -->
	{#if showNewFileDialog}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={() => {
				showNewFileDialog = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') showNewFileDialog = false;
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="mb-3 text-sm font-medium text-white">New File</h3>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={newFileName}
					placeholder="filename.txt"
					autofocus
					class="mb-3 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleCreateFile();
						if (e.key === 'Escape') showNewFileDialog = false;
					}}
				/>
				<div class="flex justify-end gap-2">
					<button
						onclick={() => {
							showNewFileDialog = false;
						}}
						class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
					>
						Cancel
					</button>
					<button
						onclick={handleCreateFile}
						class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
					>
						Create
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- New Folder Dialog -->
	{#if showNewFolderDialog}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={() => {
				showNewFolderDialog = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') showNewFolderDialog = false;
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="mb-3 text-sm font-medium text-white">New Folder</h3>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={newFolderName}
					placeholder="folder-name"
					autofocus
					class="mb-3 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleCreateFolder();
						if (e.key === 'Escape') showNewFolderDialog = false;
					}}
				/>
				<div class="flex justify-end gap-2">
					<button
						onclick={() => {
							showNewFolderDialog = false;
						}}
						class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
					>
						Cancel
					</button>
					<button
						onclick={handleCreateFolder}
						class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
					>
						Create
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Delete Confirmation Dialog -->
	{#if showDeleteConfirm && deleteTarget}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={() => {
				showDeleteConfirm = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') showDeleteConfirm = false;
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="mb-2 text-sm font-medium text-white">
					Delete {deleteTarget.type === 'directory' ? 'Folder' : 'File'}
				</h3>
				<p class="mb-4 text-xs text-gray-400">
					Are you sure you want to delete <span class="font-medium text-white"
						>{deleteTarget.name}</span
					>?
					{#if deleteTarget.type === 'directory'}
						This will delete all contents.
					{/if}
				</p>
				<div class="flex justify-end gap-2">
					<button
						onclick={() => {
							showDeleteConfirm = false;
						}}
						class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
					>
						Cancel
					</button>
					<button
						onclick={handleDelete}
						class="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-500"
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Bulk Delete Confirmation Dialog -->
	{#if showBulkDeleteConfirm}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={() => {
				showBulkDeleteConfirm = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') showBulkDeleteConfirm = false;
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="mb-2 text-sm font-medium text-white">Delete {selCount} Items</h3>
				<p class="mb-4 text-xs text-gray-400">
					Are you sure you want to delete {selCount} selected items? This action cannot be undone.
				</p>
				<div class="flex justify-end gap-2">
					<button
						onclick={() => {
							showBulkDeleteConfirm = false;
						}}
						class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
					>
						Cancel
					</button>
					<button
						onclick={handleBulkDelete}
						class="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-500"
					>
						Delete All
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Move Dialog -->
	{#if showMoveDialog}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={() => {
				showMoveDialog = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') showMoveDialog = false;
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="mb-3 text-sm font-medium text-white">Move {selCount} Items</h3>
				<div class="mb-3 max-h-48 overflow-y-auto">
					{#each getAvailableFolders() as folder (folder.path)}
						<button
							onclick={() => {
								moveDestination = folder.path;
							}}
							class="block w-full rounded px-3 py-1.5 text-left text-xs transition-colors {moveDestination ===
							folder.path
								? 'bg-blue-600 text-white'
								: 'text-gray-300 hover:bg-gray-700'}"
						>
							📁 {folder.name}
						</button>
					{/each}
				</div>
				<div class="flex justify-end gap-2">
					<button
						onclick={() => {
							showMoveDialog = false;
						}}
						class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
					>
						Cancel
					</button>
					<button
						onclick={handleBulkMove}
						class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
					>
						Move
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
