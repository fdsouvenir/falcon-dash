<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { A2UIHost, CanvasFrame } from '$lib/components/canvas';
	import { getApp, renameApp, unpinApp } from '$lib/stores/apps';
	import type { CustomApp } from '$lib/types/canvas';

	let appId = $derived($page.params.id ?? '');
	let app = $derived(appId ? (getApp(appId) as CustomApp | undefined) : undefined);

	let editing = $state(false);
	let editName = $state('');

	function startRename(): void {
		if (!app) return;
		editName = app.name;
		editing = true;
	}

	function saveRename(): void {
		if (!app || !editName.trim()) return;
		renameApp(app.id, editName.trim());
		editing = false;
	}

	function cancelRename(): void {
		editing = false;
	}

	function handleRenameKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') saveRename();
		if (e.key === 'Escape') cancelRename();
	}

	function handleUnpin(): void {
		if (!app) return;
		unpinApp(app.id);
		goto('/');
	}
</script>

{#if app}
	<div class="flex h-full flex-col bg-slate-900">
		<!-- Header bar -->
		<div class="flex items-center justify-between border-b border-slate-700 px-4 py-2">
			<div class="flex items-center gap-3">
				{#if editing}
					<input
						type="text"
						bind:value={editName}
						aria-label="Edit app name"
						onkeydown={handleRenameKeydown}
						onblur={saveRename}
						class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 outline-none focus:border-blue-500"
					/>
				{:else}
					<h1 class="text-lg font-semibold text-slate-100">{app.name}</h1>
					<button
						onclick={startRename}
						aria-label="Rename app"
						class="rounded p-1 focus-visible:ring-2 focus-visible:ring-blue-500 text-slate-400 transition-colors hover:text-slate-200"
						title="Rename app"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
							/>
						</svg>
					</button>
				{/if}
				<span class="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
					{app.mode === 'a2ui' ? 'A2UI' : 'Canvas'}
				</span>
			</div>
			<button
				onclick={handleUnpin}
				class="rounded px-3 py-1 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
			>
				Unpin
			</button>
		</div>

		<!-- Canvas content -->
		<div class="flex-1 overflow-hidden">
			{#if app.mode === 'canvas' && app.canvasPath}
				<CanvasFrame path={app.canvasPath} title={app.name} />
			{:else if app.mode === 'a2ui' && app.a2uiMessages}
				<A2UIHost messages={app.a2uiMessages} standalone={true} />
			{:else}
				<div class="flex h-full items-center justify-center text-slate-500">
					<div class="text-center">
						<p class="text-lg">No content available</p>
						<p class="mt-1 text-sm">This app has no canvas data to display yet.</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex h-full items-center justify-center bg-slate-900">
		<div class="text-center">
			<p class="text-lg text-slate-300">App not found</p>
			<p class="mt-1 text-sm text-slate-500">This custom app may have been unpinned.</p>
			<a
				href="/"
				class="mt-4 inline-block rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
			>
				Go Home
			</a>
		</div>
	</div>
{/if}
