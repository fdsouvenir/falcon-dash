<script lang="ts">
	import { onMount } from 'svelte';
	import { ensureA2UILoaded, type A2UIHostElement } from '$lib/canvas/a2ui-bridge.js';
	import { eventBus } from '$lib/stores/gateway.js';

	interface PinnedApp {
		id: string;
		name: string;
		surfaceId: string;
		state: unknown[];
	}

	let pinnedApps = $state<PinnedApp[]>([]);
	let surfaceRegistry = new Map<string, unknown[]>();
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

		// Subscribe to canvas.update events
		const unsubscribe = eventBus.on('canvas.update', (data: Record<string, unknown>) => {
			const surfaceId = data.surfaceId as string;
			const messages = data.messages as unknown[];
			if (surfaceId && messages) {
				surfaceRegistry.set(surfaceId, messages);
				// Update pinned app state if it exists
				const app = pinnedApps.find((a) => a.surfaceId === surfaceId);
				if (app) {
					app.state = messages;
					savePinnedApps();
				}
			}
		});

		return unsubscribe;
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
</script>

<div class="custom-app-panel">
	<h3 class="panel-title">Pinned Apps</h3>
	{#if pinnedApps.length === 0}
		<p class="empty-state">No pinned apps</p>
	{:else}
		<ul class="app-list">
			{#each pinnedApps as app, index (app.id)}
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
</style>
