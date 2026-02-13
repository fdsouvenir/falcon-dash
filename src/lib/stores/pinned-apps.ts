import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'falcon-dash:pinned-apps';

export interface PinnedApp {
	id: string;
	name: string;
	surfaceId: string;
	pinnedAt: number;
}

function loadFromStorage(): PinnedApp[] {
	if (!browser) return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
}

function saveToStorage(apps: PinnedApp[]): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

export const pinnedApps: Writable<PinnedApp[]> = writable(loadFromStorage());

// Auto-persist on change
pinnedApps.subscribe((apps) => {
	saveToStorage(apps);
});

export function pinApp(surfaceId: string, name: string): void {
	pinnedApps.update((apps) => {
		if (apps.some((a) => a.surfaceId === surfaceId)) return apps;
		return [...apps, { id: crypto.randomUUID(), name, surfaceId, pinnedAt: Date.now() }];
	});
}

export function unpinApp(surfaceId: string): void {
	pinnedApps.update((apps) => apps.filter((a) => a.surfaceId !== surfaceId));
}

export function renameApp(surfaceId: string, newName: string): void {
	pinnedApps.update((apps) =>
		apps.map((a) => (a.surfaceId === surfaceId ? { ...a, name: newName } : a))
	);
}

export function isPinned(surfaceId: string, apps: PinnedApp[]): boolean {
	return apps.some((a) => a.surfaceId === surfaceId);
}
