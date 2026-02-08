import { derived, get, writable, type Readable } from 'svelte/store';
import { gateway, AgentStreamManager } from '$lib/gateway';
import type {
	AgentEvent,
	AgentRunState,
	ChatHistoryResponse,
	ChatMessage,
	ChatSendAck,
	MessageRole
} from '$lib/gateway/types';
import { ConnectionState } from '$lib/gateway/types';
import { activeSessionKey, loadSessions } from './sessions';
import { connectionState } from './connection';

/** Singleton stream manager instance */
const streamManager = new AgentStreamManager();

/** All messages keyed by sessionKey */
export const messages = writable<Map<string, ChatMessage[]>>(new Map());

/** Get a derived readable store for a specific session's messages */
export function getMessages(sessionKey: string): Readable<ChatMessage[]> {
	return derived(messages, ($messages) => $messages.get(sessionKey) ?? []);
}

/** Derived: the active run for the current session (or undefined) */
export const activeRun: Readable<AgentRunState | undefined> = derived(
	activeSessionKey,
	($key, set) => {
		const check = () => set($key ? streamManager.getActiveRun($key) : undefined);
		check();
		const interval = setInterval(check, 200);
		return () => clearInterval(interval);
	}
);

let unsubAgent: (() => void) | null = null;
let unsubReconnect: (() => void) | null = null;
let tempIdCounter = 0;
let localIdCounter = 0;
let lastKnownSeq = 0;
let previousConnectionState: ConnectionState = ConnectionState.DISCONNECTED;

/** Wire gateway agent events to the stream manager */
export function initChatListeners(): void {
	destroyChatListeners();

	streamManager.onMessage = (msg: ChatMessage) => {
		messages.update((map) => {
			const list = map.get(msg.sessionKey) ?? [];
			const idx = list.findIndex((m) => m.id === msg.id);
			if (idx >= 0) {
				list[idx] = { ...msg };
			} else {
				list.push({ ...msg });
			}
			map.set(msg.sessionKey, [...list]);
			return new Map(map);
		});
	};

	streamManager.onRunComplete = () => {
		// Run complete — activeRun poll will pick up the status change
	};

	streamManager.onRunError = () => {
		// Run error — activeRun poll will pick up the status change
	};

	unsubAgent = gateway.on('agent', (payload: unknown) => {
		const event = payload as AgentEvent;
		if ('seq' in event && typeof (event as Record<string, unknown>).seq === 'number') {
			const seq = (event as Record<string, unknown>).seq as number;
			if (seq > lastKnownSeq) {
				lastKnownSeq = seq;
			}
		}
		streamManager.handleEvent(event);
	});

	unsubReconnect = initReconnectWatcher();
}

/** Clean up event listeners */
export function destroyChatListeners(): void {
	if (unsubAgent) {
		unsubAgent();
		unsubAgent = null;
	}
	if (unsubReconnect) {
		unsubReconnect();
		unsubReconnect = null;
	}
	streamManager.onMessage = null;
	streamManager.onRunComplete = null;
	streamManager.onRunError = null;
	streamManager.reset();
}

/** Handle reconnection: reload sessions, fill message gap, clear stale runs */
async function handleReconnect(): Promise<void> {
	streamManager.reset();

	try {
		await loadSessions();
	} catch {
		// Session reload failed — will retry on next reconnect
	}

	const sessionKey = get(activeSessionKey);
	if (sessionKey && lastKnownSeq > 0) {
		try {
			await loadHistory(sessionKey, lastKnownSeq);
		} catch {
			// Gap fill failed — will retry on next reconnect
		}
	}
}

/** Watch for RECONNECTING → READY transitions */
function initReconnectWatcher(): () => void {
	return connectionState.subscribe(($state) => {
		if (
			previousConnectionState === ConnectionState.RECONNECTING &&
			$state === ConnectionState.READY
		) {
			handleReconnect();
		}
		previousConnectionState = $state;
	});
}

/** Send a message in the active session with optimistic insert */
export async function sendMessage(content: string): Promise<void> {
	const sessionKey = get(activeSessionKey);
	if (!sessionKey) return;

	const tempId = `temp-${Date.now()}-${++tempIdCounter}`;
	const userMsg: ChatMessage = {
		id: tempId,
		sessionKey,
		role: 'user',
		content,
		timestamp: Date.now()
	};

	// Optimistic insert
	messages.update((map) => {
		const list = map.get(sessionKey) ?? [];
		map.set(sessionKey, [...list, userMsg]);
		return new Map(map);
	});

	const ack = await gateway.call<ChatSendAck>('chat.send', {
		sessionKey,
		content
	});

	// Replace temp ID with server-assigned runId-based ID
	messages.update((map) => {
		const list = map.get(sessionKey) ?? [];
		const idx = list.findIndex((m) => m.id === tempId);
		if (idx >= 0) {
			list[idx] = { ...list[idx], id: `msg-user-${ack.runId}` };
			map.set(sessionKey, [...list]);
		}
		return new Map(map);
	});

	streamManager.handleAck(sessionKey, ack);
}

/** Load message history for a session */
export async function loadHistory(sessionKey: string, afterSeq?: number): Promise<void> {
	const params: Record<string, unknown> = { sessionKey };
	if (afterSeq !== undefined) {
		params.afterSeq = afterSeq;
	}

	const res = await gateway.call<ChatHistoryResponse>('chat.history', params);

	messages.update((map) => {
		const existing = map.get(sessionKey) ?? [];
		if (afterSeq !== undefined && existing.length > 0) {
			// Merge: deduplicate by ID, keep local-only messages
			const ids = new Set(existing.map((m) => m.id));
			const newMsgs = res.messages.filter((m) => !ids.has(m.id));
			map.set(sessionKey, [...existing, ...newMsgs]);
		} else {
			// Preserve local-only messages when replacing history
			const localMsgs = existing.filter((m) => m.localOnly);
			map.set(sessionKey, [...res.messages, ...localMsgs]);
		}
		return new Map(map);
	});
}

/** Insert a local-only message (not sent to gateway, excluded from history/gap-fill) */
export function insertLocalMessage(sessionKey: string, role: MessageRole, content: string): void {
	const msg: ChatMessage = {
		id: `local-${Date.now()}-${++localIdCounter}`,
		sessionKey,
		role,
		content,
		timestamp: Date.now(),
		localOnly: true
	};
	messages.update((map) => {
		const list = map.get(sessionKey) ?? [];
		map.set(sessionKey, [...list, msg]);
		return new Map(map);
	});
}

/** Inject a system/context message into a session */
export async function injectMessage(
	sessionKey: string,
	role: MessageRole,
	content: string
): Promise<void> {
	await gateway.call('chat.inject', { sessionKey, role, content });
}

/** Abort the active run for the current session */
export async function abortRun(): Promise<void> {
	const sessionKey = get(activeSessionKey);
	if (!sessionKey) return;

	streamManager.abort(sessionKey);
	await gateway.call('chat.abort', { sessionKey });
}
