<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import { pinnedApps, pinApp, unpinApp, isPinned } from '$lib/stores/pinned-apps.js';
	import { isMobile } from '$lib/stores/viewport.js';
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
				surface = found;
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

	let pinned = $derived(surface ? isPinned(surface.surfaceId, $pinnedApps) : false);
	let isGenericTitle = $derived(
		surface ? !surface.title || /^Canvas(\s|$)/.test(surface.title) : true
	);

	let loadingTimedOut = $state(false);
	let iframeFailed = $state(false);

	$effect(() => {
		if (surface && surface.messages.length === 0) {
			loadingTimedOut = false;
			const timer = setTimeout(() => {
				loadingTimedOut = true;
			}, 10_000);
			return () => clearTimeout(timer);
		}
	});

	let mobile = $state(false);
	$effect(() => {
		const unsub = isMobile.subscribe((v) => {
			mobile = v;
		});
		return unsub;
	});

	function togglePin() {
		if (!surface) return;
		if (pinned) {
			unpinApp(surface.surfaceId);
		} else {
			pinApp(surface.surfaceId, surface.title ?? 'Canvas', {
				url: surface.url,
				title: surface.title
			});
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
				<span class="canvas-title"
					>{surface.title}{#if isGenericTitle && surface.surfaceId}<span class="canvas-subtitle"
							>{surface.surfaceId}</span
						>{/if}</span
				>
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
		{#if mobile}
			<div class="canvas-mobile-gate">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
					/>
				</svg>
				<span>View on desktop</span>
			</div>
		{:else if surface.messages.length > 0}
			<div class="canvas-content">
				<InlineA2UI messages={surface.messages} />
			</div>
		{:else if surface.url && !iframeFailed}
			<div class="canvas-content">
				<HTMLCanvasFrame
					url={surface.url}
					surfaceId={surface.surfaceId}
					onfailure={() => (iframeFailed = true)}
				/>
			</div>
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

	.canvas-subtitle {
		margin-left: 0.5rem;
		font-weight: 400;
		font-size: 0.6875rem;
		color: var(--color-text-tertiary, #6c7086);
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

	.canvas-content {
		max-height: 32rem;
		overflow-y: auto;
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

	.canvas-mobile-gate {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.75rem;
		color: var(--color-text-tertiary, #6c7086);
		font-size: 0.75rem;
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
