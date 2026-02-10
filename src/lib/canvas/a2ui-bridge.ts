// Type declarations for the A2UI web component
declare global {
	interface HTMLElementTagNameMap {
		'openclaw-a2ui-host': A2UIHostElement;
	}
}

export interface A2UIHostElement extends HTMLElement {
	applyMessages(messages: unknown[]): void;
	reset(): void;
}

export interface A2UIAction {
	surfaceId: string;
	actionId: string;
	payload: Record<string, unknown>;
}

// Initialize the A2UI action bridge
// The sendAction callback is wired to canvas.action RPC by the canvas store
export function initA2UIBridge(sendAction: (action: A2UIAction) => void): () => void {
	// Wire up the global action bridge that the A2UI web component uses
	(globalThis as Record<string, unknown>).openclawCanvasA2UIAction = {
		postMessage: (data: A2UIAction) => sendAction(data)
	};

	return () => {
		delete (globalThis as Record<string, unknown>).openclawCanvasA2UIAction;
	};
}

// Track loading state
let loaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Resolve the A2UI bundle URL from gateway server info.
 * Canvas host runs on gatewayPort + 4 (default 18789 + 4 = 18793).
 */
export function getCanvasHostUrl(serverHost?: string, gatewayPort?: number): string {
	const host = serverHost ?? '127.0.0.1';
	const port = (gatewayPort ?? 18789) + 4;
	return `http://${host}:${port}/__openclaw__`;
}

/**
 * Load the A2UI bundle. Tries the canvas host first, falls back to placeholder.
 * Safe to call multiple times — deduplicates via promise caching.
 */
export async function ensureA2UILoaded(serverHost?: string, gatewayPort?: number): Promise<void> {
	if (loaded) return;
	if (loadPromise) return loadPromise;

	loadPromise = doLoad(serverHost, gatewayPort);
	try {
		await loadPromise;
	} finally {
		loadPromise = null;
	}
}

async function doLoad(serverHost?: string, gatewayPort?: number): Promise<void> {
	if (loaded) return;

	// If the real component is already registered (e.g. from a previous load), we're done
	if (customElements.get('openclaw-a2ui-host')) {
		loaded = true;
		return;
	}

	// Try loading the real bundle from the canvas host
	const canvasHostUrl = getCanvasHostUrl(serverHost, gatewayPort);
	const bundleUrl = `${canvasHostUrl}/a2ui/a2ui.bundle.js`;

	try {
		await import(/* @vite-ignore */ bundleUrl);
		// Check if the real component registered itself
		if (customElements.get('openclaw-a2ui-host')) {
			loaded = true;
			return;
		}
	} catch {
		// Bundle not available — fall through to placeholder
		console.warn('[A2UI] Could not load bundle from canvas host, using placeholder');
	}

	// Register a placeholder element for offline/development
	if (!customElements.get('openclaw-a2ui-host')) {
		customElements.define(
			'openclaw-a2ui-host',
			class extends HTMLElement {
				private _messages: unknown[] = [];

				applyMessages(messages: unknown[]) {
					this._messages = messages;
					this.render();
				}

				reset() {
					this._messages = [];
					this.render();
				}

				private render() {
					// Render a simple fallback showing message count
					if (this._messages.length === 0) {
						this.innerHTML = '';
						return;
					}
					this.innerHTML = `<div style="padding: 1rem; background: #1e1e2e; border-radius: 0.5rem; border: 1px solid #313244; color: #cdd6f4; font-size: 0.875rem;">
						<div style="font-weight: 600; margin-bottom: 0.5rem;">Canvas Content</div>
						<div style="color: #a6adc8;">${this._messages.length} A2UI message${this._messages.length !== 1 ? 's' : ''} received</div>
						<div style="margin-top: 0.5rem; color: #6c7086; font-size: 0.75rem;">Real A2UI bundle not available — install canvas host for full rendering</div>
					</div>`;
				}
			}
		);
	}
	loaded = true;
}
