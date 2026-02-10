<script lang="ts">
	import { canvasStore } from '$lib/stores/gateway.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import InlineA2UI from './InlineA2UI.svelte';

	interface Props {
		runId?: string;
		surfaceId?: string;
	}

	let { runId, surfaceId }: Props = $props();

	let surface = $state<CanvasSurface | null>(null);

	// Subscribe to canvas store to find surface by runId or surfaceId
	$effect(() => {
		if (surfaceId) {
			const unsub = canvasStore.surfaces.subscribe((surfaces: Map<string, CanvasSurface>) => {
				surface = surfaces.get(surfaceId) ?? null;
			});
			return unsub;
		} else if (runId) {
			const derived = canvasStore.surfaceByRunId(runId);
			const unsub = derived.subscribe((s: CanvasSurface | null) => {
				surface = s;
			});
			return unsub;
		} else {
			surface = null;
		}
	});
</script>

{#if surface && surface.visible && surface.messages.length > 0}
	<div class="canvas-block">
		{#if surface.title}
			<div class="canvas-header">
				<span class="canvas-icon">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<path d="M3 9h18" />
						<path d="M9 21V9" />
					</svg>
				</span>
				<span class="canvas-title">{surface.title}</span>
			</div>
		{/if}
		<InlineA2UI messages={surface.messages} surfaceId={surface.surfaceId} />
	</div>
{/if}

<style>
	.canvas-block {
		margin: 0.5rem 0;
		border: 1px solid var(--color-border, #313244);
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--color-bg-secondary, #1e1e2e);
	}

	.canvas-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-border, #313244);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary, #a6adc8);
	}

	.canvas-icon {
		display: flex;
		align-items: center;
		color: var(--color-text-tertiary, #6c7086);
	}

	.canvas-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
