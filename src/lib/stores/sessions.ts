import { writable, readonly, derived, get, type Readable } from 'svelte/store';
import { call, eventBus, snapshot } from '$lib/stores/gateway.js';

export interface ChatSessionInfo {
	sessionKey: string;
	displayName: string;
	createdAt: number;
	updatedAt: number;
	unreadCount: number;
	isGeneral: boolean;
	kind: string;
	channel?: string;
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

const _sessions = writable<ChatSessionInfo[]>([]);
const _activeSessionKey = writable<string | null>(loadPersistedSessionKey());
const _searchQuery = writable('');

export const sessions: Readable<ChatSessionInfo[]> = readonly(_sessions);
export const activeSessionKey: Readable<string | null> = readonly(_activeSessionKey);
export const searchQuery = _searchQuery;

// Derived: filtered and sorted sessions (General first, then by updatedAt)
export const filteredSessions: Readable<ChatSessionInfo[]> = derived(
	[_sessions, _searchQuery],
	([$sessions, $query]) => {
		let list = $sessions;
		if ($query.trim()) {
			const q = $query.toLowerCase();
			list = list.filter((s) => s.displayName.toLowerCase().includes(q));
		}
		return list.sort((a, b) => {
			if (a.isGeneral) return -1;
			if (b.isGeneral) return 1;
			return b.updatedAt - a.updatedAt;
		});
	}
);

export async function loadSessions(): Promise<void> {
	try {
		const result = await call<{ sessions: Array<Record<string, unknown>> }>('sessions.list', {});
		const parsed: ChatSessionInfo[] = (result.sessions ?? []).map((s) => ({
			sessionKey: (s.sessionKey ?? s.key ?? '') as string,
			displayName: (s.displayName ?? s.name ?? 'Untitled') as string,
			createdAt: (s.createdAt ?? 0) as number,
			updatedAt: (s.updatedAt ?? s.createdAt ?? 0) as number,
			unreadCount: (s.unreadCount ?? 0) as number,
			isGeneral: (s.isGeneral ?? s.sessionKey === 'general') as boolean,
			kind: (s.kind ?? 'group') as string,
			channel: s.channel as string | undefined
		}));
		_sessions.set(parsed);
	} catch {
		// Keep existing sessions on error
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
export async function createSession(label?: string, channel?: string): Promise<string> {
	const defaults = get(snapshot.sessionDefaults);
	const agentId = defaults.defaultAgentId ?? 'default';
	const sessionKey = `agent:${agentId}:webchat:group:${crypto.randomUUID()}`;
	const displayName = label || uniqueLabel('New Chat', get(_sessions));
	const now = Date.now();

	// Optimistic update
	_sessions.update((list) => [
		...list,
		{
			sessionKey,
			displayName,
			createdAt: now,
			updatedAt: now,
			unreadCount: 0,
			isGeneral: false,
			kind: 'group',
			channel
		}
	]);

	// Set as active
	_activeSessionKey.set(sessionKey);
	persistSessionKey(sessionKey);

	// Create on server
	const patchParams: Record<string, unknown> = { key: sessionKey, label: displayName };
	if (channel) patchParams.channel = channel;
	await call('sessions.patch', patchParams);

	return sessionKey;
}

// Subscribe to session events for live updates
let unsubscribers: Array<() => void> = [];

export function subscribeToEvents(): void {
	unsubscribeFromEvents();
	unsubscribers.push(
		eventBus.on('session', (payload) => {
			const action = payload.action as string;
			const sessionKey = payload.sessionKey as string;
			if (action === 'created' || action === 'updated') {
				loadSessions(); // Refresh full list
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
	await call('sessions.reorder', { sessionKeys });
	_sessions.update((list) => {
		const ordered: ChatSessionInfo[] = [];
		// General always first
		const general = list.find((s) => s.isGeneral);
		if (general) ordered.push(general);
		// Then in requested order
		for (const key of sessionKeys) {
			const found = list.find((s) => s.sessionKey === key && !s.isGeneral);
			if (found) ordered.push(found);
		}
		// Any remaining
		for (const s of list) {
			if (!ordered.includes(s)) ordered.push(s);
		}
		return ordered;
	});
}

export async function ensureGeneralSession(): Promise<string> {
	await loadSessions();
	const list = get(_sessions);

	// Restore persisted session if it still exists
	const persisted = loadPersistedSessionKey();
	if (persisted && list.some((s) => s.sessionKey === persisted)) {
		_activeSessionKey.set(persisted);
		return persisted;
	}

	const general = list.find((s) => s.isGeneral);
	if (general) {
		_activeSessionKey.set(general.sessionKey);
		persistSessionKey(general.sessionKey);
		return general.sessionKey;
	}

	// Create General session
	const defaults = get(snapshot.sessionDefaults);
	const agentId = defaults.defaultAgentId ?? 'default';
	const sessionKey = `agent:${agentId}:webchat:group:general`;
	const now = Date.now();

	await call('sessions.patch', { key: sessionKey, label: 'General' });

	_sessions.update((sessions) => [
		{
			sessionKey,
			displayName: 'General',
			createdAt: now,
			updatedAt: now,
			unreadCount: 0,
			isGeneral: true,
			kind: 'group'
		},
		...sessions
	]);
	_activeSessionKey.set(sessionKey);
	persistSessionKey(sessionKey);
	return sessionKey;
}
