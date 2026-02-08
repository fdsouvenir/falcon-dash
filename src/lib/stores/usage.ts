import { writable, get } from 'svelte/store';

const STORAGE_KEY = 'falcon-dash-usage';

interface UsageStats {
	messagesSent: number;
	commandsUsed: number;
	sessionsCreated: number;
	firstUsed: number;
}

function loadFromStorage(): UsageStats {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw) as UsageStats;
	} catch {
		// Ignore parse errors
	}
	return {
		messagesSent: 0,
		commandsUsed: 0,
		sessionsCreated: 0,
		firstUsed: Date.now()
	};
}

function saveToStorage(stats: UsageStats): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
	} catch {
		// Ignore storage errors
	}
}

export const usage = writable<UsageStats>(loadFromStorage());

// Persist on every change
usage.subscribe((stats) => {
	saveToStorage(stats);
});

export function trackMessageSent(): void {
	usage.update((s) => ({ ...s, messagesSent: s.messagesSent + 1 }));
}

export function trackCommandUsed(): void {
	usage.update((s) => ({ ...s, commandsUsed: s.commandsUsed + 1 }));
}

export function trackSessionCreated(): void {
	usage.update((s) => ({ ...s, sessionsCreated: s.sessionsCreated + 1 }));
}

export function getUsageStats(): UsageStats {
	return get(usage);
}
