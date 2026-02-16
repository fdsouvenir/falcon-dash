import { writable, readonly, derived, get, type Readable } from 'svelte/store';
import type { EventBus } from '$lib/gateway/event-bus.js';
import { sendCanvasAction, pushSurfaceMessage, clearSurface } from '$lib/canvas/delivery.js';
import { diagnosticLog } from '$lib/gateway/diagnostic-log.js';

export interface CanvasSurface {
	surfaceId: string;
	title?: string;
	sessionKey?: string;
	runId?: string;
	url?: string;
	messages: unknown[];
	visible: boolean;
	createdAt: number;
	updatedAt: number;
}

type CallFn = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;

export class CanvasStore {
	private _surfaces = writable<Map<string, CanvasSurface>>(new Map());
	private _currentSurfaceId = writable<string | null>(null);
	private unsubscribers: Array<() => void> = [];
	private callFn: CallFn | null = null;
	private _activeRunId: string | null = null;
	private _canvasHostBaseUrl: string | null = null;

	/** Set the active chat run ID so canvas surfaces can auto-associate */
	setActiveRunId(runId: string | null): void {
		this._activeRunId = runId;
	}

	/** Set the canvas host base URL (derived from gateway hello-ok) */
	setCanvasHostBaseUrl(url: string): void {
		this._canvasHostBaseUrl = url;
	}

	/** All active canvas surfaces */
	readonly surfaces: Readable<Map<string, CanvasSurface>> = readonly(this._surfaces);

	/** The currently displayed surface ID */
	readonly currentSurfaceId: Readable<string | null> = readonly(this._currentSurfaceId);

	/** The currently displayed surface (derived) */
	readonly currentSurface: Readable<CanvasSurface | null> = derived(
		[this._surfaces, this._currentSurfaceId],
		([$surfaces, $id]) => ($id ? ($surfaces.get($id) ?? null) : null)
	);

	/** Get a surface by its associated runId */
	surfaceByRunId(runId: string): Readable<CanvasSurface | null> {
		return derived(this._surfaces, ($surfaces) => {
			for (const surface of $surfaces.values()) {
				if (surface.runId === runId) return surface;
			}
			return null;
		});
	}

	/**
	 * Subscribe to EventBus for canvas events.
	 * @param eventBus - The gateway event bus
	 * @param callFn - RPC call function (injected to avoid circular imports with gateway.ts)
	 */
	subscribe(eventBus: EventBus, callFn: CallFn): void {
		this.callFn = callFn;
		this.unsubscribeAll();

		// Primary path: node.invoke.request — gateway routes canvas commands to us
		this.unsubscribers.push(
			eventBus.on('node.invoke.request', (payload) => {
				const requestId = (payload.id ?? payload.requestId) as string;
				const command = payload.command as string;

				let params: Record<string, unknown>;
				try {
					const rawParams = payload.paramsJSON as string | null;
					if (rawParams && typeof rawParams === 'string') {
						params = JSON.parse(rawParams);
					} else if (
						payload.params &&
						typeof payload.params === 'object' &&
						Object.keys(payload.params as object).length > 0
					) {
						params = payload.params as Record<string, unknown>;
					} else if (typeof payload.params === 'string') {
						params = JSON.parse(payload.params as string);
					} else {
						params = {};
					}
				} catch {
					params = (payload.params ?? {}) as Record<string, unknown>;
				}

				console.log('[canvas] invoke.request received:', { requestId, command, params });
				diagnosticLog.log('canvas', 'info', `Invoke request: ${command}`, { requestId });
				this.handleCommand(command, params, requestId);
			})
		);

		// Alternative path: canvas.deliver — event-based delivery (Approach A2)
		this.unsubscribers.push(
			eventBus.on('canvas.deliver', (payload) => {
				const command = payload.command as string;
				const params = (payload.params ?? payload) as Record<string, unknown>;
				diagnosticLog.log('canvas', 'info', `Canvas deliver: ${command}`);
				this.handleCommand(command, params);
			})
		);

		// Legacy path: canvas.message — existing event from delivery.ts
		this.unsubscribers.push(
			eventBus.on('canvas.message', (payload) => {
				const surfaceId = payload.surfaceId as string;
				const messages = payload.messages as unknown[] | undefined;
				const message = payload.payload;
				if (surfaceId) {
					if (messages) {
						for (const msg of messages) {
							this.pushMessage(surfaceId, msg);
						}
					} else if (message) {
						this.pushMessage(surfaceId, message);
					}
				}
			})
		);

		diagnosticLog.log('canvas', 'info', 'Canvas store subscribed to EventBus');
	}

	/**
	 * Handle a canvas command (from any delivery path).
	 */
	private handleCommand(
		command: string,
		params: Record<string, unknown>,
		requestId?: string
	): void {
		try {
			switch (command) {
				case 'canvas.present': {
					const surfaceId = this.handlePresent(params);
					if (requestId) {
						this.respondOk(requestId, { surfaceId });
					}
					return;
				}
				case 'canvas.hide':
					this.handleHide(params);
					break;
				case 'canvas.navigate':
					this.handleNavigate(params);
					break;
				case 'canvas.a2ui.pushJSONL':
					this.handlePushJSONL(params);
					break;
				case 'canvas.a2ui.reset':
					this.handleReset(params);
					break;
				default:
					diagnosticLog.log('canvas', 'warn', `Unknown canvas command: ${command}`);
					if (requestId) {
						this.respondError(requestId, `Unknown command: ${command}`);
					}
					return;
			}
			if (requestId) {
				this.respondOk(requestId);
			}
		} catch (err) {
			diagnosticLog.log('canvas', 'error', `Canvas command error: ${command}`, {
				error: String(err)
			});
			if (requestId) {
				this.respondError(requestId, String(err));
			}
		}
	}

	/** Resolve the default URL for a canvas surface when none is provided */
	private getDefaultCanvasUrl(): string | undefined {
		if (!this._canvasHostBaseUrl) return undefined;
		return `${this._canvasHostBaseUrl}/a2ui/`;
	}

	/** Generate a descriptive default title for a canvas surface */
	private generateDefaultTitle(): string {
		const ts = new Date();
		const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		return `Canvas ${time}`;
	}

	/** canvas.present — create or show a surface */
	private handlePresent(params: Record<string, unknown>): string {
		const surfaceId = (params.surfaceId as string) || `surface-${crypto.randomUUID()}`;
		const title = (params.title as string) || this.generateDefaultTitle();
		const url = (params.url as string) || this.getDefaultCanvasUrl();

		this._surfaces.update((map) => {
			const existing = map.get(surfaceId);
			if (existing) {
				existing.visible = true;
				existing.title = (params.title as string) ?? existing.title;
				existing.sessionKey = (params.sessionKey as string) ?? existing.sessionKey;
				existing.runId =
					(params.runId as string) ?? existing.runId ?? this._activeRunId ?? undefined;
				existing.url = (params.url as string) ?? existing.url ?? url;
				existing.updatedAt = Date.now();
			} else {
				map.set(surfaceId, {
					surfaceId,
					title,
					sessionKey: params.sessionKey as string | undefined,
					runId: (params.runId as string) ?? this._activeRunId ?? undefined,
					url,
					messages: [],
					visible: true,
					createdAt: Date.now(),
					updatedAt: Date.now()
				});
			}
			return new Map(map);
		});

		this._currentSurfaceId.set(surfaceId);
		console.log('[canvas] handlePresent:', { surfaceId, title, url });
		diagnosticLog.log('canvas', 'info', `Surface presented: ${surfaceId}`, { url });
		return surfaceId;
	}

	/** Resolve surfaceId from params, falling back to current surface (matches native node behavior) */
	private resolveSurfaceId(params: Record<string, unknown>, command: string): string | null {
		const explicit = params.surfaceId as string;
		if (explicit) return explicit;

		const current = get(this._currentSurfaceId);
		if (current) {
			console.log(`[canvas] ${command}: no surfaceId in params, using current: ${current}`);
			return current;
		}

		console.warn(`[canvas] ${command}: no surfaceId in params and no current surface`);
		return null;
	}

	/** canvas.hide — hide a surface */
	private handleHide(params: Record<string, unknown>): void {
		const surfaceId = this.resolveSurfaceId(params, 'handleHide');
		if (!surfaceId) return;

		this._surfaces.update((map) => {
			const surface = map.get(surfaceId);
			if (surface) {
				surface.visible = false;
				surface.updatedAt = Date.now();
			}
			return new Map(map);
		});

		// If hiding the current surface, clear current
		this._currentSurfaceId.update((id) => (id === surfaceId ? null : id));
		diagnosticLog.log('canvas', 'info', `Surface hidden: ${surfaceId}`);
	}

	/** canvas.navigate — navigate a surface's webview to a new URL */
	private handleNavigate(params: Record<string, unknown>): void {
		const surfaceId = this.resolveSurfaceId(params, 'handleNavigate');
		if (!surfaceId) return;

		const url = typeof params.url === 'string' ? params.url : null;
		if (!url) {
			diagnosticLog.log('canvas', 'warn', `handleNavigate: missing url for ${surfaceId}`);
			return;
		}

		this._surfaces.update((map) => {
			const surface = map.get(surfaceId);
			if (surface) {
				surface.url = url;
				surface.updatedAt = Date.now();
			}
			return new Map(map);
		});

		diagnosticLog.log('canvas', 'info', `Surface navigated: ${surfaceId} → ${url}`);
	}

	/** canvas.a2ui.pushJSONL — push A2UI messages to a surface */
	private handlePushJSONL(params: Record<string, unknown>): void {
		const surfaceId = this.resolveSurfaceId(params, 'handlePushJSONL');
		if (!surfaceId) return;

		// Messages can come as array or single JSONL string
		let messages: unknown[] = [];
		if (Array.isArray(params.messages)) {
			messages = params.messages;
		} else if (typeof params.jsonl === 'string') {
			// Parse JSONL
			messages = (params.jsonl as string)
				.split('\n')
				.filter((line) => line.trim())
				.map((line) => {
					try {
						return JSON.parse(line);
					} catch {
						return { type: 'text', content: line };
					}
				});
		} else if (params.message) {
			messages = [params.message];
		}

		for (const msg of messages) {
			this.pushMessage(surfaceId, msg);
		}

		diagnosticLog.log('canvas', 'debug', `Pushed ${messages.length} messages to ${surfaceId}`);
	}

	/** canvas.a2ui.reset — clear a surface's A2UI state */
	private handleReset(params: Record<string, unknown>): void {
		const surfaceId = this.resolveSurfaceId(params, 'handleReset');
		if (!surfaceId) return;

		this._surfaces.update((map) => {
			const surface = map.get(surfaceId);
			if (surface) {
				surface.messages = [];
				surface.updatedAt = Date.now();
			}
			return new Map(map);
		});

		// Also clear in delivery registry
		clearSurface(surfaceId);
		diagnosticLog.log('canvas', 'info', `Surface reset: ${surfaceId}`);
	}

	/** Push a single message to a surface, creating the surface if needed */
	private pushMessage(surfaceId: string, message: unknown): void {
		this._surfaces.update((map) => {
			let surface = map.get(surfaceId);
			if (!surface) {
				surface = {
					surfaceId,
					messages: [],
					visible: true,
					createdAt: Date.now(),
					updatedAt: Date.now()
				};
				map.set(surfaceId, surface);
				this._currentSurfaceId.set(surfaceId);
			}
			surface.messages = [...surface.messages, message];
			surface.updatedAt = Date.now();
			return new Map(map);
		});

		// Also track in delivery registry
		pushSurfaceMessage({
			surfaceId,
			type: 'a2ui',
			payload: message
		});
	}

	/** Respond OK to a canvas bridge invoke request */
	private respondOk(requestId: string, payload?: Record<string, unknown>): void {
		if (!this.callFn) return;
		console.log('[canvas] respondOk:', { requestId, payload });
		this.callFn('canvas.bridge.invokeResult', {
			id: requestId,
			ok: true,
			payload
		}).catch((err) => {
			diagnosticLog.log('canvas', 'error', `Failed to respond to invoke: ${err}`);
		});
	}

	/** Respond with error to a canvas bridge invoke request */
	private respondError(requestId: string, message: string): void {
		if (!this.callFn) return;
		console.log('[canvas] respondError:', { requestId, message });
		this.callFn('canvas.bridge.invokeResult', {
			id: requestId,
			ok: false,
			error: message
		}).catch((err) => {
			diagnosticLog.log('canvas', 'error', `Failed to respond to invoke: ${err}`);
		});
	}

	/**
	 * Restore pinned surfaces from persisted metadata.
	 * Called after reconnect to re-populate surfaces that were lost on refresh.
	 */
	restorePinnedSurfaces(
		pins: Array<{ surfaceId: string; surfaceUrl?: string; surfaceTitle?: string }>
	): void {
		this._surfaces.update((map) => {
			let changed = false;
			for (const pin of pins) {
				if (!pin.surfaceId || map.has(pin.surfaceId)) continue;
				map.set(pin.surfaceId, {
					surfaceId: pin.surfaceId,
					title: pin.surfaceTitle,
					url: pin.surfaceUrl,
					messages: [],
					visible: false,
					createdAt: Date.now(),
					updatedAt: Date.now()
				});
				changed = true;
			}
			return changed ? new Map(map) : map;
		});
		diagnosticLog.log('canvas', 'info', `Restored ${pins.length} pinned surfaces`);
	}

	/**
	 * Send a canvas action back to the agent (user interaction in A2UI).
	 */
	async sendAction(
		surfaceId: string,
		actionId: string,
		payload: Record<string, unknown>
	): Promise<void> {
		await sendCanvasAction(surfaceId, actionId, payload);
	}

	/**
	 * Clear all surfaces and unsubscribe.
	 */
	clear(): void {
		this.unsubscribeAll();
		this._surfaces.set(new Map());
		this._currentSurfaceId.set(null);
		this.callFn = null;
	}

	private unsubscribeAll(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
