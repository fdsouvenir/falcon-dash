import { writable, type Readable } from 'svelte/store';
import type { Snapshot, StateVersion } from './types';

export class SnapshotStore {
	private _presence = writable<unknown[]>([]);
	private _health = writable<Record<string, unknown>>({});
	private _stateVersion = writable<StateVersion>({ presence: 0, health: 0 });

	/** Svelte readable store for presence data */
	get presence(): Readable<unknown[]> {
		return { subscribe: this._presence.subscribe };
	}

	/** Svelte readable store for health data */
	get health(): Readable<Record<string, unknown>> {
		return { subscribe: this._health.subscribe };
	}

	/** Svelte readable store for per-domain state versions */
	get stateVersion(): Readable<StateVersion> {
		return { subscribe: this._stateVersion.subscribe };
	}

	/** Hydrate all stores from hello-ok snapshot */
	hydrate(snapshot: Snapshot): void {
		this._presence.set(snapshot.presence);
		this._health.set(snapshot.health);
		this._stateVersion.set(snapshot.stateVersion);
	}

	/** Apply incremental presence updates */
	updatePresence(delta: unknown[]): void {
		this._presence.set(delta);
		this._stateVersion.update((v) => ({ ...v, presence: v.presence + 1 }));
	}

	/** Update health data */
	updateHealth(data: Record<string, unknown>): void {
		this._health.set(data);
		this._stateVersion.update((v) => ({ ...v, health: v.health + 1 }));
	}

	/** Update state version from an event's stateVersion field */
	setStateVersion(domain: keyof StateVersion, version: number): void {
		this._stateVersion.update((v) => ({ ...v, [domain]: version }));
	}
}
