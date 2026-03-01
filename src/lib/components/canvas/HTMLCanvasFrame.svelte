<script lang="ts">
	import { onMount } from 'svelte';
	import { canvasStore } from '$lib/stores/canvas.js';

	interface Props {
		url: string;
		surfaceId: string;
		onfailure?: () => void;
	}

	let { url, surfaceId, onfailure }: Props = $props();

	let iframeElement: HTMLIFrameElement | null = $state(null);
	let loaded = $state(false);
	let loadFailed = $state(false);

	function handleLoad() {
		loaded = true;
	}

	function handleError() {
		loadFailed = true;
		onfailure?.();
	}

	onMount(() => {
		// PostMessage bridge for canvas action callbacks
		function handleMessage(event: MessageEvent) {
			try {
				const urlOrigin = new URL(url).origin;
				if (event.origin !== urlOrigin) return;
			} catch {
				return;
			}
			if (event.data?.type === 'canvas-action') {
				canvasStore.sendAction(
					surfaceId,
					event.data.actionId ?? event.data.action ?? 'unknown',
					event.data.payload ?? {}
				);
			}
		}

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	});
</script>

<div class="html-canvas-frame">
	{#if loadFailed}
		<div class="canvas-error">
			<span>Failed to load canvas content.</span>
			<span class="canvas-error-hint">URL: {url}</span>
		</div>
	{:else}
		{#if !loaded}
			<div class="canvas-frame-loading">
				<div class="spinner"></div>
				<span>Loading...</span>
			</div>
		{/if}
		<iframe
			bind:this={iframeElement}
			src={url}
			sandbox="allow-scripts allow-same-origin"
			title="HTML Canvas"
			class:hidden={!loaded}
			onload={handleLoad}
			onerror={handleError}
		></iframe>
	{/if}
</div>

<style>
	.html-canvas-frame {
		width: 100%;
		border-radius: 0.375rem;
		overflow: hidden;
		background: var(--color-bg-secondary);
	}

	iframe {
		width: 100%;
		height: 400px;
		border: none;
		display: block;
		min-height: 200px;
		background: white;
	}

	iframe.hidden {
		display: none;
	}

	.canvas-frame-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.5rem;
		color: var(--color-text-secondary, #a6adc8);
		font-size: 0.8125rem;
	}

	.canvas-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.5rem;
		color: var(--color-text-secondary, #a6adc8);
		font-size: 0.8125rem;
	}

	.canvas-error-hint {
		color: var(--color-text-tertiary, #6c7086);
		font-size: 0.75rem;
		word-break: break-all;
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
