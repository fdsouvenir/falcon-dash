<script lang="ts">
	import { onMount } from 'svelte';
	import { canvasStore } from '$lib/stores/gateway.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import InlineA2UI from './InlineA2UI.svelte';

	interface PinnedApp {
		id: string;
		name: string;
		surfaceId: string;
	}

	let pinnedApps = $state<PinnedApp[]>([]);
	let surfaces = $state<Map<string, CanvasSurface>>(new Map());
	let draggedIndex = $state<number | null>(null);

	onMount(() => {
		// Load pinned apps from localStorage
		const stored = localStorage.getItem('falcon-dash:pinned-apps');
		if (stored) {
			try {
				pinnedApps = JSON.parse(stored);
			} catch {
				pinnedApps = [];
			}
		}

		// Subscribe to canvas store for surface updates
		const unsub = canvasStore.surfaces.subscribe((s: Map<string, CanvasSurface>) => {
			surfaces = s;
		});

		return unsub;
	});

	function savePinnedApps() {
		localStorage.setItem('falcon-dash:pinned-apps', JSON.stringify(pinnedApps));
	}

	function unpinApp(id: string) {
		pinnedApps = pinnedApps.filter((app) => app.id !== id);
		savePinnedApps();
	}

	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function handleDrop(index: number) {
		if (draggedIndex === null) return;
		const draggedApp = pinnedApps[draggedIndex];
		pinnedApps.splice(draggedIndex, 1);
		pinnedApps.splice(index, 0, draggedApp);
		draggedIndex = null;
		savePinnedApps();
	}

	function getSurface(surfaceId: string): CanvasSurface | undefined {
		return surfaces.get(surfaceId);
	}
</script>

<div class="custom-app-panel">
	<h3 class="panel-title">Pinned Apps</h3>
	{#if pinnedApps.length === 0}
		<p class="empty-state">No pinned apps</p>
	{:else}
		<ul class="app-list">
			{#each pinnedApps as app, index (app.id)}
				{@const surface = getSurface(app.surfaceId)}
				<li
					class="app-item"
					draggable="true"
					ondragstart={() => handleDragStart(index)}
					ondragover={handleDragOver}
					ondrop={() => handleDrop(index)}
				>
					<div class="app-info">
						<span class="app-name">{app.name}</span>
						<button class="unpin-btn" onclick={() => unpinApp(app.id)} aria-label="Unpin app">
							×
						</button>
					</div>
					{#if surface && surface.messages.length > 0}
						<div class="app-canvas">
							<InlineA2UI messages={surface.messages} surfaceId={app.surfaceId} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.custom-app-panel {
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: 0.5rem;
	}

	.panel-title {
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0 0 0.75rem 0;
		color: var(--color-text-primary);
	}

	.empty-state {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-align: center;
		padding: 1rem;
	}

	.app-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.app-item {
		padding: 0.75rem;
		background: var(--color-bg-primary);
		border-radius: 0.375rem;
		cursor: move;
		transition: all 0.2s;
	}

	.app-item:hover {
		background: var(--color-bg-hover);
	}

	.app-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.app-name {
		font-size: 0.875rem;
		color: var(--color-text-primary);
		flex: 1;
	}

	.unpin-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.25rem;
	}

	.unpin-btn:hover {
		background: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.app-canvas {
		margin-top: 0.5rem;
		border-top: 1px solid var(--color-border, #313244);
		padding-top: 0.5rem;
	}
</style>
