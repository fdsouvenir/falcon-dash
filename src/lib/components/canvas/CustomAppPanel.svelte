<script lang="ts">
	import { canvasStore } from '$lib/stores/gateway.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import { pinnedApps, unpinApp } from '$lib/stores/pinned-apps.js';
	import InlineA2UI from './InlineA2UI.svelte';

	let surfaces = $state<Map<string, CanvasSurface>>(new Map());
	let draggedIndex = $state<number | null>(null);
	let confirmingId = $state<string | null>(null);

	$effect(() => {
		const unsub = canvasStore.surfaces.subscribe((s: Map<string, CanvasSurface>) => {
			surfaces = s;
		});
		return unsub;
	});

	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function handleDrop(index: number) {
		if (draggedIndex === null) return;
		pinnedApps.update((apps) => {
			const updated = [...apps];
			const [dragged] = updated.splice(draggedIndex!, 1);
			updated.splice(index, 0, dragged);
			return updated;
		});
		draggedIndex = null;
	}

	function getSurface(surfaceId: string): CanvasSurface | undefined {
		return surfaces.get(surfaceId);
	}

	function handleUnpin(surfaceId: string) {
		if (confirmingId === surfaceId) {
			unpinApp(surfaceId);
			confirmingId = null;
		} else {
			confirmingId = surfaceId;
		}
	}

	function cancelUnpin() {
		confirmingId = null;
	}
</script>

<div class="custom-app-panel">
	<h3 class="panel-title">Pinned Apps</h3>
	{#if $pinnedApps.length === 0}
		<p class="empty-state">No pinned apps</p>
	{:else}
		<ul class="app-list">
			{#each $pinnedApps as app, index (app.id)}
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
						{#if confirmingId === app.surfaceId}
							<div class="confirm-row">
								<span class="confirm-label">Remove?</span>
								<button
									class="confirm-btn"
									onclick={() => handleUnpin(app.surfaceId)}
									aria-label="Confirm remove"
								>
									Yes
								</button>
								<button class="cancel-btn" onclick={cancelUnpin} aria-label="Cancel remove">
									No
								</button>
							</div>
						{:else}
							<button
								class="unpin-btn"
								onclick={() => handleUnpin(app.surfaceId)}
								aria-label="Unpin app"
							>
								&times;
							</button>
						{/if}
					</div>
					{#if surface && surface.messages.length > 0}
						<div class="app-canvas">
							<InlineA2UI messages={surface.messages} />
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

	.confirm-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.confirm-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.confirm-btn {
		background: none;
		border: none;
		color: #f38ba8;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	.confirm-btn:hover {
		background: rgba(243, 139, 168, 0.15);
	}

	.cancel-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	.cancel-btn:hover {
		background: var(--color-bg-hover);
		color: var(--color-text-primary);
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
