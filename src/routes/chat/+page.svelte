<script lang="ts">
	import { afterUpdate, onMount, onDestroy } from 'svelte';
	import { ConnectionState } from '$lib/gateway/types';
	import type { ChatMessage } from '$lib/gateway/types';
	import ThinkingBlock from '$lib/components/chat/ThinkingBlock.svelte';
	import ToolCallCard from '$lib/components/chat/ToolCallCard.svelte';
	import MessageComposer from '$lib/components/chat/MessageComposer.svelte';
	import RenderedContent from '$lib/components/chat/RenderedContent.svelte';
	import MessageActionBar from '$lib/components/chat/MessageActionBar.svelte';
	import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
	import ChannelSettings from '$lib/components/chat/ChannelSettings.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { formatRelativeTime, formatFullTimestamp } from '$lib/utils/time';
	import { swipe, longpress } from '$lib/utils/gestures';
	import {
		connectionState,
		activeSessionKey,
		activeSession,
		switchSession,
		loadSessions,
		activeRun,
		getMessages,
		sendMessage,
		loadHistory,
		abortRun,
		updateSession,
		injectMessage,
		insertLocalMessage,
		initChatListeners,
		destroyChatListeners
	} from '$lib/stores';
	import { gateway } from '$lib/gateway';
	import { goto } from '$app/navigation';
	import type { SessionPatchParams } from '$lib/gateway/types';
	import type { CommandContext } from '$lib/chat/commands';

	let currentMessages: ChatMessage[] = [];
	let unsubMessages: (() => void) | null = null;
	let container: HTMLDivElement;
	let isAtBottom = true;
	let now = Date.now();
	let settingsOpen = false;

	// Long-press context menu state
	let contextMenuOpen = false;
	let contextMenuMessage: ChatMessage | null = null;
	let copiedMessageId: string | null = null;
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	function handleSwipeRight() {
		// On mobile, swipe right to go back to session list
		if (window.innerWidth < 768 && $activeSession) {
			goto('/chat');
			switchSession('');
		}
	}

	function handleMessageLongPress(message: ChatMessage) {
		return (x: number, y: number) => {
			contextMenuMessage = message;
			contextMenuOpen = true;
		};
	}

	function closeContextMenu() {
		contextMenuOpen = false;
		contextMenuMessage = null;
	}

	async function copyMessageContent() {
		if (!contextMenuMessage) return;
		try {
			await navigator.clipboard.writeText(contextMenuMessage.content);
			copiedMessageId = contextMenuMessage.id;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => {
				copiedMessageId = null;
			}, 2000);
		} catch {
			// Clipboard API may fail in insecure contexts
		}
		closeContextMenu();
	}

	async function replyToMessage() {
		// Placeholder: could pre-fill composer with quote
		closeContextMenu();
	}

	$: commandContext = $activeSessionKey
		? ({
				sessionKey: $activeSessionKey,
				sendMessage,
				abortRun,
				updateSession: (key: string, patch: Record<string, unknown>) =>
					updateSession(key, patch as Omit<SessionPatchParams, 'sessionKey'>),
				injectMessage: (sessionKey: string, role: string, content: string) =>
					injectMessage(sessionKey, role as 'user' | 'assistant' | 'system' | 'inject', content),
				insertLocalMessage: (sessionKey: string, role: string, content: string) =>
					insertLocalMessage(
						sessionKey,
						role as 'user' | 'assistant' | 'system' | 'inject',
						content
					),
				gateway
			} satisfies CommandContext)
		: undefined;

	/** Subscribe to messages for the active session */
	function subscribeToMessages(sessionKey: string) {
		if (unsubMessages) {
			unsubMessages();
			unsubMessages = null;
		}
		settingsOpen = false;
		if (!sessionKey) {
			currentMessages = [];
			return;
		}
		const store = getMessages(sessionKey);
		unsubMessages = store.subscribe((msgs) => {
			currentMessages = msgs;
		});
	}

	function toggleSettings() {
		settingsOpen = !settingsOpen;
	}

	function closeSettings() {
		settingsOpen = false;
	}

	$: subscribeToMessages($activeSessionKey);

	$: if ($activeSessionKey && $connectionState === ConnectionState.READY) {
		loadHistory($activeSessionKey);
	}

	$: isRunning = !!$activeRun && $activeRun.status === 'running';

	function handleScroll() {
		if (!container) return;
		const threshold = 40;
		isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
	}

	function scrollToBottom() {
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}

	function jumpToBottom() {
		isAtBottom = true;
		scrollToBottom();
	}

	function handleSend(event: CustomEvent<string>) {
		sendMessage(event.detail);
	}

	function handleAbort() {
		abortRun();
	}

	function roleClass(role: string): string {
		if (role === 'user') return 'bg-blue-600/20 ml-12';
		if (role === 'assistant') return 'bg-slate-700/50 mr-12';
		return 'bg-slate-600/30 mx-12 italic';
	}

	function roleLabel(role: string): string {
		if (role === 'user') return 'You';
		if (role === 'assistant') return 'Assistant';
		if (role === 'system') return 'System';
		return 'Inject';
	}

	onMount(() => {
		initChatListeners();
		if ($connectionState === ConnectionState.READY) {
			loadSessions();
		}
		scrollToBottom();
		const interval = setInterval(() => {
			now = Date.now();
		}, 30000);
		return () => clearInterval(interval);
	});

	onDestroy(() => {
		destroyChatListeners();
		if (unsubMessages) {
			unsubMessages();
			unsubMessages = null;
		}
	});

	afterUpdate(() => {
		if (isAtBottom) {
			scrollToBottom();
		}
	});
</script>

{#if $connectionState !== ConnectionState.READY}
	<div class="flex h-full items-center justify-center">
		<div class="text-center">
			<p class="text-lg font-medium text-slate-400">Not connected</p>
			<p class="mt-1 text-sm text-slate-500">Connect to the gateway to start chatting.</p>
		</div>
	</div>
{:else if !$activeSession}
	<div class="flex h-full items-center justify-center">
		<div class="text-center">
			<p class="text-lg font-medium text-slate-400">No session selected</p>
			<p class="mt-1 text-sm text-slate-500">
				Select a session from the sidebar or start a new chat.
			</p>
		</div>
	</div>
{:else}
	<div class="flex h-full flex-col" use:swipe={{ onSwipeRight: handleSwipeRight }}>
		<!-- Session header -->
		<ChatHeader session={$activeSession} on:settings={toggleSettings} />

		<!-- Message list with inline thinking/tools -->
		<div class="relative flex-1 overflow-hidden">
			<div class="h-full overflow-y-auto px-4 py-4" bind:this={container} on:scroll={handleScroll}>
				{#if currentMessages.length === 0}
					<div class="flex h-full items-center justify-center">
						<p class="text-sm text-slate-400">No messages yet. Start a conversation!</p>
					</div>
				{:else}
					<div class="space-y-3" role="log" aria-live="polite" aria-label="Chat messages">
						{#each currentMessages as message (message.id)}
							{#if message.role === 'assistant'}
								<div
									class="group mr-4 md:mr-12"
									use:longpress={{ onLongPress: handleMessageLongPress(message) }}
								>
									<div class="rounded-lg bg-slate-700/50 px-4 py-3">
										<div class="mb-1 flex items-center justify-between">
											<span class="text-xs font-medium text-slate-300">
												{roleLabel(message.role)}
											</span>
											<span
												class="text-xs text-slate-500"
												title={formatFullTimestamp(message.timestamp)}
											>
												{formatRelativeTime(message.timestamp, now)}
											</span>
										</div>

										{#if message.thinking && message.thinking.length > 0}
											{#each message.thinking as block, i (i)}
												<ThinkingBlock thinking={block} />
											{/each}
										{/if}

										{#if message.content}
											<RenderedContent
												content={message.content}
												isStreaming={isRunning &&
													!!message.runId &&
													!!$activeRun &&
													$activeRun.runId === message.runId}
											/>
										{/if}

										{#if message.toolCalls && message.toolCalls.length > 0}
											{#each message.toolCalls as tool, i (i)}
												<ToolCallCard toolCall={tool} />
											{/each}
										{/if}
									</div>
									{#if message.content}
										<div class="mt-1">
											<MessageActionBar content={message.content} />
										</div>
									{/if}
								</div>
							{:else}
								<div
									class="rounded-lg px-4 py-3 {roleClass(message.role)}"
									use:longpress={{ onLongPress: handleMessageLongPress(message) }}
								>
									<div class="mb-1 flex items-center justify-between">
										<span class="text-xs font-medium text-slate-300">
											{roleLabel(message.role)}
										</span>
										<span
											class="text-xs text-slate-500"
											title={formatFullTimestamp(message.timestamp)}
										>
											{formatRelativeTime(message.timestamp, now)}
										</span>
									</div>

									{#if message.thinking && message.thinking.length > 0}
										{#each message.thinking as block, i (i)}
											<ThinkingBlock thinking={block} />
										{/each}
									{/if}

									<div class="whitespace-pre-wrap text-sm text-slate-200">
										{message.content}
									</div>

									{#if message.toolCalls && message.toolCalls.length > 0}
										{#each message.toolCalls as tool, i (i)}
											<ToolCallCard toolCall={tool} />
										{/each}
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			{#if !isAtBottom}
				<button
					class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-600 px-4 py-1.5 text-xs text-slate-200 shadow-lg transition-colors hover:bg-slate-500"
					on:click={jumpToBottom}
					aria-label="Scroll to latest messages"
				>
					Jump to bottom
				</button>
			{/if}

			<!-- Channel settings panel -->
			<ChannelSettings session={$activeSession} open={settingsOpen} on:close={closeSettings} />
		</div>

		<!-- Composer -->
		<MessageComposer {isRunning} {commandContext} on:send={handleSend} on:abort={handleAbort} />
	</div>

	<!-- Long-press context menu (bottom sheet on mobile) -->
	<BottomSheet open={contextMenuOpen} title="Message Actions" on:close={closeContextMenu}>
		<div class="space-y-1">
			<button
				on:click={copyMessageContent}
				class="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-slate-200 transition-colors hover:bg-slate-700"
				style="min-height: 44px;"
			>
				<svg
					class="h-5 w-5 text-slate-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2" />
					<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2" />
				</svg>
				<span>Copy message</span>
			</button>
			<button
				on:click={replyToMessage}
				class="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-slate-200 transition-colors hover:bg-slate-700"
				style="min-height: 44px;"
			>
				<svg
					class="h-5 w-5 text-slate-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
					/>
				</svg>
				<span>Reply</span>
			</button>
		</div>
	</BottomSheet>
{/if}
