<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { gateway } from '$lib/gateway';
	import type { A2UIHostElement, A2UIBundleState, A2UIUserAction } from '$lib/types/canvas';

	interface Props {
		/** A2UI messages to render (array of parsed JSONL objects) */
		messages?: Array<Record<string, unknown>>;
		/** Whether to show in standalone panel mode (taller) vs inline chat mode */
		standalone?: boolean;
	}

	let { messages = [], standalone = false }: Props = $props();

	const dispatch = createEventDispatcher<{
		action: A2UIUserAction;
		ready: void;
		error: string;
	}>();

	let containerEl: HTMLDivElement;
	let hostEl: A2UIHostElement | null = $state(null);
	let bundleState: A2UIBundleState = $state('idle');
	let errorMessage = $state('');

	// Track whether the bundle script has been loaded globally
	let bundleLoadPromise: Promise<void> | null = $state(null);

	/**
	 * Load the A2UI bundle script. The bundle registers <openclaw-a2ui-host>
	 * as a custom element on load. We cache the promise to avoid double-loading.
	 */
	async function loadBundle(): Promise<void> {
		if (bundleLoadPromise) return bundleLoadPromise;

		bundleLoadPromise = new Promise<void>((resolve, reject) => {
			// Check if already registered
			if (customElements.get('openclaw-a2ui-host')) {
				resolve();
				return;
			}

			const script = document.createElement('script');
			script.src = '/a2ui.bundle.js';
			script.async = true;

			function handleLoad() {
				cleanup();
				// Wait for custom element registration
				customElements
					.whenDefined('openclaw-a2ui-host')
					.then(() => resolve())
					.catch(() => reject(new Error('Custom element registration failed')));
			}

			function handleError() {
				cleanup();
				bundleLoadPromise = null;
				reject(new Error('Failed to load A2UI bundle'));
			}

			function cleanup() {
				script.removeEventListener('load', handleLoad);
				script.removeEventListener('error', handleError);
			}

			script.addEventListener('load', handleLoad);
			script.addEventListener('error', handleError);
			document.head.appendChild(script);
		});

		return bundleLoadPromise;
	}

	/**
	 * Set up the web-based action bridge before the A2UI bundle loads.
	 * The bundle expects globalThis.openclawCanvasA2UIAction to be available
	 * for dispatching user interactions.
	 */
	function setupActionBridge(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const g = globalThis as any;
		if (g.openclawCanvasA2UIAction) return;

		g.openclawCanvasA2UIAction = {
			postMessage: (json: string) => {
				try {
					const payload = JSON.parse(json);
					if (payload.userAction) {
						const action: A2UIUserAction = payload.userAction;
						dispatch('action', action);

						// Forward to gateway
						gateway
							.call('node.invoke', {
								command: 'canvas.a2ui.action',
								params: { userAction: action }
							} as Record<string, unknown>)
							.catch(() => {
								// Silently handle — action delivery is best-effort
							});
					}
				} catch {
					// Malformed JSON from action bridge — ignore
				}
			}
		};
	}

	/**
	 * Create the <openclaw-a2ui-host> element and insert it into the container.
	 */
	function createHostElement(): void {
		if (!containerEl || hostEl) return;

		const el = document.createElement('openclaw-a2ui-host');
		// eslint-disable-next-line svelte/no-dom-manipulating -- Web component host requires imperative DOM insertion
		containerEl.appendChild(el);
		hostEl = el as A2UIHostElement;
	}

	/**
	 * Apply messages to the A2UI host element.
	 */
	function applyMessages(msgs: Array<Record<string, unknown>>): void {
		if (!hostEl || msgs.length === 0) return;

		try {
			hostEl.applyMessages(msgs);
		} catch {
			errorMessage = 'Failed to render A2UI content';
			bundleState = 'error';
			dispatch('error', errorMessage);
		}
	}

	// Reactive: apply messages when they change (and bundle is ready)
	$effect(() => {
		if (bundleState === 'ready' && messages.length > 0) {
			applyMessages(messages);
		}
	});

	onMount(async () => {
		bundleState = 'loading';

		try {
			setupActionBridge();
			await loadBundle();
			createHostElement();
			bundleState = 'ready';
			dispatch('ready');

			// Apply any messages that were set before mount completed
			if (messages.length > 0) {
				applyMessages(messages);
			}
		} catch (err) {
			bundleState = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to load A2UI component';
			dispatch('error', errorMessage);
		}
	});

	onDestroy(() => {
		if (hostEl) {
			try {
				hostEl.reset();
			} catch {
				// Ignore cleanup errors
			}
			hostEl = null;
		}
	});
</script>

<div
	class="a2ui-host-wrapper {standalone ? 'a2ui-standalone' : 'a2ui-inline'}"
	class:a2ui-loading={bundleState === 'loading'}
	class:a2ui-error={bundleState === 'error'}
>
	{#if bundleState === 'loading'}
		<div class="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
			<svg
				class="h-4 w-4 animate-spin"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
				/>
			</svg>
			Loading interactive content...
		</div>
	{:else if bundleState === 'error'}
		<div class="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm">
			<div class="flex items-center gap-2 text-amber-400">
				<svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.168-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.457-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
						clip-rule="evenodd"
					/>
				</svg>
				Interactive content unavailable
			</div>
			<p class="mt-1 text-slate-400">
				{errorMessage || 'The A2UI component bundle could not be loaded.'}
			</p>
			<p class="mt-1 text-xs text-slate-500">
				Ensure <code class="rounded bg-slate-700 px-1">a2ui.bundle.js</code> is available in the static
				directory.
			</p>
		</div>
	{/if}

	<!-- A2UI host element is inserted here programmatically -->
	<div bind:this={containerEl} class="a2ui-container" class:hidden={bundleState !== 'ready'} />
</div>

<style>
	.a2ui-host-wrapper {
		width: 100%;
	}

	.a2ui-inline {
		min-height: 2rem;
	}

	.a2ui-standalone {
		min-height: 12rem;
		height: 100%;
	}

	.a2ui-container {
		width: 100%;
		height: 100%;
	}

	/* Theme overrides for the A2UI web component */
	.a2ui-container :global(openclaw-a2ui-host) {
		display: block;
		width: 100%;
		--a2ui-color-primary: rgb(59 130 246);
		--a2ui-color-bg: rgb(15 23 42);
		--a2ui-color-surface: rgb(30 41 59);
		--a2ui-color-text: rgb(226 232 240);
		--a2ui-color-text-secondary: rgb(148 163 184);
		--a2ui-border-radius: 0.5rem;
		font-family: inherit;
	}
</style>
