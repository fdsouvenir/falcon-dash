<script lang="ts">
	import { canvasStore } from '$lib/stores/gateway.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import { pinnedApps, pinApp, unpinApp, isPinned } from '$lib/stores/pinned-apps.js';
	import InlineA2UI from './InlineA2UI.svelte';
	import HTMLCanvasFrame from './HTMLCanvasFrame.svelte';

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
				const found = surfaces.get(surfaceId) ?? null;
				console.log('[CanvasBlock] surface lookup:', {
					surfaceId,
					found: !!found,
					visible: found?.visible,
					msgCount: found?.messages.length
				});
				surface = found;
			});
			return unsub;
		} else if (runId) {
			const derived = canvasStore.surfaceByRunId(runId);
			const unsub = derived.subscribe((s: CanvasSurface | null) => {
				console.log('[CanvasBlock] surface lookup:', {
					runId,
					found: !!s,
					visible: s?.visible,
					msgCount: s?.messages.length
				});
				surface = s;
			});
			return unsub;
		} else {
			surface = null;
		}
	});

	let pinned = $derived(surface ? isPinned(surface.surfaceId, $pinnedApps) : false);

	let loadingTimedOut = $state(false);
	let iframeFailed = $state(false);

	$effect(() => {
		if (surface && surface.messages.length === 0 && !surface.url) {
			loadingTimedOut = false;
			const timer = setTimeout(() => {
				loadingTimedOut = true;
			}, 10_000);
			return () => clearTimeout(timer);
		}
	});

	function togglePin() {
		if (!surface) return;
		if (pinned) {
			unpinApp(surface.surfaceId);
		} else {
			pinApp(surface.surfaceId, surface.title ?? 'Canvas');
		}
	}
</script>

{#if surface && surface.visible}
	<div class="canvas-block">
		{#if surface.title || surface.surfaceId}
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
				<button
					class="pin-btn"
					onclick={togglePin}
					aria-label={pinned ? 'Unpin app' : 'Pin app'}
					title={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill={pinned ? 'currentColor' : 'none'}
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
						/>
					</svg>
				</button>
			</div>
		{/if}
		{#if surface.messages.length > 0}
			<InlineA2UI messages={surface.messages} />
		{:else if surface.url && !iframeFailed}
			<HTMLCanvasFrame url={surface.url} onfailure={() => (iframeFailed = true)} />
		{:else if loadingTimedOut || iframeFailed}
			<div class="canvas-empty">
				<span>No canvas content received.</span>
				<span class="canvas-empty-hint"
					>The agent created this surface but hasn't sent any content yet.</span
				>
			</div>
		{:else}
			<div class="canvas-loading">
				<div class="spinner"></div>
				<span>Loading canvas...</span>
			</div>
		{/if}
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

	.pin-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: none;
		border-radius: 0.25rem;
		background: none;
		color: var(--color-text-tertiary, #6c7086);
		cursor: pointer;
		transition: all 0.15s;
	}

	.pin-btn:hover {
		background: var(--color-bg-hover, #313244);
		color: var(--color-text-primary, #cdd6f4);
	}

	.canvas-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.5rem;
		color: var(--color-text-secondary, #a6adc8);
		font-size: 0.8125rem;
	}

	.canvas-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.5rem;
		color: var(--color-text-secondary, #a6adc8);
		font-size: 0.8125rem;
	}

	.canvas-empty-hint {
		color: var(--color-text-tertiary, #6c7086);
		font-size: 0.75rem;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--color-border, #313244);
		border-top-color: var(--color-text-secondary, #a6adc8);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
