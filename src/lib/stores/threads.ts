import { writable, readonly, get, type Readable, type Writable } from 'svelte/store';
import { call, snapshot, eventBus } from '$lib/stores/gateway.js';
import { createChatSession, type ChatSessionStore } from '$lib/stores/chat.js';
import { shortId } from '$lib/utils.js';

export type ThreadState = 'active' | 'archived' | 'locked';

export interface ThreadInfo {
	threadKey: string;
	parentSessionKey: string;
	originMessageId: string;
	displayName: string;
	replyCount: number;
	state: ThreadState;
	lastActivity: number;
	channel?: string;
}

const _activeThread: Writable<ThreadInfo | null> = writable(null);
const _threadSession: Writable<ChatSessionStore | null> = writable(null);
const _threads: Writable<Map<string, ThreadInfo>> = writable(new Map());

export const activeThread: Readable<ThreadInfo | null> = readonly(_activeThread);
export const threadSession: Readable<ChatSessionStore | null> = readonly(_threadSession);

/** Get thread info for a message (by originMessageId) */
export function getThreadForMessage(messageId: string): Readable<ThreadInfo | undefined> {
	return {
		subscribe: (fn) => {
			return _threads.subscribe((map) => {
				const found = [...map.values()].find((t) => t.originMessageId === messageId);
				fn(found);
			});
		}
	};
}

/** Open/create a thread for a message */
export async function openThread(
	parentSessionKey: string,
	originMessageId: string,
	displayName?: string,
	channel?: string
): Promise<void> {
	const defaults = get(snapshot.sessionDefaults);
	const agentId = defaults.defaultAgentId ?? 'default';
	// Extract parentId from parentSessionKey (last segment before any :thread:)
	const parentId = parentSessionKey.split(':').pop() ?? parentSessionKey;
	const threadKey = `agent:${agentId}:falcon:dm:${parentId}:thread:fd-chat-${shortId()}`;
	const name = displayName ?? 'Thread';

	// Create thread session on server
	const patchParams: Record<string, unknown> = {
		key: threadKey,
		label: name,
		parentSessionId: parentSessionKey,
		originMessageId
	};
	if (channel) patchParams.channel = channel;
	await call('sessions.patch', patchParams);

	const threadInfo: ThreadInfo = {
		threadKey,
		parentSessionKey,
		originMessageId,
		displayName: name,
		replyCount: 0,
		state: 'active',
		lastActivity: Date.now(),
		channel
	};

	// Store thread info
	_threads.update((map) => {
		const updated = new Map(map);
		updated.set(threadKey, threadInfo);
		return updated;
	});

	// Create chat session for thread
	const session = createChatSession(threadKey);
	await session.loadHistory();

	// Destroy previous thread session if any
	const prevSession = get(_threadSession);
	if (prevSession) prevSession.destroy();

	_activeThread.set(threadInfo);
	_threadSession.set(session);
}

/** Close the active thread panel */
export function closeThread(): void {
	const session = get(_threadSession);
	if (session) session.destroy();
	_activeThread.set(null);
	_threadSession.set(null);
}

/** Update reply count for a thread */
export function updateThreadReplyCount(threadKey: string, count: number): void {
	_threads.update((map) => {
		const updated = new Map(map);
		const info = updated.get(threadKey);
		if (info) {
			updated.set(threadKey, { ...info, replyCount: count });
		}
		return updated;
	});
}

/** Archive a thread */
export async function archiveThread(threadKey: string): Promise<void> {
	await call('sessions.patch', { key: threadKey, state: 'archived' });
	_threads.update((map) => {
		const updated = new Map(map);
		const info = updated.get(threadKey);
		if (info) updated.set(threadKey, { ...info, state: 'archived' });
		return updated;
	});
}

/** Unarchive a thread (set to active) */
export async function unarchiveThread(threadKey: string): Promise<void> {
	await call('sessions.patch', { key: threadKey, state: 'active' });
	_threads.update((map) => {
		const updated = new Map(map);
		const info = updated.get(threadKey);
		if (info) updated.set(threadKey, { ...info, state: 'active' });
		return updated;
	});
}

/** Lock a thread */
export async function lockThread(threadKey: string): Promise<void> {
	await call('sessions.patch', { key: threadKey, state: 'locked' });
	_threads.update((map) => {
		const updated = new Map(map);
		const info = updated.get(threadKey);
		if (info) updated.set(threadKey, { ...info, state: 'locked' });
		return updated;
	});
}

/** Load threads for a parent session */
export async function loadThreads(parentSessionKey: string): Promise<void> {
	try {
		const result = await call<{ sessions: Array<Record<string, unknown>> }>('sessions.list', {
			parentSessionId: parentSessionKey,
			kinds: ['group']
		});
		const threads = result.sessions ?? [];
		_threads.update((map) => {
			const updated = new Map(map);
			for (const t of threads) {
				const key = (t.sessionKey ?? t.key ?? '') as string;
				if (!key) continue;
				updated.set(key, {
					threadKey: key,
					parentSessionKey,
					originMessageId: (t.originMessageId ?? '') as string,
					displayName: (t.displayName ?? 'Thread') as string,
					replyCount: (t.messageCount ?? t.replyCount ?? 0) as number,
					state: (t.state ?? 'active') as ThreadState,
					lastActivity: (t.updatedAt ?? t.lastActivity ?? Date.now()) as number,
					channel: t.channel as string | undefined
				});
			}
			return updated;
		});
	} catch {
		// Keep existing threads on error
	}
}

/** Get all threads for a parent session as a derived store */
export function threadsForSession(parentSessionKey: string): Readable<ThreadInfo[]> {
	return {
		subscribe: (fn) => {
			return _threads.subscribe((map) => {
				const list = [...map.values()]
					.filter((t) => t.parentSessionKey === parentSessionKey)
					.sort((a, b) => b.lastActivity - a.lastActivity);
				fn(list);
			});
		}
	};
}

/** Auto-archive check interval (ms) */
const AUTO_ARCHIVE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Check and auto-archive inactive threads */
export function checkAutoArchive(): void {
	const now = Date.now();
	_threads.update((map) => {
		const updated = new Map(map);
		for (const [key, info] of updated) {
			if (info.state === 'active' && now - info.lastActivity > AUTO_ARCHIVE_MS) {
				updated.set(key, { ...info, state: 'archived' });
				// Fire and forget server update
				call('sessions.patch', { key, state: 'archived' }).catch(() => {});
			}
		}
		return updated;
	});
}

/** Subscribe to thread events for live updates (including Discord sync) */
let threadEventUnsubs: Array<() => void> = [];

export function subscribeToThreadEvents(): void {
	unsubscribeFromThreadEvents();
	threadEventUnsubs.push(
		eventBus.on('session', (payload) => {
			const action = payload.action as string;
			const sessionKey = payload.sessionKey as string;
			const parentSessionId = payload.parentSessionId as string | undefined;

			// Only handle thread sessions (those with a parent)
			if (!parentSessionId) return;

			if (action === 'created' || action === 'updated') {
				// Thread created or updated (possibly from Discord)
				_threads.update((map) => {
					const updated = new Map(map);
					const existing = updated.get(sessionKey);
					updated.set(sessionKey, {
						threadKey: sessionKey,
						parentSessionKey: parentSessionId,
						originMessageId: (payload.originMessageId as string) ?? existing?.originMessageId ?? '',
						displayName: (payload.displayName as string) ?? existing?.displayName ?? 'Thread',
						replyCount: (payload.messageCount as number) ?? existing?.replyCount ?? 0,
						state: (payload.state as ThreadState) ?? existing?.state ?? 'active',
						lastActivity: (payload.updatedAt as number) ?? Date.now(),
						channel: (payload.channel as string) ?? existing?.channel
					});
					return updated;
				});
			} else if (action === 'deleted') {
				_threads.update((map) => {
					const updated = new Map(map);
					updated.delete(sessionKey);
					return updated;
				});
			} else if (action === 'archived') {
				_threads.update((map) => {
					const updated = new Map(map);
					const info = updated.get(sessionKey);
					if (info) updated.set(sessionKey, { ...info, state: 'archived' });
					return updated;
				});
			} else if (action === 'unarchived') {
				_threads.update((map) => {
					const updated = new Map(map);
					const info = updated.get(sessionKey);
					if (info) updated.set(sessionKey, { ...info, state: 'active' });
					return updated;
				});
			}
		})
	);
}

export function unsubscribeFromThreadEvents(): void {
	for (const unsub of threadEventUnsubs) unsub();
	threadEventUnsubs = [];
}
