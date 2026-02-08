import { writable, derived, get } from 'svelte/store';
import type { CustomApp, CustomAppMode } from '$lib/types/canvas';

const STORAGE_KEY = 'falcon-dash:custom-apps';

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function loadFromStorage(): CustomApp[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed as CustomApp[];
	} catch {
		return [];
	}
}

function saveToStorage(apps: CustomApp[]): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
	} catch {
		// storage full or unavailable — ignore
	}
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const customApps = writable<CustomApp[]>(loadFromStorage());

/** Apps sorted by order field for display */
export const sortedCustomApps = derived(customApps, ($apps) =>
	[...$apps].sort((a, b) => a.order - b.order)
);

// Persist on every change
customApps.subscribe((apps) => {
	saveToStorage(apps);
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Pin a new custom app */
export function pinApp(params: {
	id: string;
	name: string;
	mode: CustomAppMode;
	canvasPath?: string;
	a2uiMessages?: Array<Record<string, unknown>>;
}): void {
	customApps.update((apps) => {
		// Don't duplicate
		if (apps.some((a) => a.id === params.id)) return apps;
		const maxOrder = apps.reduce((max, a) => Math.max(max, a.order), 0);
		const app: CustomApp = {
			id: params.id,
			name: params.name,
			mode: params.mode,
			order: maxOrder + 1,
			canvasPath: params.canvasPath,
			a2uiMessages: params.a2uiMessages,
			pinnedAt: Date.now()
		};
		return [...apps, app];
	});
}

/** Unpin (remove) a custom app by id */
export function unpinApp(id: string): void {
	customApps.update((apps) => apps.filter((a) => a.id !== id));
}

/** Rename a custom app */
export function renameApp(id: string, name: string): void {
	customApps.update((apps) => apps.map((a) => (a.id === id ? { ...a, name } : a)));
}

/** Reorder custom apps — move app at fromIndex to toIndex */
export function reorderApps(fromIndex: number, toIndex: number): void {
	customApps.update((apps) => {
		const sorted = [...apps].sort((a, b) => a.order - b.order);
		if (fromIndex < 0 || fromIndex >= sorted.length) return apps;
		if (toIndex < 0 || toIndex >= sorted.length) return apps;
		const [moved] = sorted.splice(fromIndex, 1);
		sorted.splice(toIndex, 0, moved);
		return sorted.map((a, i) => ({ ...a, order: i }));
	});
}

/** Update A2UI messages for a pinned app */
export function updateAppMessages(id: string, messages: Array<Record<string, unknown>>): void {
	customApps.update((apps) =>
		apps.map((a) => (a.id === id ? { ...a, a2uiMessages: messages } : a))
	);
}

/** Get a single custom app by id */
export function getApp(id: string): CustomApp | undefined {
	return get(customApps).find((a) => a.id === id);
}
