<script lang="ts">
	import { call } from '$lib/stores/gateway.js';
	import MarkdownRenderer from '../MarkdownRenderer.svelte';

	type FileInfo = {
		path: string;
		size: number;
		hash: string;
	};

	type FileListResponse = {
		files: FileInfo[];
	};

	type FileGetResponse = {
		content: string;
		hash: string;
	};

	const KNOWN_FILES = [
		{ path: 'SOUL.md', icon: '🌟' },
		{ path: 'AGENTS.md', icon: '🤖' },
		{ path: 'TOOLS.md', icon: '🔧' },
		{ path: 'USER.md', icon: '👤' },
		{ path: 'IDENTITY.md', icon: '🎭' },
		{ path: 'HEARTBEAT.md', icon: '💓' },
		{ path: 'BOOTSTRAP.md', icon: '🚀' },
		{ path: 'MEMORY.md', icon: '🧠' }
	];

	let files = $state<FileInfo[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedFile = $state<FileInfo | null>(null);
	let fileContent = $state('');
	let fileHash = $state('');
	let isEditing = $state(false);
	let editContent = $state('');
	let saving = $state(false);
	let conflictError = $state(false);

	async function loadFileList() {
		loading = true;
		error = null;
		try {
			const response = await call<FileListResponse>('agents-files.list');
			files = response.files;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load file list';
		} finally {
			loading = false;
		}
	}

	async function loadFileContent(file: FileInfo) {
		selectedFile = file;
		fileContent = '';
		fileHash = '';
		isEditing = false;
		conflictError = false;
		try {
			const response = await call<FileGetResponse>('agents-files.get', { path: file.path });
			fileContent = response.content;
			fileHash = response.hash;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load file content';
		}
	}

	async function saveFile() {
		if (!selectedFile) return;
		saving = true;
		conflictError = false;
		try {
			await call('agents-files.set', {
				path: selectedFile.path,
				content: editContent,
				baseHash: fileHash
			});
			fileContent = editContent;
			fileHash = ''; // Hash will be updated on next load
			isEditing = false;
			await loadFileList(); // Refresh list to get new hash
		} catch (e) {
			if (e instanceof Error && e.message.includes('409')) {
				conflictError = true;
			} else {
				error = e instanceof Error ? e.message : 'Failed to save file';
			}
		} finally {
			saving = false;
		}
	}

	async function createFile(path: string) {
		saving = true;
		error = null;
		try {
			const template = `# ${path.replace('.md', '')}\n\n`;
			await call('agents-files.set', {
				path,
				content: template,
				baseHash: ''
			});
			await loadFileList();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create file';
		} finally {
			saving = false;
		}
	}

	function startEditing() {
		editContent = fileContent;
		isEditing = true;
		conflictError = false;
	}

	function cancelEditing() {
		isEditing = false;
		editContent = '';
		conflictError = false;
	}

	async function reloadAfterConflict() {
		if (!selectedFile) return;
		await loadFileContent(selectedFile);
		startEditing();
		conflictError = false;
	}

	$effect(() => {
		loadFileList();
	});

	const knownFilesSet = new Set(KNOWN_FILES.map((f) => f.path));
	const existingKnownFiles = $derived(
		KNOWN_FILES.filter((kf) => files.some((f) => f.path === kf.path))
	);
	const missingKnownFiles = $derived(
		KNOWN_FILES.filter((kf) => !files.some((f) => f.path === kf.path))
	);
	const additionalFiles = $derived(files.filter((f) => !knownFilesSet.has(f.path)));
</script>

<div class="flex h-full flex-col overflow-hidden bg-gray-900">
	<div class="border-b border-gray-800 px-4 py-3">
		<h2 class="text-lg font-semibold text-white">Workspace Files</h2>
		<p class="text-sm text-gray-400">Manage agent workspace configuration files</p>
	</div>

	{#if error}
		<div class="border-b border-red-800 bg-red-900/50 px-4 py-2 text-sm text-red-300">
			{error}
			<button
				onclick={() => {
					error = null;
				}}
				class="ml-2 text-xs underline"
			>
				Dismiss
			</button>
		</div>
	{/if}

	<div class="flex flex-1 overflow-hidden">
		<!-- File list sidebar -->
		<div class="w-80 flex-shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-900">
			{#if loading}
				<div class="p-4 text-center text-sm text-gray-500">Loading files...</div>
			{:else}
				<!-- Known files -->
				<div class="border-b border-gray-800 px-4 py-3">
					<h3 class="mb-2 text-xs font-semibold uppercase text-gray-500">Known Files</h3>
					<div class="space-y-1">
						{#each existingKnownFiles as knownFile}
							{@const fileInfo = files.find((f) => f.path === knownFile.path)}
							{#if fileInfo}
								<button
									onclick={() => loadFileContent(fileInfo)}
									class="flex w-full items-center gap-2 rounded px-2 py-2 text-left transition-colors {selectedFile?.path ===
									fileInfo.path
										? 'bg-blue-600 text-white'
										: 'text-gray-300 hover:bg-gray-800'}"
								>
									<span class="text-lg">{knownFile.icon}</span>
									<span class="flex-1 text-sm">{knownFile.path}</span>
									<span class="text-xs text-gray-500">{(fileInfo.size / 1024).toFixed(1)}KB</span>
								</button>
							{/if}
						{/each}
						{#each missingKnownFiles as knownFile}
							<div class="flex items-center gap-2 px-2 py-2">
								<span class="text-lg opacity-50">{knownFile.icon}</span>
								<span class="flex-1 text-sm text-gray-500">{knownFile.path}</span>
								<button
									onclick={() => createFile(knownFile.path)}
									disabled={saving}
									class="rounded bg-green-600 px-2 py-1 text-xs text-white transition-colors hover:bg-green-500 disabled:opacity-50"
								>
									Create
								</button>
							</div>
						{/each}
					</div>
				</div>

				<!-- Additional files -->
				{#if additionalFiles.length > 0}
					<div class="px-4 py-3">
						<h3 class="mb-2 text-xs font-semibold uppercase text-gray-500">Additional Files</h3>
						<div class="space-y-1">
							{#each additionalFiles as file}
								<button
									onclick={() => loadFileContent(file)}
									class="flex w-full items-center gap-2 rounded px-2 py-2 text-left transition-colors {selectedFile?.path ===
									file.path
										? 'bg-blue-600 text-white'
										: 'text-gray-300 hover:bg-gray-800'}"
								>
									<span class="text-lg">📄</span>
									<span class="flex-1 text-sm">{file.path}</span>
									<span class="text-xs text-gray-500">{(file.size / 1024).toFixed(1)}KB</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<!-- File viewer/editor -->
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if !selectedFile}
				<div class="flex flex-1 items-center justify-center text-gray-500">
					Select a file to view or edit
				</div>
			{:else if isEditing}
				<!-- Editor mode -->
				<div class="flex flex-col overflow-hidden">
					<div class="flex items-center justify-between border-b border-gray-800 px-4 py-2">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-white">{selectedFile.path}</span>
							<span class="text-xs text-yellow-400">Editing</span>
						</div>
						<div class="flex items-center gap-2">
							<button
								onclick={cancelEditing}
								class="rounded px-3 py-1 text-xs text-gray-400 hover:text-white"
							>
								Cancel
							</button>
							<button
								onclick={saveFile}
								disabled={saving}
								class="rounded bg-blue-600 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
							>
								{saving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>

					{#if conflictError}
						<div
							class="border-b border-yellow-800 bg-yellow-900/50 px-4 py-2 text-sm text-yellow-300"
						>
							Conflict detected: file was modified by another process.
							<button onclick={reloadAfterConflict} class="ml-2 underline">
								Reload and continue editing
							</button>
						</div>
					{/if}

					<textarea
						bind:value={editContent}
						class="flex-1 resize-none bg-gray-950 p-4 font-mono text-sm text-gray-300 focus:outline-none"
						spellcheck="false"
					></textarea>
				</div>
			{:else}
				<!-- Viewer mode -->
				<div class="flex flex-col overflow-hidden">
					<div class="flex items-center justify-between border-b border-gray-800 px-4 py-2">
						<span class="text-sm font-medium text-white">{selectedFile.path}</span>
						<button
							onclick={startEditing}
							class="rounded bg-gray-700 px-3 py-1 text-xs text-white transition-colors hover:bg-gray-600"
						>
							Edit
						</button>
					</div>

					<div class="flex-1 overflow-y-auto p-4">
						{#if selectedFile.path.endsWith('.md')}
							<MarkdownRenderer content={fileContent} />
						{:else}
							<pre class="font-mono text-sm text-gray-300">{fileContent}</pre>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
