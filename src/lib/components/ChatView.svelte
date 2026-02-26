<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { page } from '$app/stores';
	import { activeSessionKey, setActiveSession, selectedAgentId } from '$lib/stores/sessions.js';
	import { createChatSession, type ChatSessionStore, type ChatMessage } from '$lib/stores/chat.js';
	import { activeThread, closeThread } from '$lib/stores/threads.js';
	import { connection, eventBus } from '$lib/stores/gateway.js';
	import { formatMessageTime } from '$lib/chat/time-utils.js';
	import { clearSearch } from '$lib/stores/chat-search.js';
	import { watchConnectionForChat } from '$lib/stores/chat-resilience.js';
	import { getAgentIdentity, connectionState } from '$lib/stores/agent-identity.js';
	import { pendingApprovals, resolveApproval, addToDenylist } from '$lib/stores/exec-approvals.js';
	import type { PendingApproval } from '$lib/stores/exec-approvals.js';
	import ChatHeader from './ChatHeader.svelte';
	import ChatSearch from './ChatSearch.svelte';
	import MessageComposer from './MessageComposer.svelte';
	import ReasoningAdapter from './ai/ReasoningAdapter.svelte';
	import ToolAdapter from './ai/ToolAdapter.svelte';
	import ToolGroup from './ai/ToolGroup.svelte';
	import MarkdownRenderer from './MarkdownRenderer.svelte';
	import MessageActions from './MessageActions.svelte';
	import PlanAdapter from './ai/PlanAdapter.svelte';
	import SourcesAdapter from './ai/SourcesAdapter.svelte';
	import SuggestionAdapter from './ai/SuggestionAdapter.svelte';
	import ExecApprovalPrompt from './ExecApprovalPrompt.svelte';
	import CanvasBlock from './canvas/CanvasBlock.svelte';
	import ReplyPreview from './ReplyPreview.svelte';
	import ReactionPicker from './ReactionPicker.svelte';
	import ReactionDisplay from './ReactionDisplay.svelte';
	import PollCard from './PollCard.svelte';
	import PollCreator from './PollCreator.svelte';
	import BubbleEffect from './effects/BubbleEffect.svelte';
	import ScreenEffect from './effects/ScreenEffect.svelte';
	import ThreadPanel from './ThreadPanel.svelte';
	import {
		Conversation,
		ConversationContent,
		ConversationScrollButton
	} from './ai-elements/conversation/index.js';
	import { Loader } from './ai-elements/loader/index.js';
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

	let scrollContainer: HTMLDivElement | null = $state(null);
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

	// Create/destroy chat session when sessionKey changes
	$effect(() => {
		if (!sessionKey) {
			const prev = untrack(() => chatSession);
			if (prev) {
				prev.destroy();
				chatSession = null;
			}
			messages = [];
			return;
		}

		// Destroy previous session
		const prev = untrack(() => chatSession);
		if (prev) {
			prev.destroy();
		}

		const session = createChatSession(sessionKey);
		chatSession = session;

		// Wire resilience watcher for reconnect reconciliation
		const unwatchConnection = watchConnectionForChat(session);

		return () => {
			unwatchConnection();
		};
	});

	// Handle sendWithEffect broadcasts from the gateway plugin.
	// These arrive as falcon.sendEffect events (no session key) and are
	// injected into the active chat session as assistant messages with effect metadata.
	$effect(() => {
		const session = chatSession;
		if (!session) return;
		const unsub = eventBus.on('falcon.sendEffect', (payload) => {
			session.injectMessage(payload as Record<string, unknown>);
		});
		return unsub;
	});

	// Load history when connection becomes READY or session changes
	$effect(() => {
		if (connState !== 'READY') return;
		const session = chatSession; // tracked — triggers on session switch
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
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		highlightedMessageId = messageId;
		setTimeout(() => {
			highlightedMessageId = null;
		}, 2000);
	}

	function handleSend(message: string, attachments?: File[]) {
		if (!chatSession) return;
		chatSession.send(message, attachments);
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

	let agentName = $state('Agent');
	let agentInitial = $derived(agentName.charAt(0).toUpperCase());
	let currentAgentId = $state<string | null>(null);

	$effect(() => {
		const unsub = selectedAgentId.subscribe((id) => {
			currentAgentId = id;
		});
		return unsub;
	});

	$effect(() => {
		const _id = currentAgentId;
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'READY') return;
			getAgentIdentity(_id ?? undefined).then((identity) => {
				agentName = identity.name || 'Agent';
			});
		});
		return unsub;
	});

	// Discord-style message grouping: consecutive messages from same role
	// within 5 minutes are grouped (no repeated avatar/name)
	const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

	function isGrouped(index: number): boolean {
		if (index === 0) return false;
		const curr = messages[index];
		const prev = messages[index - 1];
		if (!curr || !prev) return false;
		if (curr.role === 'divider' || prev.role === 'divider') return false;
		if (curr.role !== prev.role) return false;
		if (Math.abs(curr.timestamp - prev.timestamp) > GROUP_THRESHOLD_MS) return false;
		return true;
	}

	// Exec approvals inline in chat
	let localPendingApprovals = $state<PendingApproval[]>([]);

	$effect(() => {
		const unsub = pendingApprovals.subscribe((v) => {
			localPendingApprovals = v;
		});
		return unsub;
	});

	async function handleApprovalResolve(
		requestId: string,
		decision: 'allow-once' | 'allow-always' | 'deny'
	) {
		try {
			await resolveApproval(requestId, decision);
		} catch (e) {
			console.error('[ChatView] approval resolve error:', e);
		}
	}

	async function handleApprovalAlwaysDeny(requestId: string, command: string) {
		try {
			addToDenylist(command);
			await resolveApproval(requestId, 'deny');
		} catch (e) {
			console.error('[ChatView] approval always-deny error:', e);
		}
	}

	function copyMessageContent(content: string) {
		navigator.clipboard.writeText(content).catch(() => {});
	}

	let reactionPickerMessageId = $state<string | null>(null);
	let showPollCreator = $state(false);
	let activeScreenEffect = $state<{ name: string; messageId: string } | null>(null);
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

	function handlePollCreate(pollInput: {
		question: string;
		options: string[];
		maxSelections?: number;
		duration?: number;
	}) {
		if (!chatSession) return;
		chatSession.sendPoll(pollInput);
		showPollCreator = false;
	}

	function handlePollVote(messageId: string, optionIndices: number[]) {
		if (!chatSession) return;
		chatSession.votePoll(messageId, optionIndices);
	}

	// Watch for new screen effect messages and trigger overlay
	let lastScreenEffectCheck = $state(0);
	$effect(() => {
		const len = messages.length;
		if (len === 0) return;
		// Only check new messages since last check
		for (let i = Math.max(0, lastScreenEffectCheck); i < len; i++) {
			const msg = messages[i];
			if (msg.sendEffect?.type === 'screen' && !msg.sendEffect.played) {
				activeScreenEffect = { name: msg.sendEffect.name, messageId: msg.id };
				// Mark as played
				msg.sendEffect.played = true;
				break;
			}
		}
		lastScreenEffectCheck = len;
	});
</script>

<div class="flex h-full">
	<!-- Main chat area -->
	<div class="flex min-h-0 min-w-0 flex-1 flex-col">
		<!-- Header -->
		<ChatHeader onsearchToggle={toggleSearch} />

		{#if showSearch}
			<ChatSearch onjump={handleSearchJump} />
		{/if}

		<!-- Message list wrapped in Conversation for auto-scroll -->
		<Conversation class="flex-1">
			<ConversationContent
				bind:ref={scrollContainer}
				class="overflow-x-hidden overscroll-y-contain px-3 py-4 md:px-4"
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
							<p class="mb-6 text-sm text-muted-foreground">Connected and ready</p>
						{:else}
							<p class="mb-6 text-sm text-muted-foreground">Send a message to start</p>
						{/if}
						<!-- Quick-action chips -->
						<SuggestionAdapter
							suggestions={[
								'Summarize a document',
								'Write some code',
								'Explain a concept',
								'Help me brainstorm'
							]}
							onselect={handleSend}
						/>
					</div>
				{:else}
					<div class="mx-auto max-w-none space-y-0 md:max-w-3xl">
						{#each messages as message, i (message.id ?? `msg-${i}`)}
							{@const grouped = isGrouped(i)}
							{#if message.role === 'divider'}
								<!-- Divider message -->
								<div class="flex items-center gap-3 py-2">
									<div class="h-px flex-1 bg-border"></div>
									<span class="text-xs text-muted-foreground">{message.content}</span>
									<div class="h-px flex-1 bg-border"></div>
								</div>
							{:else if message.role === 'user'}
								<!-- User message -->
								<div
									class="group/msg flex rounded px-2 ml-12 md:ml-0 md:gap-3 transition-colors duration-700 hover:bg-accent/30 {grouped
										? 'py-0.5'
										: 'mt-3 pb-0.5 pt-1'} {highlightedMessageId === message.id
										? 'bg-blue-500/10'
										: ''}"
									data-message-id={message.id}
								>
									<!-- Avatar or hover timestamp (desktop only) -->
									<div class="hidden w-10 shrink-0 md:block">
										{#if !grouped}
											<div
												class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
											>
												You
											</div>
										{:else}
											<span
												class="hidden text-[10px] text-muted-foreground group-hover/msg:inline"
												title={formatMessageTime(message.timestamp)}
											>
												{new Date(message.timestamp).toLocaleTimeString([], {
													hour: '2-digit',
													minute: '2-digit'
												})}
											</span>
										{/if}
									</div>

									<!-- Message body -->
									<div class="min-w-0 flex-1">
										{#if grouped}
											<span
												class="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/msg:opacity-100 md:hidden"
											>
												{formatMessageTime(message.timestamp)}
											</span>
										{/if}
										{#if !grouped}
											<div class="mb-0.5 flex items-baseline gap-2 justify-end md:justify-start">
												<span class="text-sm font-semibold text-blue-400">You</span>
												<span class="text-[10px] text-muted-foreground">
													{formatMessageTime(message.timestamp)}
												</span>
											</div>
										{/if}
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
										{#if message.sendEffect?.type === 'bubble'}
											<BubbleEffect name={message.sendEffect.name}>
												<div class="text-sm text-foreground text-right md:text-left">
													<MarkdownRenderer
														content={typeof message.content === 'string'
															? message.content
															: String(message.content ?? '')}
													/>
												</div>
											</BubbleEffect>
										{:else}
											<div class="text-sm text-foreground text-right md:text-left">
												<MarkdownRenderer
													content={typeof message.content === 'string'
														? message.content
														: String(message.content ?? '')}
												/>
											</div>
										{/if}
										{#if message.poll}
											<PollCard
												poll={message.poll}
												messageId={message.id}
												onvote={handlePollVote}
											/>
										{/if}
										{#if message.status === 'sending'}
											<span class="text-xs text-muted-foreground">Sending...</span>
										{:else if message.status === 'error'}
											<span class="text-xs text-destructive">
												{message.errorMessage ?? 'Failed'}
											</span>
											<button
												onclick={() => handleRetry(message.id)}
												class="text-xs text-blue-400 transition-colors hover:text-blue-300"
											>
												Retry
											</button>
										{/if}

										<!-- User message actions -->
										{#if message.status === 'complete' || message.status === 'sent'}
											<div class="mt-1">
												<MessageActions
													onreply={() => handleReply(message)}
													onthread={() => handleReply(message)}
													oncopy={() => copyMessageContent(message.content)}
													onreact={() => toggleReactionPicker(message.id)}
												/>
												{#if reactionPickerMessageId === message.id}
													<div class="relative">
														<ReactionPicker
															onSelect={(emoji) => handleReactionSelect(message.id, emoji)}
															onClose={() => (reactionPickerMessageId = null)}
														/>
													</div>
												{/if}
											</div>
										{/if}

										<!-- Reactions -->
										{#if message.reactions?.length}
											<ReactionDisplay
												reactions={message.reactions}
												onToggle={(emoji) => handleReactionToggle(message.id, emoji)}
											/>
										{/if}
									</div>
								</div>
							{:else}
								<!-- Assistant message -->
								<div
									class="group/msg flex rounded px-2 md:gap-3 transition-colors duration-700 hover:bg-accent/30 {grouped
										? 'py-0.5'
										: 'mt-3 pb-0.5 pt-1'} {highlightedMessageId === message.id
										? 'bg-blue-500/10'
										: ''}"
									data-message-id={message.id}
								>
									<!-- Avatar or hover timestamp (desktop only) -->
									<div class="hidden w-10 shrink-0 md:block">
										{#if !grouped}
											<div
												class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white"
											>
												{agentInitial}
											</div>
										{:else}
											<span
												class="hidden text-[10px] text-muted-foreground group-hover/msg:inline"
												title={formatMessageTime(message.timestamp)}
											>
												{new Date(message.timestamp).toLocaleTimeString([], {
													hour: '2-digit',
													minute: '2-digit'
												})}
											</span>
										{/if}
									</div>

									<!-- Message body -->
									<div class="min-w-0 flex-1">
										{#if !grouped}
											<div class="mb-0.5 flex items-baseline gap-2">
												<span class="text-sm font-semibold text-purple-400">{agentName}</span>
												<span class="text-[10px] text-muted-foreground">
													{formatMessageTime(message.timestamp)}
												</span>
											</div>
										{:else}
											<span
												class="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/msg:opacity-100 md:hidden"
											>
												{formatMessageTime(message.timestamp)}
											</span>
										{/if}

										<!-- Thinking block -->
										{#if message.thinkingText}
											<ReasoningAdapter
												thinkingText={message.thinkingText}
												isStreaming={message.status === 'streaming'}
												startedAt={message.thinkingStartedAt ?? message.timestamp}
												completedAt={message.thinkingCompletedAt}
											/>
										{/if}

										<!-- Content -->
										{#if message.content}
											{#if message.sendEffect?.type === 'bubble'}
												<BubbleEffect name={message.sendEffect.name}>
													<MarkdownRenderer
														content={typeof message.content === 'string'
															? message.content
															: String(message.content ?? '')}
														isStreaming={message.status === 'streaming'}
													/>
												</BubbleEffect>
											{:else}
												<MarkdownRenderer
													content={typeof message.content === 'string'
														? message.content
														: String(message.content ?? '')}
													isStreaming={message.status === 'streaming'}
												/>
											{/if}
										{:else if message.status === 'streaming' && !message.thinkingText}
											<Loader class="text-muted-foreground" size={16} />
										{/if}

										<!-- Poll card -->
										{#if message.poll}
											<PollCard
												poll={message.poll}
												messageId={message.id}
												onvote={handlePollVote}
											/>
										{/if}

										<!-- Plan block -->
										{#if message.plan?.length}
											<PlanAdapter
												steps={message.plan}
												isStreaming={message.status === 'streaming'}
											/>
										{/if}

										<!-- Tool calls -->
										{#if message.toolCalls?.length}
											{#if message.toolCalls.length === 1}
												<ToolAdapter toolCall={message.toolCalls[0]} />
											{:else}
												<ToolGroup toolCalls={message.toolCalls} />
											{/if}
										{/if}

										<!-- Canvas content (inline A2UI) -->
										{#if message.runId}
											<CanvasBlock runId={message.runId} />
										{/if}

										<!-- Sources block -->
										{#if message.sources?.length}
											<SourcesAdapter sources={message.sources} />
										{/if}

										<!-- Error display -->
										{#if message.status === 'error'}
											<span class="text-xs text-destructive">
												{message.errorMessage ?? 'Error'}
											</span>
										{/if}

										<!-- Actions (visible on hover) -->
										{#if message.status === 'complete'}
											<div class="mt-1">
												<MessageActions
													onreply={() => handleReply(message)}
													onthread={() => handleReply(message)}
													oncopy={() => copyMessageContent(message.content)}
													onreact={() => toggleReactionPicker(message.id)}
												/>
												{#if reactionPickerMessageId === message.id}
													<div class="relative">
														<ReactionPicker
															onSelect={(emoji) => handleReactionSelect(message.id, emoji)}
															onClose={() => (reactionPickerMessageId = null)}
														/>
													</div>
												{/if}
											</div>
										{/if}

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

						<!-- Inline exec approval prompts -->
						{#if localPendingApprovals.length > 0}
							<div class="mt-3 space-y-2">
								{#each localPendingApprovals as approval (approval.requestId)}
									<ExecApprovalPrompt
										{approval}
										pendingCount={localPendingApprovals.length}
										onResolve={handleApprovalResolve}
										onAlwaysDeny={handleApprovalAlwaysDeny}
									/>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</ConversationContent>

			<!-- Scroll-to-bottom button -->
			<ConversationScrollButton />
		</Conversation>

		<!-- Reply preview banner -->
		{#if replyToMessage}
			<div class="border-t border-border px-4 py-2">
				<ReplyPreview message={replyToMessage} showCancel oncancel={cancelReply} />
			</div>
		{/if}

		<!-- Composer -->
		<MessageComposer
			onSend={handleSend}
			onAbort={handleAbort}
			onPoll={() => (showPollCreator = true)}
			disabled={isStreaming}
			{isStreaming}
		/>
	</div>

	<!-- Poll creator modal -->
	{#if showPollCreator}
		<PollCreator oncreate={handlePollCreate} oncancel={() => (showPollCreator = false)} />
	{/if}

	<!-- Screen effect overlay -->
	{#if activeScreenEffect}
		<ScreenEffect name={activeScreenEffect.name} ondone={() => (activeScreenEffect = null)} />
	{/if}

	<!-- Thread panel: full-screen overlay on mobile, side panel on desktop -->
	{#if thread}
		{#if isMobile}
			<div class="fixed inset-0 z-50 flex flex-col bg-background">
				<div class="flex items-center justify-between border-b border-border px-3 py-2">
					<span class="text-sm font-medium text-foreground">Thread</span>
					<button
						onclick={() => closeThread()}
						class="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
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
