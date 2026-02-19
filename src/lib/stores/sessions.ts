import { writable, readonly, derived, get, type Readable } from 'svelte/store';
import { call, eventBus, snapshot } from '$lib/stores/gateway.js';

export interface ChatSessionInfo {
	sessionKey: string;
	displayName: string;
	createdAt: number;
	updatedAt: number;
	unreadCount: number;
	kind: string;
	channel?: string;
	model?: string;
	totalTokens?: number;
	contextTokens?: number;
	ageMs?: number;
}

const ACTIVE_SESSION_STORAGE_KEY = 'falcon-dash:activeSessionKey';

function loadPersistedSessionKey(): string | null {
	try {
		return typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) : null;
	} catch {
		return null;
	}
}

function persistSessionKey(key: string | null): void {
	try {
		if (typeof window === 'undefined') return;
		if (key) {
			localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, key);
		} else {
			localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
		}
	} catch {
		// Storage unavailable
	}
}

const MANUAL_ORDER_STORAGE_KEY = 'falcon-dash:sessionManualOrder';

function loadManualOrder(): string[] {
	try {
		if (typeof window === 'undefined') return [];
		const raw = localStorage.getItem(MANUAL_ORDER_STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function persistManualOrder(order: string[]): void {
	try {
		if (typeof window === 'undefined') return;
		if (order.length > 0) {
			localStorage.setItem(MANUAL_ORDER_STORAGE_KEY, JSON.stringify(order));
		} else {
			localStorage.removeItem(MANUAL_ORDER_STORAGE_KEY);
		}
	} catch {
		// Storage unavailable
	}
}

const _sessions = writable<ChatSessionInfo[]>([]);
const _activeSessionKey = writable<string | null>(loadPersistedSessionKey());
const _searchQuery = writable('');
const _manualOrder = writable<string[]>(loadManualOrder());

export const sessions: Readable<ChatSessionInfo[]> = readonly(_sessions);
export const activeSessionKey: Readable<string | null> = readonly(_activeSessionKey);
export const searchQuery = _searchQuery;
export const manualOrder: Readable<string[]> = readonly(_manualOrder);

export function setManualOrder(order: string[]): void {
	_manualOrder.set(order);
	persistManualOrder(order);
}

// Derived: filtered and sorted sessions (excludes automated sessions, by manual order or updatedAt)
export const filteredSessions: Readable<ChatSessionInfo[]> = derived(
	[_sessions, _searchQuery, _manualOrder],
	([$sessions, $query, $order]) => {
		let list = $sessions;
		list = list.filter((s) => !s.sessionKey.includes(':cron:'));
		if ($query.trim()) {
			const q = $query.toLowerCase();
			list = list.filter((s) => s.displayName.toLowerCase().includes(q));
		}
		return list.sort((a, b) => {
			if ($order.length > 0) {
				const ai = $order.indexOf(a.sessionKey);
				const bi = $order.indexOf(b.sessionKey);
				// Both in manual order — sort by position
				if (ai !== -1 && bi !== -1) return ai - bi;
				// Only one in manual order — it comes first
				if (ai !== -1) return -1;
				if (bi !== -1) return 1;
			}
			return b.updatedAt - a.updatedAt;
		});
	}
);

function originLabel(s: Record<string, unknown>): string | undefined {
	const origin = s.origin as Record<string, unknown> | undefined;
	return origin?.label as string | undefined;
}

export async function loadSessions(): Promise<void> {
	try {
		const result = await call<{ sessions: Array<Record<string, unknown>> }>('sessions.list', {});
		const labelless = new Set<string>();
		const parsed: ChatSessionInfo[] = (result.sessions ?? []).map((s) => {
			const hasLabel = typeof s.label === 'string' && s.label.length > 0;
			const displayName = (s.label ?? originLabel(s) ?? s.name ?? 'Untitled') as string;
			const sessionKey = (s.sessionKey ?? s.key ?? '') as string;
			if (!hasLabel) labelless.add(sessionKey);
			return {
				sessionKey,
				displayName,
				createdAt: (s.createdAt ?? 0) as number,
				updatedAt: (s.updatedAt ?? s.createdAt ?? 0) as number,
				unreadCount: (s.unreadCount ?? 0) as number,
				kind: (s.kind ?? 'group') as string,
				channel: s.channel as string | undefined,
				model: s.model as string | undefined,
				totalTokens: s.totalTokens as number | undefined,
				contextTokens: s.contextTokens as number | undefined,
				ageMs: s.ageMs as number | undefined
			};
		});

		// Disambiguate sessions sharing the same origin-based display name
		const nameCounts = new Map<string, number>();
		for (const s of parsed) {
			if (!labelless.has(s.sessionKey)) continue;
			nameCounts.set(s.displayName, (nameCounts.get(s.displayName) ?? 0) + 1);
		}
		for (const [name, count] of nameCounts) {
			if (count <= 1) continue;
			let idx = 1;
			for (const s of parsed) {
				if (labelless.has(s.sessionKey) && s.displayName === name) {
					s.displayName = `${name} ${idx}`;
					idx++;
				}
			}
		}

		// Persist friendly names for labelless sessions back to the gateway
		for (const s of parsed) {
			if (!labelless.has(s.sessionKey)) continue;
			call('sessions.patch', { key: s.sessionKey, label: s.displayName }).catch(() => {});
		}

		_sessions.set(parsed);
	} catch (err) {
		console.warn('[sessions] loadSessions failed:', err);
	}
}

export function setActiveSession(sessionKey: string): void {
	_activeSessionKey.set(sessionKey);
	persistSessionKey(sessionKey);
	// Clear unread for active session
	_sessions.update((list) =>
		list.map((s) => (s.sessionKey === sessionKey ? { ...s, unreadCount: 0 } : s))
	);
}

export async function renameSession(sessionKey: string, name: string): Promise<void> {
	await call('sessions.patch', { key: sessionKey, label: name });
	_sessions.update((list) =>
		list.map((s) => (s.sessionKey === sessionKey ? { ...s, displayName: name } : s))
	);
}

export async function deleteSession(sessionKey: string): Promise<void> {
	await call('sessions.delete', { key: sessionKey, deleteTranscript: true });
	_sessions.update((list) => list.filter((s) => s.sessionKey !== sessionKey));
	if (get(_activeSessionKey) === sessionKey) {
		_activeSessionKey.set(null);
		persistSessionKey(null);
	}
}

function uniqueLabel(base: string, existing: ChatSessionInfo[]): string {
	const names = new Set(existing.map((s) => s.displayName));
	if (!names.has(base)) return base;
	let n = 2;
	while (names.has(`${base} ${n}`)) n++;
	return `${base} ${n}`;
}

/**
 * Create a new chat session. Each session gets a unique key with a fresh UUID,
 * which means the gateway spawns a fresh agent context (no prior conversation).
 * This is expected gateway behavior — session key scopes the agent context.
 */
export async function createSession(label?: string): Promise<string> {
	const defaults = get(snapshot.sessionDefaults);
	const agentId = defaults.defaultAgentId ?? 'default';
	const sessionKey = `agent:${agentId}:webchat:dm:${crypto.randomUUID()}`;
	const displayName = uniqueLabel(label || 'New Chat', get(_sessions));

	// Set as active immediately so UI switches
	_activeSessionKey.set(sessionKey);
	persistSessionKey(sessionKey);

	// Create on server, then refresh authoritative list
	try {
		await call('sessions.patch', { key: sessionKey, label: displayName });
		await loadSessions();
	} catch (err) {
		// Revert active session on failure
		_activeSessionKey.set(null);
		persistSessionKey(null);
		console.warn('[sessions] createSession failed:', err);
		throw err;
	}

	return sessionKey;
}

// Subscribe to session events for live updates
let unsubscribers: Array<() => void> = [];
let _loadDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedLoadSessions(): void {
	if (_loadDebounceTimer) clearTimeout(_loadDebounceTimer);
	_loadDebounceTimer = setTimeout(() => {
		_loadDebounceTimer = null;
		loadSessions();
	}, 200);
}

export function subscribeToEvents(): void {
	unsubscribeFromEvents();
	unsubscribers.push(
		eventBus.on('session', (payload) => {
			const action = payload.action as string;
			const sessionKey = payload.sessionKey as string;
			if (action === 'created' || action === 'updated') {
				debouncedLoadSessions();
			} else if (action === 'deleted') {
				_sessions.update((list) => list.filter((s) => s.sessionKey !== sessionKey));
			}
		})
	);

	// Increment unread counts for incoming messages on non-active sessions
	unsubscribers.push(
		eventBus.on('chat.message', (payload) => {
			const msgSessionKey = payload.sessionKey as string;
			if (!msgSessionKey || msgSessionKey === get(_activeSessionKey)) return;
			_sessions.update((list) =>
				list.map((s) =>
					s.sessionKey === msgSessionKey ? { ...s, unreadCount: s.unreadCount + 1 } : s
				)
			);
		})
	);
}

export function unsubscribeFromEvents(): void {
	for (const unsub of unsubscribers) unsub();
	unsubscribers = [];
}

export async function reorderSessions(sessionKeys: string[]): Promise<void> {
	// Persist manual order locally so filteredSessions uses it
	setManualOrder(sessionKeys);
	await call('sessions.reorder', { sessionKeys }).catch(() => {
		// Gateway may not support reorder — local order still works
	});
}

/**
 * Load sessions and restore the previously active session if it still exists.
 * If no persisted session is found, activeSessionKey stays null (welcome page).
 */
export async function restoreActiveSession(): Promise<void> {
	await loadSessions();
	const list = get(_sessions);
	const persisted = loadPersistedSessionKey();
	if (persisted && list.some((s) => s.sessionKey === persisted)) {
		_activeSessionKey.set(persisted);
	}
}
