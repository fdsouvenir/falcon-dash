import { writable, readonly, derived, get, type Readable, type Writable } from 'svelte/store';
import { AgentStreamManager } from '$lib/gateway/stream.js';
import type {
	AnyStreamEvent,
	MessageStartEvent,
	DeltaEvent,
	ToolCallEvent,
	ToolResultEvent
} from '$lib/gateway/stream.js';
import { call, eventBus, connection, setCanvasActiveRunId } from '$lib/stores/gateway.js';

// Poll types
export interface PollData {
	question: string;
	options: PollOption[];
	maxSelections: number;
	closed: boolean;
	totalVotes: number;
}

export interface PollOption {
	text: string;
	votes: number;
	votedBySelf: boolean;
}

// Send effect types
export type BubbleEffect = 'slam' | 'loud' | 'gentle' | 'invisible-ink';
export type ScreenEffect =
	| 'confetti'
	| 'fireworks'
	| 'hearts'
	| 'balloons'
	| 'celebration'
	| 'lasers'
	| 'spotlight'
	| 'echo';

export interface SendEffect {
	type: 'bubble' | 'screen';
	name: BubbleEffect | ScreenEffect;
	played?: boolean;
}

// Message types
export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'divider';
	content: string;
	timestamp: number;
	status: 'sending' | 'sent' | 'streaming' | 'complete' | 'error';
	runId?: string;
	thinkingText?: string;
	thinkingStartedAt?: number;
	thinkingCompletedAt?: number;
	toolCalls?: ToolCallInfo[];
	sources?: SourceInfo[];
	plan?: PlanStep[];
	errorMessage?: string;
	replyToMessageId?: string;
	reactions?: ReactionInfo[];
	edited?: boolean;
	poll?: PollData;
	sendEffect?: SendEffect;
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
	status: 'pending' | 'running' | 'complete' | 'error';
	startedAt?: number;
	completedAt?: number;
	errorMessage?: string;
}

export interface SourceInfo {
	title: string;
	url: string;
	snippet?: string;
}

export interface PlanStep {
	label: string;
	description?: string;
	status: 'pending' | 'active' | 'complete';
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
			case 'messageStart':
				handleMessageStart(event as MessageStartEvent);
				break;
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

	// Handle poll update events
	const unsubPollEvent = eventBus.on('chat.poll', (payload) => {
		handlePollEvent(payload);
	});

	function handleMessageStart(event: MessageStartEvent): void {
		// Ensure an assistant placeholder exists for this run.
		// Agent events may arrive before the chat.send RPC response creates the placeholder.
		_messages.update((msgs) => {
			if (msgs.some((m) => m.runId === event.runId && m.role === 'assistant')) return msgs;
			const assistantMessage: ChatMessage = {
				id: `${event.runId}-response`,
				role: 'assistant',
				content: '',
				timestamp: Date.now(),
				status: 'streaming',
				runId: event.runId
			};
			return [...msgs, assistantMessage];
		});
		_activeRunId.set(event.runId);
		setCanvasActiveRunId(event.runId);
		_isStreaming.set(true);
	}

	function handleDelta(event: DeltaEvent): void {
		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.runId === event.runId && m.role === 'assistant');
			if (idx >= 0) {
				const updated = [...msgs];
				const msg = updated[idx];
				const patch: Partial<ChatMessage> = {
					content: event.text,
					status: 'streaming'
				};
				// Only update thinkingText if the event carries a non-empty value
				// (never overwrite accumulated thinking with empty string)
				if (event.thinkingText) {
					patch.thinkingText = event.thinkingText;
				}
				// Track thinking timestamps
				if (event.thinkingText && !msg.thinkingStartedAt) {
					patch.thinkingStartedAt = Date.now();
				}
				if (event.text && msg.thinkingText && msg.thinkingStartedAt && !msg.thinkingCompletedAt) {
					patch.thinkingCompletedAt = Date.now();
				}
				updated[idx] = { ...msg, ...patch };
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
					status: 'running',
					startedAt: Date.now()
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
					const isError = !!(event as ToolResultEvent & { isError?: boolean }).isError;
					toolCalls[tcIdx] = {
						...toolCalls[tcIdx],
						output: event.output,
						status: isError ? 'error' : 'complete',
						completedAt: Date.now(),
						errorMessage: isError
							? ((event as ToolResultEvent & { errorMessage?: string }).errorMessage ??
								String(event.output ?? 'Tool error'))
							: undefined
					};
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
				const msg = updated[idx];

				// Remove empty assistant bubbles (NO_REPLY, HEARTBEAT_OK, or truly empty)
				const hasContent = msg.content && msg.content.trim().length > 0;
				const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
				if (!hasContent && !hasToolCalls && event.status === 'ok') {
					updated.splice(idx, 1);
					return updated;
				}

				// Mark any still-running tool calls as error
				const toolCalls = msg.toolCalls?.map((tc) =>
					tc.status === 'running'
						? {
								...tc,
								status: 'error' as const,
								completedAt: Date.now(),
								errorMessage: 'Run ended before tool completed'
							}
						: tc
				);
				updated[idx] = {
					...msg,
					status: event.status === 'ok' ? 'complete' : 'error',
					errorMessage: event.errorMessage,
					toolCalls
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

		// Skip system/internal messages — they should never appear in the UI
		const role = (payload.role ?? 'user') as string;
		if (role === 'system') return;
		const rawContent = (payload.content ?? payload.text ?? '') as string;
		if (isInternalMessage(rawContent)) return;

		const message: ChatMessage = {
			id: (payload.messageId ?? payload.id ?? crypto.randomUUID()) as string,
			role: role as 'user' | 'assistant',
			content: rawContent,
			timestamp: (payload.timestamp ?? Date.now()) as number,
			status: 'complete',
			replyToMessageId: payload.replyToMessageId as string | undefined,
			sendEffect: payload.sendEffect
				? { ...(payload.sendEffect as SendEffect), played: false }
				: undefined
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
	async function send(message: string, files?: File[]): Promise<void> {
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
			// Encode file attachments as base64 for the gateway
			let attachments: Array<{ type: string; mimeType: string; content: string }> | undefined;
			if (files && files.length > 0) {
				attachments = await Promise.all(
					files.map(async (file) => {
						const buffer = await file.arrayBuffer();
						const bytes = new Uint8Array(buffer);
						let binary = '';
						for (let i = 0; i < bytes.length; i++) {
							binary += String.fromCharCode(bytes[i]);
						}
						const base64 = btoa(binary);
						const mimeType = file.type || 'application/octet-stream';
						const kind = mimeType.startsWith('image/') ? 'image' : 'file';
						return { type: kind, mimeType, content: base64 };
					})
				);
			}

			const result = await call<{ runId: string; status: string }>('chat.send', {
				sessionKey,
				message,
				idempotencyKey,
				deliver: false,
				replyToMessageId: currentReplyTo?.id,
				...(attachments ? { attachments } : {})
			});

			const runId = result.runId;

			// Update user message to sent
			_messages.update((msgs) =>
				msgs.map((m) => (m.id === idempotencyKey ? { ...m, status: 'sent' as const } : m))
			);

			// Notify stream manager of ack
			streamManager.onAck(runId, sessionKey);

			// Create placeholder assistant message (skip if messageStart already created one)
			_messages.update((msgs) => {
				if (msgs.some((m) => m.runId === runId && m.role === 'assistant')) return msgs;
				return [
					...msgs,
					{
						id: `${runId}-response`,
						role: 'assistant' as const,
						content: '',
						timestamp: Date.now(),
						status: 'streaming' as const,
						runId
					}
				];
			});
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
					const rawMessages = result.messages.filter((m) => !existingIds.has(m.id as string));

					// Build a map of toolCallId → toolResult for pairing
					const toolResults = new Map<
						string,
						{ content: string; isError: boolean; toolName: string }
					>();
					for (const m of rawMessages) {
						if ((m.role as string) === 'toolResult' && m.toolCallId) {
							toolResults.set(m.toolCallId as string, {
								content: extractTextContent(m.content),
								isError: !!m.isError,
								toolName: (m.toolName ?? '') as string
							});
						}
					}

					const newMessages = rawMessages
						.map((m) => normalizeMessage(m, toolResults))
						.filter((m): m is ChatMessage => m !== null);
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

	/** Check if a message is internal/system and should be hidden from the UI */
	function isInternalMessage(content: string): boolean {
		if (!content) return false;
		const trimmed = content.trimStart();
		return trimmed.startsWith('[System Message]') || trimmed.startsWith('[system]');
	}

	/** Normalize a raw gateway message into a ChatMessage, or null if it should be filtered */
	function normalizeMessage(
		raw: Record<string, unknown>,
		toolResults?: Map<string, { content: string; isError: boolean; toolName: string }>
	): ChatMessage | null {
		// Filter out system/internal messages and tool results (paired with assistant messages)
		const role = (raw.role ?? 'assistant') as string;
		if (role === 'system' || role === 'toolResult') return null;
		const content = extractTextContent(raw.content);
		if (isInternalMessage(content)) return null;

		// Extract tool calls from content blocks
		const toolCalls = extractToolCalls(raw.content, toolResults);

		// Filter out empty assistant messages (NO_REPLY / HEARTBEAT_OK responses that were stripped)
		// But keep them if they have tool calls
		if (role === 'assistant' && !content.trim() && (!toolCalls || toolCalls.length === 0))
			return null;

		return {
			id: (raw.id ?? raw.messageId ?? crypto.randomUUID()) as string,
			role: role as 'user' | 'assistant',
			content,
			thinkingText: extractThinkingContent(raw.content),
			...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
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
						const b = block as Record<string, unknown>;
						if (b.type === 'thinking' || b.type === 'toolCall') return '';
						return (b.text ?? '') as string;
					}
					return '';
				})
				.join('');
		}
		return String(content ?? '');
	}

	/** Extract thinking text from gateway content blocks */
	function extractThinkingContent(content: unknown): string | undefined {
		if (!Array.isArray(content)) {
			// Handle string content that may contain thinking markers
			if (typeof content === 'string') {
				const thinkMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
				if (thinkMatch) return thinkMatch[1].trim() || undefined;
			}
			return undefined;
		}
		const parts: string[] = [];
		for (const block of content) {
			if (block && typeof block === 'object') {
				const b = block as Record<string, unknown>;
				if (b.type === 'thinking' && typeof b.thinking === 'string') {
					const text = (b.thinking as string).trim();
					if (text) parts.push(text);
				}
			}
		}
		return parts.length > 0 ? parts.join('\n') : undefined;
	}

	/** Extract tool calls from gateway content blocks and pair with results */
	function extractToolCalls(
		content: unknown,
		toolResults?: Map<string, { content: string; isError: boolean; toolName: string }>
	): ToolCallInfo[] | undefined {
		if (!Array.isArray(content)) return undefined;
		const calls: ToolCallInfo[] = [];
		for (const block of content) {
			if (block && typeof block === 'object') {
				const b = block as Record<string, unknown>;
				if (b.type === 'toolCall' && typeof b.id === 'string' && typeof b.name === 'string') {
					const result = toolResults?.get(b.id);
					calls.push({
						toolCallId: b.id,
						name: b.name,
						args: (b.arguments as Record<string, unknown>) ?? {},
						output: result?.content,
						status: result ? (result.isError ? 'error' : 'complete') : 'complete',
						errorMessage: result?.isError ? result.content : undefined
					});
				}
			}
		}
		return calls.length > 0 ? calls : undefined;
	}

	/** Handle a poll update event from the gateway */
	function handlePollEvent(payload: Record<string, unknown>): void {
		const msgSessionKey = payload.sessionKey as string;
		if (msgSessionKey !== sessionKey) return;

		const messageId = payload.messageId as string;
		if (!messageId) return;

		_messages.update((msgs) => {
			const idx = msgs.findIndex((m) => m.id === messageId);
			if (idx < 0) return msgs;
			const updated = [...msgs];
			const pollUpdate = payload.poll as PollData | undefined;
			if (pollUpdate) {
				updated[idx] = { ...updated[idx], poll: pollUpdate };
			}
			return updated;
		});
	}

	/**
	 * Send a poll message. Optimistic: poll appears immediately.
	 */
	/**
	 * Send a poll via the gateway `poll` RPC.
	 * Renders an optimistic poll card immediately; the gateway handles delivery.
	 */
	async function sendPoll(pollInput: {
		question: string;
		options: string[];
		maxSelections?: number;
		duration?: number;
	}): Promise<void> {
		const idempotencyKey = crypto.randomUUID();
		const poll: PollData = {
			question: pollInput.question,
			options: pollInput.options.map((text) => ({ text, votes: 0, votedBySelf: false })),
			maxSelections: pollInput.maxSelections ?? 1,
			closed: false,
			totalVotes: 0
		};

		const messageText = `📊 ${pollInput.question}`;
		const userMessage: ChatMessage = {
			id: idempotencyKey,
			role: 'user',
			content: messageText,
			timestamp: Date.now(),
			status: 'sending',
			poll
		};

		_messages.update((msgs) => [...msgs, userMessage]);

		const connState = get(connection.state);
		if (connState !== 'READY') {
			_pendingQueue.update((q) => [...q, messageText]);
			return;
		}

		try {
			// Use the gateway's dedicated `poll` RPC method
			await call('poll', {
				to: sessionKey,
				question: pollInput.question,
				options: pollInput.options,
				idempotencyKey,
				...(pollInput.maxSelections != null ? { maxSelections: pollInput.maxSelections } : {}),
				...(pollInput.duration != null
					? { durationHours: Math.ceil(pollInput.duration / 3600) }
					: {}),
				channel: 'falcon'
			});

			_messages.update((msgs) =>
				msgs.map((m) => (m.id === idempotencyKey ? { ...m, status: 'complete' as const } : m))
			);
		} catch (err) {
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
	 * Vote on a poll option. Purely client-side — no gateway RPC.
	 */
	function votePoll(messageId: string, optionIndices: number[]): void {
		_messages.update((list) => {
			const idx = list.findIndex((m) => m.id === messageId);
			if (idx < 0) return list;
			const msg = list[idx];
			if (!msg.poll || msg.poll.closed) return list;

			const updated = [...list];
			const poll = { ...msg.poll };
			const options = poll.options.map((opt, i) => {
				const wasVoted = opt.votedBySelf;
				const shouldVote = optionIndices.includes(i);
				return {
					...opt,
					votedBySelf: shouldVote,
					votes: opt.votes + (shouldVote && !wasVoted ? 1 : !shouldVote && wasVoted ? -1 : 0)
				};
			});
			const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);
			updated[idx] = { ...updated[idx], poll: { ...poll, options, totalVotes } };
			return updated;
		});
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
		unsubPollEvent();
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

	/**
	 * Inject an external message into this session (e.g., from a gateway broadcast).
	 * The payload is treated as if it arrived via `chat.message` for this session.
	 */
	function injectMessage(payload: Record<string, unknown>): void {
		handleIncomingMessage({ ...payload, sessionKey });
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
		sendPoll,
		votePoll,
		setReplyTo,
		addReaction,
		removeReaction,
		abort,
		retry,
		insertDivider,
		injectMessage,
		loadHistory,
		reconcile,
		destroy,
		// Expose stream manager for external wiring (response frame handling)
		streamManager
	};
}

export type ChatSessionStore = ReturnType<typeof createChatSession>;
