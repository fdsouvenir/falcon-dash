import { writable, readonly, derived, get, type Readable } from 'svelte/store';
import { call, eventBus, snapshot } from '$lib/stores/gateway.js';
import { notifyNewMessage } from '$lib/stores/notifications.js';
import { shortId } from '$lib/utils.js';

export interface ChatSessionInfo {
	sessionKey: string;
	displayName: string;
	createdAt: number;
	updatedAt: number;
	unreadCount: number;
	kind: string;
	name?: string;
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

const PINNED_SESSIONS_STORAGE_KEY = 'falcon-dash:pinnedSessions';

function loadPinnedSessions(): string[] {
	try {
		if (typeof window === 'undefined') return [];
		const raw = localStorage.getItem(PINNED_SESSIONS_STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function persistPinnedSessions(keys: string[]): void {
	try {
		if (typeof window === 'undefined') return;
		if (keys.length > 0) {
			localStorage.setItem(PINNED_SESSIONS_STORAGE_KEY, JSON.stringify(keys));
		} else {
			localStorage.removeItem(PINNED_SESSIONS_STORAGE_KEY);
		}
	} catch {
		// Storage unavailable
	}
}

const _sessions = writable<ChatSessionInfo[]>([]);
const _activeSessionKey = writable<string | null>(loadPersistedSessionKey());
const _searchQuery = writable('');
const _pinnedSessions = writable<string[]>(loadPinnedSessions());
const _selectedAgentId = writable<string | null>(null);

export const sessions: Readable<ChatSessionInfo[]> = readonly(_sessions);
export const activeSessionKey: Readable<string | null> = readonly(_activeSessionKey);
export const searchQuery = _searchQuery;
export const pinnedSessions: Readable<string[]> = readonly(_pinnedSessions);
export const selectedAgentId: Readable<string | null> = readonly(_selectedAgentId);

export function setSelectedAgent(agentId: string | null): void {
	_selectedAgentId.set(agentId);
}

function sessionMatchesAgent(sessionKey: string, agentId: string | null): boolean {
	if (!agentId) return true;
	const match = sessionKey.match(/^agent:([^:]+):/);
	return match ? match[1] === agentId : true;
}

export function togglePin(sessionKey: string): void {
	_pinnedSessions.update((keys) => {
		const next = keys.includes(sessionKey)
			? keys.filter((k) => k !== sessionKey)
			: [...keys, sessionKey];
		persistPinnedSessions(next);
		return next;
	});
}

function isSystemSession(s: ChatSessionInfo): boolean {
	const key = s.sessionKey;
	return (
		key.includes(':cron:') ||
		key.includes(':heartbeat:') ||
		key.includes(':thread:') ||
		key.includes(':fd-chan-') ||
		s.kind === 'cron' ||
		s.kind === 'heartbeat' ||
		s.name === 'heartbeat' ||
		s.displayName === 'heartbeat' ||
		s.name === 'cron' ||
		s.displayName === 'cron'
	);
}

// Derived: filtered and sorted sessions (excludes system/thread sessions, filters by agent, pinned first)
export const filteredSessions: Readable<ChatSessionInfo[]> = derived(
	[_sessions, _searchQuery, _pinnedSessions, _selectedAgentId],
	([$sessions, $query, $pinned, $agentId]) => {
		let list = $sessions.filter((s) => !isSystemSession(s));
		list = list.filter((s) => sessionMatchesAgent(s.sessionKey, $agentId));
		if ($query.trim()) {
			const q = $query.toLowerCase();
			list = list.filter((s) => s.displayName.toLowerCase().includes(q));
		}
		const pinnedSet = new Set($pinned);
		return list.sort((a, b) => {
			const ap = pinnedSet.has(a.sessionKey);
			const bp = pinnedSet.has(b.sessionKey);
			if (ap && !bp) return -1;
			if (!ap && bp) return 1;
			return b.updatedAt - a.updatedAt;
		});
	}
);

export interface SessionGroup {
	label: string;
	sessions: ChatSessionInfo[];
}

function getTimeGroupLabel(ts: number): string {
	const now = new Date();
	const date = new Date(ts);
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const startOfYesterday = startOfToday - 86_400_000;
	const dayOfWeek = now.getDay();
	const startOfWeek = startOfToday - dayOfWeek * 86_400_000;
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

	if (ts >= startOfToday) return 'Today';
	if (ts >= startOfYesterday) return 'Yesterday';
	if (ts >= startOfWeek) return 'This Week';
	if (ts >= startOfMonth) return 'This Month';
	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	if (date.getFullYear() === now.getFullYear()) {
		return monthNames[date.getMonth()];
	}
	return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

export const groupedSessions: Readable<{ pinned: ChatSessionInfo[]; groups: SessionGroup[] }> =
	derived([filteredSessions, _pinnedSessions], ([$filtered, $pinned]) => {
		const pinnedSet = new Set($pinned);
		const pinned: ChatSessionInfo[] = [];
		const unpinned: ChatSessionInfo[] = [];

		for (const s of $filtered) {
			if (pinnedSet.has(s.sessionKey)) {
				pinned.push(s);
			} else {
				unpinned.push(s);
			}
		}

		const groupMap = new Map<string, ChatSessionInfo[]>();
		const groupOrder: string[] = [];
		for (const s of unpinned) {
			const label = getTimeGroupLabel(s.updatedAt);
			if (!groupMap.has(label)) {
				groupMap.set(label, []);
				groupOrder.push(label);
			}
			groupMap.get(label)!.push(s);
		}

		const groups: SessionGroup[] = groupOrder.map((label) => ({
			label,
			sessions: groupMap.get(label)!
		}));

		return { pinned, groups };
	});

function originLabel(s: Record<string, unknown>): string | undefined {
	const origin = s.origin as Record<string, unknown> | undefined;
	return origin?.label as string | undefined;
}

export async function loadSessions(): Promise<void> {
	try {
		const result = await call<{ sessions: Array<Record<string, unknown>> }>('sessions.list', {});
		const labelless = new Set<string>();
		const parsed: ChatSessionInfo[] = (result.sessions ?? []).map((s, i) => {
			const hasLabel = typeof s.label === 'string' && s.label.length > 0;
			// Avoid showing raw session keys as names — fall back to "Chat N"
			const rawName = (s.label ?? originLabel(s) ?? s.name ?? '') as string;
			const looksLikeKey = !rawName || rawName.includes(':') || /^[0-9a-f-]{20,}$/i.test(rawName);
			const displayName = looksLikeKey ? `Chat ${i + 1}` : rawName;
			const sessionKey = (s.sessionKey ?? s.key ?? '') as string;
			if (!hasLabel) labelless.add(sessionKey);
			return {
				sessionKey,
				displayName,
				createdAt: (s.createdAt ?? 0) as number,
				updatedAt: (s.updatedAt ?? s.createdAt ?? 0) as number,
				unreadCount: (s.unreadCount ?? 0) as number,
				kind: (s.kind ?? 'group') as string,
				name: s.name as string | undefined,
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

function uniqueLabel(base: string, existing: ChatSessionInfo[], agentId?: string): string {
	const scoped = agentId
		? existing.filter((s) => s.sessionKey.startsWith(`agent:${agentId}:`))
		: existing;
	const names = new Set(scoped.map((s) => s.displayName));
	if (!names.has(base)) return base;
	let n = 2;
	while (names.has(`${base} ${n}`)) n++;
	return `${base} ${n}`;
}

export async function createSession(label?: string): Promise<string> {
	const selected = get(_selectedAgentId);
	const defaults = get(snapshot.sessionDefaults);
	const agentId = selected || defaults.defaultAgentId || 'default';
	const sessionKey = `agent:${agentId}:falcon-dash:dm:fd-chat-${shortId()}`;
	const displayName = uniqueLabel(label || 'New Chat', get(_sessions), agentId);

	_activeSessionKey.set(sessionKey);
	persistSessionKey(sessionKey);

	try {
		await call('sessions.patch', { key: sessionKey, label: displayName });
		await loadSessions();
	} catch (err) {
		_activeSessionKey.set(null);
		persistSessionKey(null);
		console.warn('[sessions] createSession failed:', err);
		throw err;
	}

	return sessionKey;
}

export function createSessionOptimistic(label?: string): string {
	const selected = get(_selectedAgentId);
	const defaults = get(snapshot.sessionDefaults);
	const agentId = selected || defaults.defaultAgentId || 'default';
	const sessionKey = `agent:${agentId}:falcon-dash:dm:fd-chat-${shortId()}`;
	const displayName = uniqueLabel(label || 'New Chat', get(_sessions), agentId);

	_activeSessionKey.set(sessionKey);
	persistSessionKey(sessionKey);

	call('sessions.patch', { key: sessionKey, label: displayName })
		.then(() => loadSessions())
		.catch((err) => {
			_activeSessionKey.set(null);
			persistSessionKey(null);
			console.warn('[sessions] createSession failed:', err);
		});

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

	unsubscribers.push(
		eventBus.on('chat.message', (payload) => {
			const msgSessionKey = payload.sessionKey as string;
			if (!msgSessionKey || msgSessionKey === get(_activeSessionKey)) return;
			_sessions.update((list) =>
				list.map((s) =>
					s.sessionKey === msgSessionKey ? { ...s, unreadCount: s.unreadCount + 1 } : s
				)
			);
			// Trigger notification (sound, browser notification, notification center)
			const sessionList = get(_sessions);
			const session = sessionList.find((s) => s.sessionKey === msgSessionKey);
			const sessionName = session?.displayName ?? 'New message';
			const content = (payload.content as string) ?? '';
			notifyNewMessage(sessionName, content, msgSessionKey);
		})
	);
}

export function unsubscribeFromEvents(): void {
	for (const unsub of unsubscribers) unsub();
	unsubscribers = [];
}

export async function restoreActiveSession(): Promise<void> {
	await loadSessions();
	const list = get(_sessions);
	const persisted = loadPersistedSessionKey();
	if (persisted && list.some((s) => s.sessionKey === persisted)) {
		_activeSessionKey.set(persisted);
	}
}
