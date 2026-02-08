import { writable, derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

/** Whether the browser is currently online */
export const isOnline = writable<boolean>(browser ? navigator.onLine : true);

/** Whether the app is in offline mode */
export const isOffline: Readable<boolean> = derived(isOnline, ($online) => !$online);

/** Actions queued while offline, to be synced when back online */
export interface QueuedAction {
	id: string;
	method: string;
	params?: Record<string, unknown>;
	timestamp: number;
}

const QUEUE_KEY = 'falcon-dash:offline-queue';

function loadQueue(): QueuedAction[] {
	if (!browser) return [];
	try {
		const stored = localStorage.getItem(QUEUE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
}

function saveQueue(queue: QueuedAction[]): void {
	if (!browser) return;
	localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const offlineQueue = writable<QueuedAction[]>(loadQueue());

/** Add an action to the offline queue */
export function queueAction(method: string, params?: Record<string, unknown>): void {
	offlineQueue.update((q) => {
		const action: QueuedAction = {
			id: crypto.randomUUID(),
			method,
			params,
			timestamp: Date.now()
		};
		const updated = [...q, action];
		saveQueue(updated);
		return updated;
	});
}

/** Remove an action from the queue (after successful sync) */
export function dequeueAction(id: string): void {
	offlineQueue.update((q) => {
		const updated = q.filter((a) => a.id !== id);
		saveQueue(updated);
		return updated;
	});
}

/** Clear the entire offline queue */
export function clearQueue(): void {
	offlineQueue.set([]);
	saveQueue([]);
}

/** Initialize online/offline listeners — call once from layout */
export function initOfflineListeners(): void {
	if (!browser) return;

	function handleOnline(): void {
		isOnline.set(true);
	}

	function handleOffline(): void {
		isOnline.set(false);
	}

	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);
}
