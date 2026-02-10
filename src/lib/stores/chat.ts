import { writable, readonly, derived, get, type Readable, type Writable } from 'svelte/store';
import { AgentStreamManager } from '$lib/gateway/stream.js';
import type {
	AnyStreamEvent,
	DeltaEvent,
	ToolCallEvent,
	ToolResultEvent
} from '$lib/gateway/stream.js';
import { call, eventBus, connection } from '$lib/stores/gateway.js';

// Message types
export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	status: 'sending' | 'sent' | 'streaming' | 'complete' | 'error';
	runId?: string;
	thinkingText?: string;
	toolCalls?: ToolCallInfo[];
	errorMessage?: string;
	replyToMessageId?: string;
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
	const _replyTo: Writable<ChatMessage | null> = writable(null);

	// Public readable stores
	const messages: Readable<ChatMessage[]> = readonly(_messages);
	const activeRunId: Readable<string | null> = readonly(_activeRunId);
	const isStreaming: Readable<boolean> = readonly(_isStreaming);
	const replyTo: Readable<ChatMessage | null> = readonly(_replyTo);

	// Derived: is there an active run?
	const hasActiveRun: Readable<boolean> = derived(_activeRunId, ($id) => $id !== null);

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
		_isStreaming.set(false);
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
			_isStreaming.set(true);

			// The response frame handler needs to be wired to call streamManager.onFinal
			// This is handled by listening for the final response matching the runId
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
		try {
			const result = await call<{ messages: ChatMessage[] }>('chat.history', { sessionKey });
			if (result.messages) {
				_messages.update((current) => {
					const existingIds = new Set(current.map((m) => m.id));
					const newMessages = result.messages
						.filter((m) => !existingIds.has(m.id))
						.map((m) => ({ ...m, status: 'complete' as const }));
					// Merge and sort by timestamp
					return [...current, ...newMessages].sort((a, b) => a.timestamp - b.timestamp);
				});
			}
		} catch {
			// History load failed — keep existing messages
		}
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
		unsubStream();
		streamManager.clear();
	}

	return {
		messages,
		activeRunId,
		isStreaming,
		hasActiveRun,
		pendingQueue: readonly(_pendingQueue) as Readable<string[]>,
		replyTo,
		send,
		setReplyTo,
		abort,
		loadHistory,
		reconcile,
		destroy,
		// Expose stream manager for external wiring (response frame handling)
		streamManager
	};
}

export type ChatSessionStore = ReturnType<typeof createChatSession>;
