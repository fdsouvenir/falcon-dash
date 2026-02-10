<script lang="ts">
	import { untrack } from 'svelte';
	import { activeSessionKey } from '$lib/stores/sessions.js';
	import { createChatSession, type ChatSessionStore, type ChatMessage } from '$lib/stores/chat.js';
	import { activeThread } from '$lib/stores/threads.js';
	import { connection } from '$lib/stores/gateway.js';
	import { renderMarkdownSync } from '$lib/chat/markdown.js';
	import { formatMessageTime } from '$lib/chat/time-utils.js';
	import ChatHeader from './ChatHeader.svelte';
	import MessageComposer from './MessageComposer.svelte';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import ToolCallCard from './ToolCallCard.svelte';
	import ReplyPreview from './ReplyPreview.svelte';
	import ThreadPanel from './ThreadPanel.svelte';
	import type { ThreadInfo } from '$lib/stores/threads.js';
	import type { ConnectionState } from '$lib/gateway/types.js';

	let sessionKey = $state<string | null>(null);
	let chatSession = $state<ChatSessionStore | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let isStreaming = $state(false);
	let replyToMessage = $state<ChatMessage | null>(null);
	let thread = $state<ThreadInfo | null>(null);
	let connState = $state<ConnectionState>('DISCONNECTED');

	// Plain Map for rendered HTML cache — intentionally non-reactive to avoid effect cycles
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const renderedCache = new Map<string, string>();

	let scrollContainer: HTMLDivElement;
	let shouldAutoScroll = $state(true);

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

		// Load history outside effect to avoid state update cycles
		const ready = untrack(() => connState);
		if (ready === 'READY') {
			queueMicrotask(() => session.loadHistory());
		}
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

	function findMessageById(id: string): ChatMessage | undefined {
		return messages.find((m) => m.id === id);
	}

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
	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Header -->
		<ChatHeader />

		<!-- Message list -->
		<div
			bind:this={scrollContainer}
			onscroll={handleScroll}
			class="flex-1 overflow-y-auto px-4 py-4"
		>
			{#if messages.length === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-gray-500">Send a message to start the conversation</p>
				</div>
			{:else}
				<div class="mx-auto max-w-3xl space-y-4">
					{#each messages as message, i (message.id ?? `msg-${i}`)}
						{#if message.role === 'user'}
							<!-- User message -->
							<div class="flex justify-end">
								<div class="max-w-[80%]">
									{#if message.replyToMessageId}
										{@const replyMsg = findMessageById(message.replyToMessageId)}
										{#if replyMsg}
											<div class="mb-1">
												<ReplyPreview message={replyMsg} />
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
										{#if message.status === 'sending'}
											<span class="text-xs text-gray-500">Sending...</span>
										{:else if message.status === 'error'}
											<span class="text-xs text-red-400">
												{message.errorMessage ?? 'Failed'}
											</span>
										{/if}
									</div>
								</div>
							</div>
						{:else}
							<!-- Assistant message -->
							<div class="flex justify-start">
								<div class="max-w-[85%]">
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

									<!-- Timestamp and actions -->
									<div class="mt-1 flex items-center gap-2">
										<span class="text-xs text-gray-500">
											{formatMessageTime(message.timestamp)}
										</span>
										{#if message.status === 'error'}
											<span class="text-xs text-red-400">
												{message.errorMessage ?? 'Error'}
											</span>
										{/if}
										{#if message.status === 'complete'}
											<button
												onclick={() => handleReply(message)}
												class="text-xs text-gray-600 transition-colors hover:text-gray-400"
											>
												Reply
											</button>
										{/if}
									</div>
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

	<!-- Thread panel (side) -->
	{#if thread}
		<ThreadPanel />
	{/if}
</div>
