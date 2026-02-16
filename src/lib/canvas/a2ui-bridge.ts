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
 * Resolve the canvas host base URL.
 * Canvas host runs on a separate port (gateway port + 4, default 18793).
 */
export function getCanvasHostUrl(serverHost?: string, canvasHostPort?: number): string {
	const host = serverHost ?? '127.0.0.1';
	const port = canvasHostPort ?? 18793;
	return `http://${host}:${port}/__openclaw__`;
}

/**
 * Load the A2UI bundle using a 3-tier fallback strategy.
 * Tier 1: Local static asset (/a2ui.bundle.js) — always available after install
 * Tier 2: Canvas host server — gets the latest version from the running host
 * Tier 3: Placeholder element — structured fallback for debugging
 *
 * Safe to call multiple times — deduplicates via promise caching.
 */
export async function ensureA2UILoaded(
	serverHost?: string,
	canvasHostPort?: number
): Promise<void> {
	if (loaded) return;
	if (loadPromise) return loadPromise;

	loadPromise = doLoad(serverHost, canvasHostPort);
	try {
		await loadPromise;
	} finally {
		loadPromise = null;
	}
}

async function doLoad(serverHost?: string, canvasHostPort?: number): Promise<void> {
	if (loaded) return;

	// If the real component is already registered (e.g. from a previous load), we're done
	if (customElements.get('openclaw-a2ui-host')) {
		loaded = true;
		return;
	}

	// --- Tier 1: Local static bundle ---
	try {
		// Use a variable so Rollup can't statically analyze the path (SSR-safe)
		const localBundlePath = '/a2ui.bundle.js';
		await import(/* @vite-ignore */ localBundlePath);
		if (customElements.get('openclaw-a2ui-host')) {
			console.log('[A2UI] Loaded from local static bundle');
			loaded = true;
			return;
		}
	} catch (err) {
		console.warn('[A2UI] Local bundle not available, trying canvas host...', err);
	}

	// --- Tier 2: Canvas host server ---
	const canvasHostUrl = getCanvasHostUrl(serverHost, canvasHostPort);
	const bundleUrl = `${canvasHostUrl}/a2ui/a2ui.bundle.js`;

	try {
		await import(/* @vite-ignore */ bundleUrl);
		if (customElements.get('openclaw-a2ui-host')) {
			console.log(`[A2UI] Loaded from canvas host: ${bundleUrl}`);
			loaded = true;
			return;
		}
	} catch (err) {
		console.warn(`[A2UI] Could not load bundle from ${bundleUrl} — using placeholder.`, err);
	}

	// --- Tier 3: Structured placeholder element ---
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
					if (this._messages.length === 0) {
						this.innerHTML = '';
						return;
					}

					const sections = this.categorizeMessages(this._messages);
					const parts: string[] = [];

					parts.push(
						'<div style="padding: 1rem; background: #1e1e2e; border-radius: 0.5rem; border: 1px solid #313244; color: #cdd6f4; font-family: system-ui, sans-serif; font-size: 0.8125rem;">'
					);
					parts.push(
						'<div style="font-weight: 600; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">'
					);
					parts.push(
						'<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f9e2af;"></span>'
					);
					parts.push(
						`Canvas Content <span style="color: #6c7086; font-weight: 400;">(${this._messages.length} message${this._messages.length !== 1 ? 's' : ''})</span>`
					);
					parts.push('</div>');

					// Surface updates (components)
					if (sections.surfaces.length > 0) {
						parts.push(this.renderSection('Components', '#89b4fa', sections.surfaces));
					}

					// Data model updates
					if (sections.data.length > 0) {
						parts.push(this.renderDataSection('Data', '#a6e3a1', sections.data));
					}

					// Actions
					if (sections.actions.length > 0) {
						parts.push(this.renderActionsSection(sections.actions));
					}

					// Other messages
					if (sections.other.length > 0) {
						parts.push(this.renderSection('Other', '#6c7086', sections.other));
					}

					parts.push(
						'<div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid #313244; color: #6c7086; font-size: 0.6875rem;">A2UI bundle not available — install canvas host for full rendering</div>'
					);
					parts.push('</div>');

					this.innerHTML = parts.join('');
				}

				private categorizeMessages(messages: unknown[]): {
					surfaces: unknown[];
					data: unknown[];
					actions: unknown[];
					other: unknown[];
				} {
					const result = {
						surfaces: [] as unknown[],
						data: [] as unknown[],
						actions: [] as unknown[],
						other: [] as unknown[]
					};

					for (const msg of messages) {
						if (!msg || typeof msg !== 'object') {
							result.other.push(msg);
							continue;
						}
						const m = msg as Record<string, unknown>;
						const type = m.type as string | undefined;
						if (type === 'surfaceUpdate' || type === 'componentUpdate') {
							result.surfaces.push(m);
						} else if (type === 'dataModelUpdate' || type === 'data') {
							result.data.push(m);
						} else if (type === 'action' || type === 'actionUpdate') {
							result.actions.push(m);
						} else {
							result.other.push(m);
						}
					}
					return result;
				}

				private renderSection(title: string, color: string, items: unknown[]): string {
					const lines: string[] = [];
					lines.push(
						`<div style="margin-bottom: 0.5rem;"><span style="color: ${color}; font-weight: 500;">${title}</span> <span style="color: #6c7086;">(${items.length})</span></div>`
					);
					lines.push('<div style="margin-left: 0.75rem; margin-bottom: 0.5rem;">');
					for (const item of items.slice(0, 10)) {
						const m = item as Record<string, unknown>;
						const label = (m.componentType as string) ?? (m.type as string) ?? 'unknown';
						const id = (m.id as string) ?? '';
						lines.push(
							`<div style="color: #bac2de; padding: 0.125rem 0;">• <span style="color: ${color};">${this.esc(label)}</span>${id ? ` <span style="color: #585b70;">${this.esc(id)}</span>` : ''}</div>`
						);
					}
					if (items.length > 10) {
						lines.push(
							`<div style="color: #585b70; padding: 0.125rem 0;">  ...and ${items.length - 10} more</div>`
						);
					}
					lines.push('</div>');
					return lines.join('');
				}

				private renderDataSection(title: string, color: string, items: unknown[]): string {
					const lines: string[] = [];
					lines.push(
						`<div style="margin-bottom: 0.5rem;"><span style="color: ${color}; font-weight: 500;">${title}</span> <span style="color: #6c7086;">(${items.length})</span></div>`
					);
					lines.push('<div style="margin-left: 0.75rem; margin-bottom: 0.5rem;">');
					for (const item of items.slice(0, 5)) {
						const m = item as Record<string, unknown>;
						const key = (m.key as string) ?? (m.path as string) ?? '';
						const preview = this.jsonPreview(m.data ?? m.value ?? m);
						lines.push(
							`<div style="padding: 0.125rem 0;">${key ? `<span style="color: ${color};">${this.esc(key)}</span>: ` : ''}<span style="color: #a6adc8; font-family: monospace; font-size: 0.75rem;">${this.esc(preview)}</span></div>`
						);
					}
					if (items.length > 5) {
						lines.push(
							`<div style="color: #585b70; padding: 0.125rem 0;">  ...and ${items.length - 5} more</div>`
						);
					}
					lines.push('</div>');
					return lines.join('');
				}

				private renderActionsSection(items: unknown[]): string {
					const lines: string[] = [];
					lines.push(
						'<div style="margin-bottom: 0.5rem;"><span style="color: #f5c2e7; font-weight: 500;">Actions</span> <span style="color: #6c7086;">(' +
							items.length +
							')</span></div>'
					);
					lines.push(
						'<div style="margin-left: 0.75rem; margin-bottom: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.375rem;">'
					);
					for (const item of items.slice(0, 8)) {
						const m = item as Record<string, unknown>;
						const label =
							(m.label as string) ?? (m.actionId as string) ?? (m.id as string) ?? 'action';
						lines.push(
							`<span style="display: inline-block; padding: 0.25rem 0.625rem; background: #313244; border: 1px solid #45475a; border-radius: 0.25rem; color: #f5c2e7; font-size: 0.75rem;">${this.esc(label)}</span>`
						);
					}
					if (items.length > 8) {
						lines.push(
							`<span style="color: #585b70; font-size: 0.75rem; align-self: center;">+${items.length - 8} more</span>`
						);
					}
					lines.push('</div>');
					return lines.join('');
				}

				private jsonPreview(data: unknown): string {
					try {
						const str = JSON.stringify(data);
						return str.length > 80 ? str.slice(0, 77) + '...' : str;
					} catch {
						return String(data);
					}
				}

				private esc(text: string): string {
					return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				}
			}
		);
	}
	loaded = true;
}
