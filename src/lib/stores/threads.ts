import { writable, readonly, get, type Readable, type Writable } from 'svelte/store';
import { call, snapshot } from '$lib/stores/gateway.js';
import { createChatSession, type ChatSessionStore } from '$lib/stores/chat.js';

export type ThreadState = 'active' | 'archived' | 'locked';

export interface ThreadInfo {
	threadKey: string;
	parentSessionKey: string;
	originMessageId: string;
	displayName: string;
	replyCount: number;
	state: ThreadState;
	lastActivity: number;
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
	displayName?: string
): Promise<void> {
	const defaults = get(snapshot.sessionDefaults);
	const agentId = defaults.defaultAgentId ?? 'default';
	// Extract parentId from parentSessionKey (last segment before any :thread:)
	const parentId = parentSessionKey.split(':').pop() ?? parentSessionKey;
	const threadKey = `agent:${agentId}:webchat:group:${parentId}:thread:${crypto.randomUUID()}`;
	const name = displayName ?? 'Thread';

	// Create thread session on server
	await call('sessions.patch', {
		sessionKey: threadKey,
		displayName: name,
		parentSessionId: parentSessionKey,
		originMessageId
	});

	const threadInfo: ThreadInfo = {
		threadKey,
		parentSessionKey,
		originMessageId,
		displayName: name,
		replyCount: 0,
		state: 'active',
		lastActivity: Date.now()
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
	await call('sessions.patch', { sessionKey: threadKey, state: 'archived' });
	_threads.update((map) => {
		const updated = new Map(map);
		const info = updated.get(threadKey);
		if (info) updated.set(threadKey, { ...info, state: 'archived' });
		return updated;
	});
}

/** Unarchive a thread (set to active) */
export async function unarchiveThread(threadKey: string): Promise<void> {
	await call('sessions.patch', { sessionKey: threadKey, state: 'active' });
	_threads.update((map) => {
		const updated = new Map(map);
		const info = updated.get(threadKey);
		if (info) updated.set(threadKey, { ...info, state: 'active' });
		return updated;
	});
}

/** Lock a thread */
export async function lockThread(threadKey: string): Promise<void> {
	await call('sessions.patch', { sessionKey: threadKey, state: 'locked' });
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
					lastActivity: (t.updatedAt ?? t.lastActivity ?? Date.now()) as number
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
				call('sessions.patch', { sessionKey: key, state: 'archived' }).catch(() => {});
			}
		}
		return updated;
	});
}
