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
export function initA2UIBridge(sendAction: (action: A2UIAction) => void): () => void {
	const channel = new MessageChannel();

	// Wire up the global action bridge
	(globalThis as Record<string, unknown>).openclawCanvasA2UIAction = {
		postMessage: (data: A2UIAction) => sendAction(data)
	};

	return () => {
		delete (globalThis as Record<string, unknown>).openclawCanvasA2UIAction;
	};
}

// Load the A2UI bundle (lazy)
let loaded = false;
export async function ensureA2UILoaded(): Promise<void> {
	if (loaded) return;
	// The bundle will be served by the gateway or bundled locally
	// For now, create a stub that registers the custom element
	if (!customElements.get('openclaw-a2ui-host')) {
		// Register a placeholder element
		customElements.define(
			'openclaw-a2ui-host',
			class extends HTMLElement {
				applyMessages(_messages: unknown[]) {
					/* placeholder */
				}
				reset() {
					/* placeholder */
				}
			}
		);
	}
	loaded = true;
}
