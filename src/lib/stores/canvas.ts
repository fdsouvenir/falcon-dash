import { writable, readonly, derived, type Readable } from 'svelte/store';
import type { EventBus } from '$lib/gateway/event-bus.js';
import { sendCanvasAction, pushSurfaceMessage, clearSurface } from '$lib/canvas/delivery.js';
import { diagnosticLog } from '$lib/gateway/diagnostic-log.js';

export interface CanvasSurface {
	surfaceId: string;
	title?: string;
	sessionKey?: string;
	runId?: string;
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
				const requestId = payload.requestId as string;
				const command = payload.command as string;
				const params = (payload.params ?? {}) as Record<string, unknown>;
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
				case 'canvas.present':
					this.handlePresent(params);
					break;
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

	/** canvas.present — create or show a surface */
	private handlePresent(params: Record<string, unknown>): void {
		const surfaceId = params.surfaceId as string;
		if (!surfaceId) return;

		this._surfaces.update((map) => {
			const existing = map.get(surfaceId);
			if (existing) {
				existing.visible = true;
				existing.title = (params.title as string) ?? existing.title;
				existing.sessionKey = (params.sessionKey as string) ?? existing.sessionKey;
				existing.runId = (params.runId as string) ?? existing.runId;
				existing.updatedAt = Date.now();
			} else {
				map.set(surfaceId, {
					surfaceId,
					title: params.title as string | undefined,
					sessionKey: params.sessionKey as string | undefined,
					runId: params.runId as string | undefined,
					messages: [],
					visible: true,
					createdAt: Date.now(),
					updatedAt: Date.now()
				});
			}
			return new Map(map);
		});

		this._currentSurfaceId.set(surfaceId);
		diagnosticLog.log('canvas', 'info', `Surface presented: ${surfaceId}`);
	}

	/** canvas.hide — hide a surface */
	private handleHide(params: Record<string, unknown>): void {
		const surfaceId = params.surfaceId as string;
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

	/** canvas.navigate — navigate within a surface (currently a no-op placeholder) */
	private handleNavigate(params: Record<string, unknown>): void {
		const surfaceId = params.surfaceId as string;
		if (!surfaceId) return;

		// Navigation is handled by the A2UI component itself
		diagnosticLog.log('canvas', 'info', `Surface navigate: ${surfaceId}`, params);
	}

	/** canvas.a2ui.pushJSONL — push A2UI messages to a surface */
	private handlePushJSONL(params: Record<string, unknown>): void {
		const surfaceId = params.surfaceId as string;
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
		const surfaceId = params.surfaceId as string;
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
	private respondOk(requestId: string): void {
		if (!this.callFn) return;
		this.callFn('canvas.bridge.invokeResult', {
			id: requestId,
			ok: true
		}).catch((err) => {
			diagnosticLog.log('canvas', 'error', `Failed to respond to invoke: ${err}`);
		});
	}

	/** Respond with error to a canvas bridge invoke request */
	private respondError(requestId: string, message: string): void {
		if (!this.callFn) return;
		this.callFn('canvas.bridge.invokeResult', {
			id: requestId,
			ok: false,
			error: { code: 'CANVAS_ERROR', message }
		}).catch((err) => {
			diagnosticLog.log('canvas', 'error', `Failed to respond to invoke: ${err}`);
		});
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
