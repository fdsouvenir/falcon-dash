import { writable, readonly, get, type Readable, type Writable } from 'svelte/store';
import { call, snapshot } from '$lib/stores/gateway.js';
import { createChatSession, type ChatSessionStore } from '$lib/stores/chat.js';

export interface ThreadInfo {
	threadKey: string;
	parentSessionKey: string;
	originMessageId: string;
	displayName: string;
	replyCount: number;
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
		replyCount: 0
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
