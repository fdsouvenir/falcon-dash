import { writable, readonly, derived, type Readable } from 'svelte/store';
import type { HelloOkPayload, EventFrame } from './types.js';
import type { EventBus } from './event-bus.js';

export interface PresenceEntry {
	instanceId: string;
	deviceType?: string;
	displayName?: string;
	connectedAt?: number;
	[key: string]: unknown;
}

export interface SessionDefaults {
	model?: string;
	contextTokens?: number;
	thinkingLevel?: string;
	defaultAgentId?: string;
	[key: string]: unknown;
}

export class SnapshotStore {
	private _presence = writable<PresenceEntry[]>([]);
	private _health = writable<Record<string, unknown>>({});
	private _stateVersion = writable<Record<string, number>>({});
	private _sessionDefaults = writable<SessionDefaults>({});
	private _features = writable<string[]>([]);
	private _server = writable<{ version: string; host: string; connId: string } | null>(null);
	private _policy = writable<{
		maxPayload: number;
		maxBufferedBytes: number;
		tickIntervalMs: number;
	} | null>(null);

	private unsubscribers: Array<() => void> = [];

	/** Presence list as a readable store */
	readonly presence: Readable<PresenceEntry[]> = readonly(this._presence);

	/** Health snapshot as a readable store */
	readonly health: Readable<Record<string, unknown>> = readonly(this._health);

	/** State versions per domain as a readable store */
	readonly stateVersion: Readable<Record<string, number>> = readonly(this._stateVersion);

	/** Session defaults (model, contextTokens, thinking level) as a readable store */
	readonly sessionDefaults: Readable<SessionDefaults> = readonly(this._sessionDefaults);

	/** Available gateway methods for feature detection */
	readonly features: Readable<string[]> = readonly(this._features);

	/** Server info from hello-ok */
	readonly server: Readable<{ version: string; host: string; connId: string } | null> = readonly(
		this._server
	);

	/** Policy from hello-ok */
	readonly policy: Readable<{
		maxPayload: number;
		maxBufferedBytes: number;
		tickIntervalMs: number;
	} | null> = readonly(this._policy);

	/** Derived: check if a specific method is available */
	hasMethod(method: string): Readable<boolean> {
		return derived(this._features, ($features) => $features.includes(method));
	}

	/**
	 * Hydrate from hello-ok payload. Called on connect and reconnect.
	 */
	hydrate(helloOk: HelloOkPayload): void {
		const snapshot = helloOk.snapshot;

		this._presence.set((snapshot.presence ?? []) as PresenceEntry[]);
		this._health.set(snapshot.health ?? {});
		this._stateVersion.set(snapshot.stateVersion ?? {});
		this._sessionDefaults.set((snapshot.sessionDefaults ?? {}) as SessionDefaults);
		this._features.set(helloOk.features?.methods ?? []);
		this._server.set(helloOk.server);
		this._policy.set(helloOk.policy);
	}

	/**
	 * Subscribe to EventBus for incremental updates.
	 * Call this after hydrate() to keep stores in sync.
	 */
	subscribe(eventBus: EventBus): void {
		this.unsubscribeAll();

		// Presence events update presence list incrementally
		this.unsubscribers.push(
			eventBus.on('presence', (payload, frame: EventFrame) => {
				this._presence.update((current) => {
					const updated = [...current];
					const entries = (payload.entries ?? [payload]) as PresenceEntry[];

					for (const entry of entries) {
						if (!entry.instanceId) continue;
						const idx = updated.findIndex((p) => p.instanceId === entry.instanceId);
						if (payload.action === 'leave' || payload.action === 'disconnect') {
							if (idx >= 0) updated.splice(idx, 1);
						} else {
							if (idx >= 0) {
								updated[idx] = { ...updated[idx], ...entry };
							} else {
								updated.push(entry);
							}
						}
					}

					return updated;
				});

				// Update stateVersion if present
				if (frame.stateVersion != null) {
					this._stateVersion.update((sv) => ({
						...sv,
						presence: frame.stateVersion!
					}));
				}
			})
		);

		// Health events update health store
		this.unsubscribers.push(
			eventBus.on('health', (payload, frame: EventFrame) => {
				this._health.update((current) => ({
					...current,
					...payload
				}));

				if (frame.stateVersion != null) {
					this._stateVersion.update((sv) => ({
						...sv,
						health: frame.stateVersion!
					}));
				}
			})
		);
	}

	/**
	 * Clear all stores and unsubscribe from events.
	 */
	clear(): void {
		this.unsubscribeAll();
		this._presence.set([]);
		this._health.set({});
		this._stateVersion.set({});
		this._sessionDefaults.set({});
		this._features.set([]);
		this._server.set(null);
		this._policy.set(null);
	}

	private unsubscribeAll(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
