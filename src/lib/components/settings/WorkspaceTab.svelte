<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { WorkspaceFile } from '$lib/types';
	import { loadFile, saveFile, createFile, activeFile, activeFileName } from '$lib/stores';
	import { formatRelativeTime } from '$lib/utils/time';
	import FilePreview from '$lib/components/files/FilePreview.svelte';
	import FileEditor from '$lib/components/files/FileEditor.svelte';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';

	interface WorkspaceFileDef {
		name: string;
		description: string;
		exists: boolean;
		mtime: string | null;
	}

	const KNOWN_FILES: { name: string; description: string }[] = [
		{ name: 'SOUL.md', description: 'Agent personality and behavioral guidelines' },
		{ name: 'AGENTS.md', description: 'Agent capabilities and role definitions' },
		{ name: 'TOOLS.md', description: 'Available tools and integrations' },
		{ name: 'USER.md', description: 'User preferences and context' },
		{ name: 'IDENTITY.md', description: 'Agent identity and naming' },
		{ name: 'HEARTBEAT.md', description: 'Periodic heartbeat configuration' },
		{ name: 'BOOTSTRAP.md', description: 'Startup initialization instructions' },
		{ name: 'MEMORY.md', description: 'Persistent memory and learnings' }
	];

	let workspaceFiles = $state<WorkspaceFileDef[]>(
		KNOWN_FILES.map((f) => ({
			...f,
			exists: false,
			mtime: null
		}))
	);

	let selectedFile = $state<string | null>(null);
	let editing = $state(false);
	let loading = $state(true);
	let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
	let showResetConfirm = $state(false);
	let now = $state(Date.now());

	let toastTimeout: ReturnType<typeof setTimeout> | undefined;
	let nowInterval: ReturnType<typeof setInterval> | undefined;

	function showToast(message: string, type: 'success' | 'error'): void {
		if (toastTimeout) clearTimeout(toastTimeout);
		toast = { message, type };
		toastTimeout = setTimeout(() => {
			toast = null;
		}, 3000);
	}

	async function fetchFileList(): Promise<void> {
		loading = true;
		try {
			const res = await fetch('/api/workspace/files');
			if (!res.ok) throw new Error(res.statusText);
			const data: { files: WorkspaceFile[] } = await res.json();
			const fileMap = new Map<string, WorkspaceFile>();
			for (const f of data.files) {
				fileMap.set(f.name, f);
			}
			workspaceFiles = KNOWN_FILES.map((def) => {
				const found = fileMap.get(def.name);
				return {
					...def,
					exists: !!found,
					mtime: found ? found.mtime : null
				};
			});
		} catch {
			showToast('Failed to load workspace files', 'error');
		} finally {
			loading = false;
		}
	}

	async function handleSelectFile(name: string): Promise<void> {
		editing = false;
		selectedFile = name;
		try {
			await loadFile(name);
		} catch {
			showToast(`Failed to load ${name}`, 'error');
			selectedFile = null;
		}
	}

	async function handleCreateFile(name: string): Promise<void> {
		try {
			await createFile(name, '');
			await fetchFileList();
			await handleSelectFile(name);
			showToast(`Created ${name}`, 'success');
		} catch {
			showToast(`Failed to create ${name}`, 'error');
		}
	}

	function startEditing(): void {
		editing = true;
	}

	function cancelEditing(): void {
		editing = false;
	}

	function requestReset(): void {
		showResetConfirm = true;
	}

	async function confirmReset(): Promise<void> {
		showResetConfirm = false;
		if (!selectedFile) return;
		editing = false;
		try {
			await loadFile(selectedFile);
		} catch {
			showToast(`Failed to reload ${selectedFile}`, 'error');
		}
	}

	function cancelReset(): void {
		showResetConfirm = false;
	}

	async function handleSave(data: { content: string }): Promise<void> {
		if (!$activeFile || !selectedFile) return;
		try {
			const result = await saveFile(selectedFile, data.content, $activeFile.hash);
			activeFile.set({
				content: data.content,
				hash: result.hash,
				mtime: new Date().toISOString()
			});
			editing = false;
			// Update mtime in workspace files list
			workspaceFiles = workspaceFiles.map((f) =>
				f.name === selectedFile ? { ...f, mtime: new Date().toISOString() } : f
			);
			showToast(`Saved ${selectedFile}`, 'success');
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to save file';
			showToast(msg, 'error');
		}
	}

	let selectedDef = $derived(workspaceFiles.find((f) => f.name === selectedFile) ?? null);

	onMount(() => {
		fetchFileList();
		nowInterval = setInterval(() => {
			now = Date.now();
		}, 30000);
	});

	onDestroy(() => {
		if (toastTimeout) clearTimeout(toastTimeout);
		if (nowInterval) clearInterval(nowInterval);
		activeFile.set(null);
		activeFileName.set('');
	});
</script>

<div class="flex h-full flex-col">
	<!-- Toast notification -->
	{#if toast}
		<div
			class="px-4 py-2 text-sm {toast.type === 'success'
				? 'border-b border-green-800 bg-green-900/30 text-green-400'
				: 'border-b border-red-800 bg-red-900/30 text-red-400'}"
		>
			{toast.message}
		</div>
	{/if}

	<div class="flex flex-1 flex-col overflow-hidden md:flex-row">
		<!-- File list (left pane) -->
		<div
			class="flex w-full flex-col overflow-hidden border-b border-slate-700 md:w-80 md:border-b-0 md:border-r"
		>
			<div class="border-b border-slate-700 px-4 py-3">
				<h3 class="text-sm font-medium text-slate-200">Workspace Files</h3>
				<p class="mt-1 text-xs text-slate-400">
					Agent definition files that shape behavior and identity.
				</p>
			</div>

			{#if loading}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-slate-400">Loading...</p>
				</div>
			{:else}
				<div class="flex-1 overflow-y-auto">
					{#each workspaceFiles as file (file.name)}
						<div
							class="group border-b border-slate-700/50 px-4 py-3 transition-colors {selectedFile ===
							file.name
								? 'bg-slate-700/30'
								: 'hover:bg-slate-700/20'}"
						>
							<div class="flex items-start justify-between">
								{#if file.exists}
									<button
										onclick={() => handleSelectFile(file.name)}
										class="min-w-0 flex-1 text-left"
									>
										<span class="block text-sm font-medium text-slate-200">{file.name}</span>
										<span class="mt-0.5 block text-xs text-slate-400">{file.description}</span>
										{#if file.mtime}
											<span class="mt-1 block text-xs text-slate-500">
												Modified {formatRelativeTime(new Date(file.mtime).getTime(), now)}
											</span>
										{/if}
									</button>
								{:else}
									<div class="min-w-0 flex-1">
										<span class="block text-sm font-medium text-slate-400">{file.name}</span>
										<span class="mt-0.5 block text-xs text-slate-500">{file.description}</span>
									</div>
									<button
										onclick={() => handleCreateFile(file.name)}
										class="ml-2 flex-shrink-0 rounded bg-blue-600 px-2.5 py-1 text-xs text-white transition-colors hover:bg-blue-500"
									>
										Create
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Preview / Editor pane (right pane) -->
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if selectedFile && $activeFile}
				{#if editing}
					<FileEditor
						content={$activeFile.content}
						filename={selectedFile}
						onsave={handleSave}
						oncancel={cancelEditing}
					/>
				{:else}
					<div class="flex items-center justify-between border-b border-slate-700 px-4 py-2">
						<div class="min-w-0">
							<h3 class="text-sm font-medium text-slate-200">{selectedFile}</h3>
							{#if selectedDef}
								<p class="text-xs text-slate-400">{selectedDef.description}</p>
							{/if}
						</div>
						<div class="ml-4 flex items-center space-x-2">
							<button
								onclick={requestReset}
								class="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-600"
							>
								Reset
							</button>
							<button
								onclick={startEditing}
								class="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-500"
							>
								Edit
							</button>
						</div>
					</div>
					<div class="flex-1 overflow-y-auto p-4">
						<FilePreview content={$activeFile.content} filename={selectedFile} />
					</div>
				{/if}
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<div class="text-center">
						<p class="text-sm text-slate-400">Select a workspace file to preview</p>
						<p class="mt-1 text-xs text-slate-500">
							Click a file name on the left to view or edit it.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	title="Reset changes"
	message="Discard any unsaved changes and reload the file from disk?"
	confirmLabel="Reset"
	open={showResetConfirm}
	onconfirm={confirmReset}
	oncancel={cancelReset}
/>
