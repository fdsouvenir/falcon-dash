import { writable } from 'svelte/store';
import { diagnosticLog } from '$lib/gateway/diagnostic-log.js';

/** Tick health — updated via EventBus subscription in gateway.ts */
export const tickHealth = writable<{
	lastTickAt: number | null;
	tickIntervalMs: number | null;
}>({ lastTickAt: null, tickIntervalMs: null });

/** Re-export for convenient UI import */
export { diagnosticLog };
