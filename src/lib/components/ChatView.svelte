<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { page } from '$app/stores';
	import { activeSessionKey, setActiveSession } from '$lib/stores/sessions.js';
	import { createChatSession, type ChatSessionStore, type ChatMessage } from '$lib/stores/chat.js';
	import { activeThread, closeThread } from '$lib/stores/threads.js';
	import { connection, canvasStore } from '$lib/stores/gateway.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import { renderMarkdownSync } from '$lib/chat/markdown.js';
	import { formatMessageTime } from '$lib/chat/time-utils.js';
	import { keyboardVisible } from '$lib/stores/viewport.js';
	import { clearSearch } from '$lib/stores/chat-search.js';
	import { watchConnectionForChat } from '$lib/stores/chat-resilience.js';
	import ChatHeader from './ChatHeader.svelte';
	import ChatSearch from './ChatSearch.svelte';
	import MessageComposer from './MessageComposer.svelte';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import ToolCallCard from './ToolCallCard.svelte';
	import CanvasBlock from './canvas/CanvasBlock.svelte';
	import ReplyPreview from './ReplyPreview.svelte';
	import ReactionPicker from './ReactionPicker.svelte';
	import ReactionDisplay from './ReactionDisplay.svelte';
	import ThreadPanel from './ThreadPanel.svelte';
	import type { ThreadInfo } from '$lib/stores/threads.js';
	import type { ConnectionState } from '$lib/gateway/types.js';

	let sessionKey = $state<string | null>(null);
	let chatSession = $state<ChatSessionStore | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let isStreaming = $state(false);
	let isLoadingHistory = $state(true);
	let replyToMessage = $state<ChatMessage | null>(null);
	let showSearch = $state(false);
	let thread = $state<ThreadInfo | null>(null);
	let connState = $state<ConnectionState>('DISCONNECTED');
	let currentSurface = $state<CanvasSurface | null>(null);

	// Plain Map for rendered HTML cache — intentionally non-reactive to avoid effect cycles
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const renderedCache = new Map<string, string>();

	let scrollContainer: HTMLDivElement;
	let shouldAutoScroll = $state(true);
	let highlightedMessageId = $state<string | null>(null);
	let pendingScrollToId = $state<string | null>(null);

	// Track active session key
	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			sessionKey = v;
		});
		return unsub;
	});

	// Track connection state
	$effect(() => {
		const unsub = connection.state.subscribe((v) => {
			connState = v;
		});
		return unsub;
	});

	// Track active thread
	$effect(() => {
		const unsub = activeThread.subscribe((v) => {
			thread = v;
		});
		return unsub;
	});

	// Track current canvas surface (for floating canvas panel)
	$effect(() => {
		const unsub = canvasStore.currentSurface.subscribe((v) => {
			currentSurface = v;
			console.log('[ChatView] currentSurface updated:', v?.surfaceId, 'visible:', v?.visible);
		});
		return unsub;
	});

	// Create/destroy chat session when sessionKey changes
	$effect(() => {
		if (!sessionKey) {
			const prev = untrack(() => chatSession);
			if (prev) {
				prev.destroy();
				chatSession = null;
			}
			messages = [];
			renderedCache.clear();
			return;
		}

		// Destroy previous session
		const prev = untrack(() => chatSession);
		if (prev) {
			prev.destroy();
		}

		renderedCache.clear();
		const session = createChatSession(sessionKey);
		chatSession = session;

		// Wire resilience watcher for reconnect reconciliation
		const unwatchConnection = watchConnectionForChat(session);

		return () => {
			unwatchConnection();
		};
	});

	// Load history when connection becomes READY (handles race condition + reconnect)
	$effect(() => {
		if (connState !== 'READY') return;
		const session = untrack(() => chatSession);
		if (!session) return;
		queueMicrotask(() => session.loadHistory());
	});

	// Subscribe to chat session stores
	$effect(() => {
		if (!chatSession) return;
		const unsub = chatSession.messages.subscribe((v) => {
			messages = v;
		});
		return unsub;
	});

	$effect(() => {
		if (!chatSession) return;
		const unsub = chatSession.isStreaming.subscribe((v) => {
			isStreaming = v;
		});
		return unsub;
	});

	$effect(() => {
		if (!chatSession) return;
		const unsub = chatSession.isLoadingHistory.subscribe((v) => {
			isLoadingHistory = v;
		});
		return unsub;
	});

	$effect(() => {
		if (!chatSession) return;
		const unsub = chatSession.replyTo.subscribe((v) => {
			replyToMessage = v;
		});
		return unsub;
	});

	// Auto-scroll to bottom on new messages
	$effect(() => {
		// Depend on messages length to trigger
		const len = messages.length;
		if (len && scrollContainer) {
			const autoScroll = untrack(() => shouldAutoScroll);
			if (autoScroll) {
				requestAnimationFrame(() => {
					if (scrollContainer) {
						scrollContainer.scrollTop = scrollContainer.scrollHeight;
					}
				});
			}
		}
	});

	// Re-scroll when keyboard opens/closes (mobile)
	$effect(() => {
		const unsub = keyboardVisible.subscribe(() => {
			if (shouldAutoScroll && scrollContainer) {
				requestAnimationFrame(() => {
					if (scrollContainer) {
						scrollContainer.scrollTop = scrollContainer.scrollHeight;
					}
				});
			}
		});
		return unsub;
	});

	// Read ?msg= URL param for deep-link jump-to-message
	$effect(() => {
		const unsub = page.subscribe(($page) => {
			const msgId = $page.url.searchParams.get('msg');
			if (msgId) {
				pendingScrollToId = msgId;
				// Clear the param from the URL without triggering navigation
				const url = new URL(window.location.href);
				url.searchParams.delete('msg');
				history.replaceState(history.state, '', url.pathname + url.search);
			}
		});
		return unsub;
	});

	// When messages load and we have a pending scroll target, scroll to it
	$effect(() => {
		const target = pendingScrollToId;
		const len = messages.length;
		if (!target || !len || !scrollContainer) return;
		// Check if the target message exists in the loaded messages
		if (!messages.some((m) => m.id === target)) return;
		// Found it — scroll after DOM renders
		requestAnimationFrame(() => {
			scrollToMessage(target);
		});
		pendingScrollToId = null;
	});

	/**
	 * Scroll to a specific message and briefly highlight it.
	 * Can be called from URL deep-links or programmatically (e.g. clicking a reply preview).
	 */
	function scrollToMessage(messageId: string) {
		if (!scrollContainer) return;
		const el = scrollContainer.querySelector(`[data-message-id="${messageId}"]`);
		if (!el) return;
		shouldAutoScroll = false;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		highlightedMessageId = messageId;
		setTimeout(() => {
			highlightedMessageId = null;
		}, 2000);
	}

	function handleScroll() {
		if (!scrollContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 100;
	}

	function handleSend(message: string) {
		if (!chatSession) return;
		chatSession.send(message);
		shouldAutoScroll = true;
	}

	function handleAbort() {
		if (!chatSession) return;
		chatSession.abort();
	}

	function handleReply(message: ChatMessage) {
		if (!chatSession) return;
		chatSession.setReplyTo(message);
	}

	function cancelReply() {
		if (!chatSession) return;
		chatSession.setReplyTo(null);
	}

	function handleRetry(messageId: string) {
		if (!chatSession) return;
		chatSession.retry(messageId);
	}

	function toggleSearch() {
		showSearch = !showSearch;
		if (!showSearch) {
			clearSearch();
		}
	}

	async function handleSearchJump(jumpSessionKey: string, messageId: string) {
		const currentKey = untrack(() => sessionKey);
		if (jumpSessionKey !== currentKey) {
			setActiveSession(jumpSessionKey);
			await tick();
		}
		showSearch = false;
		clearSearch();
		requestAnimationFrame(() => {
			scrollToMessage(messageId);
		});
	}

	function findMessageById(id: string): ChatMessage | undefined {
		return messages.find((m) => m.id === id);
	}

	let reactionPickerMessageId = $state<string | null>(null);
	let isMobile = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const mql = window.matchMedia('(max-width: 767px)');
		isMobile = mql.matches;
		function handleChange(e: MediaQueryListEvent) {
			isMobile = e.matches;
		}
		mql.addEventListener('change', handleChange);
		return () => mql.removeEventListener('change', handleChange);
	});

	function toggleReactionPicker(messageId: string) {
		reactionPickerMessageId = reactionPickerMessageId === messageId ? null : messageId;
	}

	function handleReactionSelect(messageId: string, emoji: string) {
		if (!chatSession) return;
		chatSession.addReaction(messageId, emoji);
		reactionPickerMessageId = null;
	}

	function handleReactionToggle(messageId: string, emoji: string) {
		if (!chatSession) return;
		const msg = messages.find((m) => m.id === messageId);
		const reaction = msg?.reactions?.find((r) => r.emoji === emoji);
		if (reaction?.reacted) {
			chatSession.removeReaction(messageId, emoji);
		} else {
			chatSession.addReaction(messageId, emoji);
		}
	}

	// Check if the current surface is already rendered inline by a message's CanvasBlock
	let surfaceRenderedInline = $derived(
		currentSurface?.runId
			? messages.some((m) => m.role === 'assistant' && m.runId === currentSurface?.runId)
			: false
	);

	// Debug: trace surfaceRenderedInline gating
	$effect(() => {
		console.log(
			'[ChatView] surfaceRenderedInline:',
			surfaceRenderedInline,
			'currentSurface:',
			currentSurface?.surfaceId
		);
	});

	function getRenderedHtml(message: ChatMessage): string {
		// For complete messages, use cache
		if (message.status === 'complete' && renderedCache.has(message.id)) {
			return renderedCache.get(message.id)!;
		}
		// Guard: content may arrive as non-string from gateway history
		const content =
			typeof message.content === 'string' ? message.content : String(message.content ?? '');
		if (!content) return '';
		const html = renderMarkdownSync(content);
		if (message.status === 'complete') {
			renderedCache.set(message.id, html);
		}
		return html;
	}
</script>

<div class="flex h-full">
	<!-- Main chat area -->
	<div class="flex min-h-0 min-w-0 flex-1 flex-col">
		<!-- Header -->
		<ChatHeader onsearchToggle={toggleSearch} />

		{#if showSearch}
			<ChatSearch onjump={handleSearchJump} />
		{/if}

		<!-- Message list -->
		<div
			bind:this={scrollContainer}
			onscroll={handleScroll}
			class="flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 md:px-4"
		>
			{#if messages.length === 0 && !isLoadingHistory}
				<div class="flex h-full flex-col items-center justify-center px-4">
					<!-- Avatar -->
					<div
						class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600"
					>
						<svg class="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
							/>
						</svg>
					</div>
					<h2 class="mb-1 text-lg font-semibold text-white">How can I help you today?</h2>
					{#if connState === 'READY'}
						<p class="mb-6 text-sm text-gray-400">Connected and ready</p>
					{:else}
						<p class="mb-6 text-sm text-gray-500">Send a message to start</p>
					{/if}
					<!-- Quick-action chips -->
					<div class="grid w-full max-w-sm grid-cols-2 gap-2">
						<button
							onclick={() => handleSend('Summarize a document')}
							class="rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-3 text-left text-xs text-gray-300 transition-colors hover:bg-gray-700"
						>
							Summarize a document
						</button>
						<button
							onclick={() => handleSend('Write some code')}
							class="rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-3 text-left text-xs text-gray-300 transition-colors hover:bg-gray-700"
						>
							Write some code
						</button>
						<button
							onclick={() => handleSend('Explain a concept')}
							class="rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-3 text-left text-xs text-gray-300 transition-colors hover:bg-gray-700"
						>
							Explain a concept
						</button>
						<button
							onclick={() => handleSend('Help me brainstorm')}
							class="rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-3 text-left text-xs text-gray-300 transition-colors hover:bg-gray-700"
						>
							Help me brainstorm
						</button>
					</div>
				</div>
			{:else}
				<div class="mx-auto max-w-none md:max-w-3xl space-y-4">
					{#each messages as message, i (message.id ?? `msg-${i}`)}
						{#if message.role === 'divider'}
							<!-- Divider message -->
							<div class="flex items-center gap-3 py-2">
								<div class="h-px flex-1 bg-gray-700"></div>
								<span class="text-xs text-gray-500">{message.content}</span>
								<div class="h-px flex-1 bg-gray-700"></div>
							</div>
						{:else if message.role === 'user'}
							<!-- User message -->
							<div
								class="flex justify-end rounded-lg transition-colors duration-700 {highlightedMessageId ===
								message.id
									? 'bg-blue-500/10'
									: ''}"
								data-message-id={message.id}
							>
								<div class="max-w-[95%] md:max-w-[80%]">
									{#if message.replyToMessageId}
										{@const replyMsg = findMessageById(message.replyToMessageId)}
										{#if replyMsg}
											<div class="mb-1">
												<ReplyPreview
													message={replyMsg}
													onclick={() => scrollToMessage(replyMsg.id)}
												/>
											</div>
										{/if}
									{/if}
									<div class="rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white">
										<p class="whitespace-pre-wrap break-words">{message.content}</p>
									</div>
									<div class="mt-1 flex items-center justify-end gap-2">
										<span class="text-xs text-gray-500">
											{formatMessageTime(message.timestamp)}
										</span>
										{#if message.edited}
											<span class="text-xs italic text-gray-500">(edited)</span>
										{/if}
										{#if message.status === 'sending'}
											<span class="text-xs text-gray-500">Sending...</span>
										{:else if message.status === 'error'}
											<span class="text-xs text-red-400">
												{message.errorMessage ?? 'Failed'}
											</span>
											<button
												onclick={() => handleRetry(message.id)}
												class="text-xs text-blue-400 transition-colors hover:text-blue-300"
											>
												Retry
											</button>
										{/if}
									</div>
								</div>
							</div>
						{:else}
							<!-- Assistant message -->
							<div
								class="flex justify-start rounded-lg transition-colors duration-700 {highlightedMessageId ===
								message.id
									? 'bg-blue-500/10'
									: ''}"
								data-message-id={message.id}
							>
								<div class="max-w-full md:max-w-[85%]">
									<!-- Thinking block -->
									{#if message.thinkingText}
										<ThinkingBlock
											thinkingText={message.thinkingText}
											isStreaming={message.status === 'streaming'}
											startedAt={message.timestamp}
										/>
									{/if}

									<!-- Content -->
									{#if message.content}
										<div
											class="prose prose-invert prose-sm max-w-none rounded-2xl rounded-bl-md bg-gray-800 px-4 py-2.5"
										>
											<!-- eslint-disable-next-line svelte/no-at-html-tags -->
											{@html getRenderedHtml(message)}
										</div>
									{:else if message.status === 'streaming' && !message.thinkingText}
										<!-- Typing indicator -->
										<div class="flex gap-1 rounded-2xl rounded-bl-md bg-gray-800 px-4 py-3">
											<span
												class="h-2 w-2 animate-bounce rounded-full bg-gray-500"
												style="animation-delay: 0ms"
											></span>
											<span
												class="h-2 w-2 animate-bounce rounded-full bg-gray-500"
												style="animation-delay: 150ms"
											></span>
											<span
												class="h-2 w-2 animate-bounce rounded-full bg-gray-500"
												style="animation-delay: 300ms"
											></span>
										</div>
									{/if}

									<!-- Tool calls -->
									{#if message.toolCalls?.length}
										{#each message.toolCalls as toolCall (toolCall.toolCallId)}
											<ToolCallCard {toolCall} />
										{/each}
									{/if}

									<!-- Canvas content (inline A2UI) -->
									{#if message.runId}
										<CanvasBlock runId={message.runId} />
									{/if}

									<!-- Timestamp and actions -->
									<div class="mt-1 flex items-center gap-2">
										<span class="text-xs text-gray-500">
											{formatMessageTime(message.timestamp)}
										</span>
										{#if message.edited}
											<span class="text-xs italic text-gray-500">(edited)</span>
										{/if}
										{#if message.status === 'error'}
											<span class="text-xs text-red-400">
												{message.errorMessage ?? 'Error'}
											</span>
										{/if}
										{#if message.status === 'complete'}
											<div class="relative">
												<button
													onclick={() => toggleReactionPicker(message.id)}
													class="py-1.5 md:py-0 text-xs text-gray-600 transition-colors hover:text-gray-400"
												>
													React
												</button>
												{#if reactionPickerMessageId === message.id}
													<ReactionPicker
														onSelect={(emoji) => handleReactionSelect(message.id, emoji)}
														onClose={() => (reactionPickerMessageId = null)}
													/>
												{/if}
											</div>
											<button
												onclick={() => handleReply(message)}
												class="py-1.5 md:py-0 text-xs text-gray-600 transition-colors hover:text-gray-400"
											>
												Reply
											</button>
										{/if}
									</div>

									<!-- Reactions -->
									{#if message.reactions?.length}
										<ReactionDisplay
											reactions={message.reactions}
											onToggle={(emoji) => handleReactionToggle(message.id, emoji)}
										/>
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Reply preview banner -->
		{#if replyToMessage}
			<div class="border-t border-gray-800 px-4 py-2">
				<ReplyPreview message={replyToMessage} showCancel oncancel={cancelReply} />
			</div>
		{/if}

		<!-- Composer -->
		<MessageComposer
			onSend={handleSend}
			onAbort={handleAbort}
			disabled={isStreaming}
			{isStreaming}
		/>
	</div>

	<!-- Thread panel: full-screen overlay on mobile, side panel on desktop -->
	{#if thread}
		{#if isMobile}
			<div class="fixed inset-0 z-50 flex flex-col bg-gray-950">
				<div class="flex items-center justify-between border-b border-gray-800 px-3 py-2">
					<span class="text-sm font-medium text-white">Thread</span>
					<button
						onclick={() => closeThread()}
						class="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
						aria-label="Close thread"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
				<div class="flex-1 overflow-y-auto">
					<ThreadPanel />
				</div>
			</div>
		{:else}
			<ThreadPanel />
		{/if}
	{/if}
</div>
