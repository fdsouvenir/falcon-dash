<script lang="ts">
	import { onMount } from 'svelte';
	import { snapshot } from '$lib/stores/gateway.js';

	interface Props {
		canvasId: string;
		canvasPort?: number;
	}

	let { canvasId, canvasPort }: Props = $props();

	let iframeElement: HTMLIFrameElement | null = $state(null);
	let frameHeight = $state(400);

	let serverInfo = $derived(snapshot.server);

	let canvasUrl = $derived(() => {
		const host = $serverInfo?.host ?? '127.0.0.1';
		const port = canvasPort ?? 18790;
		return `http://${host}:${port}/__openclaw__/canvas/${canvasId}`;
	});

	onMount(() => {
		// Set up postMessage bridge for action callbacks
		function handleMessage(event: MessageEvent) {
			const host = $serverInfo?.host ?? '127.0.0.1';
			const port = canvasPort ?? 18790;
			if (event.origin !== `http://${host}:${port}`) {
				return;
			}
			// Handle canvas action messages
			if (event.data?.type === 'canvas-action') {
				// Forward to gateway via canvas.action call
				console.log('Canvas action received:', event.data);
			}
		}

		window.addEventListener('message', handleMessage);

		// Set up ResizeObserver for auto-sizing
		let resizeObserver: ResizeObserver | null = null;
		if (iframeElement) {
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					if (entry.contentRect.height > 0) {
						frameHeight = entry.contentRect.height;
					}
				}
			});
			resizeObserver.observe(iframeElement);
		}

		return () => {
			window.removeEventListener('message', handleMessage);
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
		};
	});
</script>

<div class="html-canvas-frame">
	<iframe
		bind:this={iframeElement}
		src={canvasUrl()}
		sandbox="allow-scripts"
		title="HTML Canvas: {canvasId}"
		style="height: {frameHeight}px"
	>
		<!-- CSP will be set by the gateway server -->
	</iframe>
</div>

<style>
	.html-canvas-frame {
		width: 100%;
		margin: 0.5rem 0;
		border-radius: 0.375rem;
		overflow: hidden;
		background: var(--color-bg-secondary);
	}

	iframe {
		width: 100%;
		border: none;
		display: block;
		min-height: 200px;
		background: white;
	}
</style>
