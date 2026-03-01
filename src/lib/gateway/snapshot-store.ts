import { writable, readonly, derived, type Readable } from 'svelte/store';
import type { HelloOkPayload } from './types.js';
import { gatewayEvents } from '$lib/gateway-api.js';

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

/**
 * SnapshotStore — hydrates from gatewayEvents.snapshot (SSE)
 * and subscribes to gatewayEvents for incremental presence/health updates.
 */
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

	readonly presence: Readable<PresenceEntry[]> = readonly(this._presence);
	readonly health: Readable<Record<string, unknown>> = readonly(this._health);
	readonly stateVersion: Readable<Record<string, number>> = readonly(this._stateVersion);
	readonly sessionDefaults: Readable<SessionDefaults> = readonly(this._sessionDefaults);
	readonly features: Readable<string[]> = readonly(this._features);
	readonly server: Readable<{ version: string; host: string; connId: string } | null> = readonly(
		this._server
	);
	readonly policy: Readable<{
		maxPayload: number;
		maxBufferedBytes: number;
		tickIntervalMs: number;
	} | null> = readonly(this._policy);

	hasMethod(method: string): Readable<boolean> {
		return derived(this._features, ($features) => $features.includes(method));
	}

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
	 * Subscribe to gatewayEvents for snapshot hydration and incremental updates.
	 */
	subscribeToGateway(): void {
		this.unsubscribeAll();

		// Hydrate from initial snapshot
		this.unsubscribers.push(
			gatewayEvents.snapshot.subscribe((snap) => {
				if (snap) this.hydrate(snap);
			})
		);

		// Presence events update presence list incrementally
		this.unsubscribers.push(
			gatewayEvents.on('presence', (payload, event) => {
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

				if (event.stateVersion != null) {
					this._stateVersion.update((sv) => ({
						...sv,
						presence: event.stateVersion!
					}));
				}
			})
		);

		// Health events update health store
		this.unsubscribers.push(
			gatewayEvents.on('health', (payload, event) => {
				this._health.update((current) => ({
					...current,
					...payload
				}));

				if (event.stateVersion != null) {
					this._stateVersion.update((sv) => ({
						...sv,
						health: event.stateVersion!
					}));
				}
			})
		);
	}

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
