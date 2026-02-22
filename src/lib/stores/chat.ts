import { writable, readonly, derived, get, type Readable, type Writable } from 'svelte/store';
import { AgentStreamManager } from '$lib/gateway/stream.js';
import type {
	AnyStreamEvent,
	DeltaEvent,
	ToolCallEvent,
	ToolResultEvent
} from '$lib/gateway/stream.js';
import { call, eventBus, connection, setCanvasActiveRunId } from '$lib/stores/gateway.js';

// Message types
export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'divider';
	content: string;
	timestamp: number;
	status: 'sending' | 'sent' | 'streaming' | 'complete' | 'error';
	runId?: string;
	thinkingText?: string;
	toolCalls?: ToolCallInfo[];
	errorMessage?: string;
	replyToMessageId?: string;
	reactions?: ReactionInfo[];
	edited?: boolean;
}

export interface ReactionInfo {
	emoji: string;
	count: number;
	users: string[];
	reacted: boolean;
}

export interface ToolCallInfo {
	toolCallId: string;
	name: string;
	args: Record<string, unknown>;
	output?: unknown;
	status: 'running' | 'complete';
}

// Session store
export interface ChatSession {
	sessionKey: string;
	messages: ChatMessage[];
	activeRunId: string | null;
	isStreaming: boolean;
}

// Create a chat session store
export function createChatSession(sessionKey: string) {
	const streamManager = new AgentStreamManager();
	streamManager.subscribe(eventBus);

	const _messages: Writable<ChatMessage[]> = writable([]);
	const _activeRunId: Writable<string | null> = writable(null);
	const _isStreaming: Writable<boolean> = writable(false);
	const _pendingQueue: Writable<string[]> = writable([]);
	const _isLoadingHistory: Writable<boolean> = writable(false);
	const _replyTo: Writable<ChatMessage | null> = writable(null);
	let _safetyTimer: ReturnType<typeof setTimeout> | null = null;

	// Public readable stores
	const messages: Readable<ChatMessage[]> = readonly(_messages);
	const activeRunId: Readable<string | null> = readonly(_activeRunId);
	const isStreaming: Readable<boolean> = readonly(_isStreaming);
	const replyTo: Readable<ChatMessage | null> = readonly(_replyTo);

	// Derived: is there an active run?
	const hasActiveRun: Readable<boolean> = derived(_activeRunId, ($id) => $id !== null);

	function clearSafetyTimer(): void {
		if (_safetyTimer !== null) {
			clearTimeout(_safetyTimer);
			_safetyTimer = null;
		}
	}

	// Handle stream events
	const unsubStream = streamManager.on((event: AnyStreamEvent) => {
		switch (event.type) {
			case 'delta':
				handleDelta(event as DeltaEvent);
				break;
			case 'toolCall':
				handleToolCall(event as ToolCallEvent);
				break;
			case 'toolResult':
				handleToolResult(event as ToolResultEvent);
				break;
			case 'messageEnd':
				handleMessageEnd(event);
				break;
		}
	});

	// Handle incoming message events (from other users or Discord)
	const unsubChatEvent = eventBus.on('chat.message', (payload) => {
		handleIncomingMessage(payload);
	});

	// Handle message update/edit events
	const unsubUpdateEvent = eventBus.on('chat.message.update', (payload) => {
		handleMessageUpdate(payload);
	});

	// Handle reaction events
	const unsubReactionEvent = eventBus.on('chat.reaction', (payload) => {
		handleReactionEvent(payload);
	});

	function handleDelta(event: DeltaEvent): void {
		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.runId === event.runId && m.role === 'assistant');
			if (idx >= 0) {
				const updated = [...msgs];
				updated[idx] = {
					...updated[idx],
					content: event.text,
					thinkingText: event.thinkingText,
					status: 'streaming'
				};
				return updated;
			}
			return msgs;
		});
	}

	function handleToolCall(event: ToolCallEvent): void {
		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.runId === event.runId && m.role === 'assistant');
			if (idx >= 0) {
				const updated = [...msgs];
				const toolCalls = [...(updated[idx].toolCalls ?? [])];
				toolCalls.push({
					toolCallId: event.toolCallId,
					name: event.name,
					args: event.args,
					status: 'running'
				});
				updated[idx] = { ...updated[idx], toolCalls };
				return updated;
			}
			return msgs;
		});
	}

	function handleToolResult(event: ToolResultEvent): void {
		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.runId === event.runId && m.role === 'assistant');
			if (idx >= 0) {
				const updated = [...msgs];
				const toolCalls = [...(updated[idx].toolCalls ?? [])];
				const tcIdx = toolCalls.findIndex((tc) => tc.toolCallId === event.toolCallId);
				if (tcIdx >= 0) {
					toolCalls[tcIdx] = { ...toolCalls[tcIdx], output: event.output, status: 'complete' };
				}
				updated[idx] = { ...updated[idx], toolCalls };
				return updated;
			}
			return msgs;
		});
	}

	function handleMessageEnd(event: {
		runId: string;
		status: string;
		summary?: string;
		errorMessage?: string;
	}): void {
		clearSafetyTimer();
		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.runId === event.runId && m.role === 'assistant');
			if (idx >= 0) {
				const updated = [...msgs];
				updated[idx] = {
					...updated[idx],
					status: event.status === 'ok' ? 'complete' : 'error',
					errorMessage: event.errorMessage
				};
				return updated;
			}
			return msgs;
		});
		_activeRunId.set(null);
		setCanvasActiveRunId(null);
		_isStreaming.set(false);
	}

	/** Handle incoming message event (from other users or Discord) */
	function handleIncomingMessage(payload: Record<string, unknown>): void {
		const msgSessionKey = payload.sessionKey as string;
		if (msgSessionKey !== sessionKey) return;

		const message: ChatMessage = {
			id: (payload.messageId ?? payload.id ?? crypto.randomUUID()) as string,
			role: (payload.role ?? 'user') as 'user' | 'assistant',
			content: (payload.content ?? payload.text ?? '') as string,
			timestamp: (payload.timestamp ?? Date.now()) as number,
			status: 'complete',
			replyToMessageId: payload.replyToMessageId as string | undefined
		};

		// Deduplicate by ID
		_messages.update((msgs) => {
			if (msgs.some((m) => m.id === message.id)) return msgs;
			return [...msgs, message];
		});
	}

	/** Handle a message update/edit event from the gateway */
	function handleMessageUpdate(payload: Record<string, unknown>): void {
		const msgSessionKey = payload.sessionKey as string;
		if (msgSessionKey !== sessionKey) return;

		const messageId = (payload.messageId ?? payload.id) as string;
		if (!messageId) return;

		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.id === messageId);
			if (idx < 0) return msgs;
			const updated = [...msgs];
			const patch: Partial<ChatMessage> = { edited: true };
			if (payload.content != null) {
				patch.content = extractTextContent(payload.content);
			}
			if (payload.status != null) {
				patch.status = payload.status as ChatMessage['status'];
			}
			updated[idx] = { ...updated[idx], ...patch };
			return updated;
		});
	}

	/** Handle a reaction event from the gateway */
	function handleReactionEvent(payload: Record<string, unknown>): void {
		const msgSessionKey = payload.sessionKey as string;
		if (msgSessionKey !== sessionKey) return;

		const messageId = payload.messageId as string;
		const emoji = payload.emoji as string;
		const user = payload.user as string;
		const action = payload.action as 'add' | 'remove';

		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.id === messageId);
			if (idx < 0) return msgs;
			const updated = [...msgs];
			const reactions = [...(updated[idx].reactions ?? [])];
			const ri = reactions.findIndex((r) => r.emoji === emoji);

			if (action === 'add') {
				if (ri >= 0) {
					const r = reactions[ri];
					if (!r.users.includes(user)) {
						reactions[ri] = {
							...r,
							count: r.count + 1,
							users: [...r.users, user],
							reacted: r.reacted || user === 'self'
						};
					}
				} else {
					reactions.push({
						emoji,
						count: 1,
						users: [user],
						reacted: user === 'self'
					});
				}
			} else if (ri >= 0) {
				const r = reactions[ri];
				const newUsers = r.users.filter((u) => u !== user);
				if (newUsers.length === 0) {
					reactions.splice(ri, 1);
				} else {
					reactions[ri] = {
						...r,
						count: newUsers.length,
						users: newUsers,
						reacted: user === 'self' ? false : r.reacted
					};
				}
			}

			updated[idx] = { ...updated[idx], reactions: reactions.length ? reactions : undefined };
			return updated;
		});
	}

	/** Add a reaction to a message */
	async function addReaction(messageId: string, emoji: string): Promise<void> {
		// Optimistic update
		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.id === messageId);
			if (idx < 0) return msgs;
			const updated = [...msgs];
			const reactions = [...(updated[idx].reactions ?? [])];
			const ri = reactions.findIndex((r) => r.emoji === emoji);
			if (ri >= 0) {
				const r = reactions[ri];
				if (!r.reacted) {
					reactions[ri] = {
						...r,
						count: r.count + 1,
						users: [...r.users, 'self'],
						reacted: true
					};
				}
			} else {
				reactions.push({ emoji, count: 1, users: ['self'], reacted: true });
			}
			updated[idx] = { ...updated[idx], reactions };
			return updated;
		});

		try {
			await call('chat.react', { sessionKey, messageId, emoji, action: 'add' });
		} catch {
			// Rollback optimistic update
			_messages.update((msgs) => {
				const idx = msgs.findIndex((m) => m.id === messageId);
				if (idx < 0) return msgs;
				const updated = [...msgs];
				const reactions = [...(updated[idx].reactions ?? [])];
				const ri = reactions.findIndex((r) => r.emoji === emoji);
				if (ri >= 0) {
					const r = reactions[ri];
					const newUsers = r.users.filter((u) => u !== 'self');
					if (newUsers.length === 0) {
						reactions.splice(ri, 1);
					} else {
						reactions[ri] = { ...r, count: newUsers.length, users: newUsers, reacted: false };
					}
				}
				updated[idx] = {
					...updated[idx],
					reactions: reactions.length ? reactions : undefined
				};
				return updated;
			});
		}
	}

	/** Remove a reaction from a message */
	async function removeReaction(messageId: string, emoji: string): Promise<void> {
		// Optimistic update
		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.id === messageId);
			if (idx < 0) return msgs;
			const updated = [...msgs];
			const reactions = [...(updated[idx].reactions ?? [])];
			const ri = reactions.findIndex((r) => r.emoji === emoji);
			if (ri >= 0) {
				const r = reactions[ri];
				const newUsers = r.users.filter((u) => u !== 'self');
				if (newUsers.length === 0) {
					reactions.splice(ri, 1);
				} else {
					reactions[ri] = { ...r, count: newUsers.length, users: newUsers, reacted: false };
				}
			}
			updated[idx] = { ...updated[idx], reactions: reactions.length ? reactions : undefined };
			return updated;
		});

		try {
			await call('chat.react', { sessionKey, messageId, emoji, action: 'remove' });
		} catch {
			// Rollback — re-add self
			_messages.update((msgs) => {
				const idx = msgs.findIndex((m) => m.id === messageId);
				if (idx < 0) return msgs;
				const updated = [...msgs];
				const reactions = [...(updated[idx].reactions ?? [])];
				const ri = reactions.findIndex((r) => r.emoji === emoji);
				if (ri >= 0) {
					const r = reactions[ri];
					reactions[ri] = {
						...r,
						count: r.count + 1,
						users: [...r.users, 'self'],
						reacted: true
					};
				} else {
					reactions.push({ emoji, count: 1, users: ['self'], reacted: true });
				}
				updated[idx] = { ...updated[idx], reactions };
				return updated;
			});
		}
	}

	/**
	 * Set or clear the message being replied to.
	 */
	function setReplyTo(message: ChatMessage | null): void {
		_replyTo.set(message);
	}

	/**
	 * Send a message to the agent. Optimistic: user message appears immediately.
	 */
	async function send(message: string): Promise<void> {
		const idempotencyKey = crypto.randomUUID();
		const currentReplyTo = get(_replyTo);
		const userMessage: ChatMessage = {
			id: idempotencyKey,
			role: 'user',
			content: message,
			timestamp: Date.now(),
			status: 'sending',
			replyToMessageId: currentReplyTo?.id
		};

		// Optimistic: add user message immediately
		_messages.update((msgs) => [...msgs, userMessage]);

		// Clear reply state after using it
		_replyTo.set(null);

		// Check connection state — queue if not ready
		const state = get(connection.state);
		if (state !== 'READY') {
			// Queue for later
			_pendingQueue.update((q) => [...q, message]);
			// Still show user message optimistically
			return;
		}

		try {
			const result = await call<{ runId: string; status: string }>('chat.send', {
				sessionKey,
				message,
				idempotencyKey,
				deliver: false,
				replyToMessageId: currentReplyTo?.id
			});

			const runId = result.runId;

			// Update user message to sent
			_messages.update((msgs) =>
				msgs.map((m) => (m.id === idempotencyKey ? { ...m, status: 'sent' as const } : m))
			);

			// Notify stream manager of ack
			streamManager.onAck(runId, sessionKey);

			// Create placeholder assistant message
			const assistantMessage: ChatMessage = {
				id: `${runId}-response`,
				role: 'assistant',
				content: '',
				timestamp: Date.now(),
				status: 'streaming',
				runId
			};
			_messages.update((msgs) => [...msgs, assistantMessage]);
			_activeRunId.set(runId);
			setCanvasActiveRunId(runId);
			_isStreaming.set(true);

			// Safety timeout: auto-unlock if no messageEnd arrives within 60s of last activity
			clearSafetyTimer();
			_safetyTimer = setTimeout(() => {
				if (streamManager.isActive(runId)) {
					streamManager.onFinal(runId, 'error', undefined, 'Response timed out');
				}
			}, 60_000);
		} catch (err) {
			// Mark user message as error
			_messages.update((msgs) =>
				msgs.map((m) =>
					m.id === idempotencyKey
						? { ...m, status: 'error' as const, errorMessage: (err as Error).message }
						: m
				)
			);
		}
	}

	/**
	 * Abort the active run.
	 */
	async function abort(): Promise<void> {
		clearSafetyTimer();
		let currentRunId: string | null = null;
		const unsub = _activeRunId.subscribe((v) => {
			currentRunId = v;
		});
		unsub();

		if (!currentRunId) return;

		try {
			await call('chat.abort', { sessionKey, runId: currentRunId });
		} catch {
			// Abort failed — still clear state
		}
		streamManager.onFinal(currentRunId, 'aborted');
	}

	/**
	 * Load message history (for reconnect reconciliation).
	 * Deduplicates by message ID.
	 */
	async function loadHistory(): Promise<void> {
		if (get(_isLoadingHistory)) return; // already in progress
		_isLoadingHistory.set(true);
		try {
			const result = await call<{ messages: Record<string, unknown>[] }>('chat.history', {
				sessionKey
			});
			if (result.messages) {
				_messages.update((current) => {
					const existingIds = new Set(current.map((m) => m.id));
					const newMessages = result.messages
						.filter((m) => !existingIds.has(m.id as string))
						.map((m) => normalizeMessage(m));
					// Merge and sort by timestamp
					return [...current, ...newMessages].sort((a, b) => a.timestamp - b.timestamp);
				});
			}
		} catch (err) {
			console.warn('[chat] loadHistory failed for', sessionKey, err);
		} finally {
			_isLoadingHistory.set(false);
		}
	}

	/** Normalize a raw gateway message into a ChatMessage */
	function normalizeMessage(raw: Record<string, unknown>): ChatMessage {
		return {
			id: (raw.id ?? raw.messageId ?? crypto.randomUUID()) as string,
			role: (raw.role ?? 'assistant') as 'user' | 'assistant',
			content: extractTextContent(raw.content),
			timestamp: (raw.timestamp ?? Date.now()) as number,
			status: 'complete',
			runId: raw.runId as string | undefined,
			replyToMessageId: raw.replyToMessageId as string | undefined
		};
	}

	/** Extract plain text from gateway content (may be string, array of blocks, or other) */
	function extractTextContent(content: unknown): string {
		if (typeof content === 'string') return content;
		if (Array.isArray(content)) {
			return content
				.map((block) => {
					if (typeof block === 'string') return block;
					if (block && typeof block === 'object') {
						return (block as Record<string, unknown>).text ?? '';
					}
					return '';
				})
				.join('');
		}
		return String(content ?? '');
	}

	/**
	 * Reconcile state after reconnection.
	 * Loads history, flushes queued messages, resumes active runs.
	 */
	async function reconcile(): Promise<void> {
		// 1. Load history to fill gaps
		await loadHistory();

		// 2. Flush queued messages
		const queued = get(_pendingQueue);
		_pendingQueue.set([]);
		for (const msg of queued) {
			await send(msg);
		}

		// 3. Check if there was an active run that needs resuming
		const runId = get(_activeRunId);
		if (runId) {
			// Re-subscribe stream manager — events will resume from gateway
			streamManager.onAck(runId, sessionKey);
			_isStreaming.set(true);
		}
	}

	/**
	 * Clean up the session store.
	 */
	function destroy(): void {
		clearSafetyTimer();
		unsubStream();
		unsubChatEvent();
		unsubUpdateEvent();
		unsubReactionEvent();
		streamManager.clear();
	}

	/**
	 * Retry a failed user message by removing the old one and re-sending.
	 */
	async function retry(messageId: string): Promise<void> {
		const msgs = get(_messages);
		const msg = msgs.find((m) => m.id === messageId && m.status === 'error');
		if (!msg) return;
		// Remove the failed message
		_messages.update((list) => list.filter((m) => m.id !== messageId));
		// Re-send
		await send(msg.content);
	}

	/**
	 * Insert a divider message into the chat history.
	 */
	function insertDivider(content: string = 'New conversation started'): void {
		const dividerMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'divider',
			content,
			timestamp: Date.now(),
			status: 'complete'
		};
		_messages.update((msgs) => [...msgs, dividerMessage]);
	}

	return {
		messages,
		activeRunId,
		isStreaming,
		isLoadingHistory: readonly(_isLoadingHistory) as Readable<boolean>,
		hasActiveRun,
		pendingQueue: readonly(_pendingQueue) as Readable<string[]>,
		replyTo,
		send,
		setReplyTo,
		addReaction,
		removeReaction,
		abort,
		retry,
		insertDivider,
		loadHistory,
		reconcile,
		destroy,
		// Expose stream manager for external wiring (response frame handling)
		streamManager
	};
}

export type ChatSessionStore = ReturnType<typeof createChatSession>;
