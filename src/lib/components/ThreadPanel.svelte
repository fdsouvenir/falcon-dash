<script lang="ts">
	import { activeThread, threadSession, closeThread } from '$lib/stores/threads.js';
	import type { ThreadInfo } from '$lib/stores/threads.js';
	import type { ChatSessionStore } from '$lib/stores/chat.js';
	import type { ChatMessage } from '$lib/stores/chat.js';

	let thread = $state<ThreadInfo | null>(null);
	let session = $state<ChatSessionStore | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let input = $state('');

	$effect(() => {
		const unsub = activeThread.subscribe((v) => {
			thread = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = threadSession.subscribe((v) => {
			session = v;
			if (v) {
				const msgUnsub = v.messages.subscribe((msgs) => {
					messages = msgs;
				});
				return msgUnsub;
			}
		});
		return unsub;
	});

	async function handleSend() {
		if (!input.trim() || !session) return;
		const msg = input.trim();
		input = '';
		await session.send(msg);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}
</script>

{#if thread}
	<div class="flex h-full w-80 flex-col border-l border-gray-800 bg-gray-900">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-800 px-3 py-2">
			<div class="min-w-0 flex-1">
				<div class="text-sm font-medium text-white">{thread.displayName}</div>
				<div class="truncate text-xs text-gray-500">Thread</div>
			</div>
			<button
				onclick={closeThread}
				class="ml-2 rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
				aria-label="Close thread"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<!-- Messages -->
		<div class="flex-1 overflow-y-auto p-3">
			{#each messages as message (message.id)}
				<div class="mb-3">
					<div
						class="text-xs font-medium {message.role === 'user'
							? 'text-blue-400'
							: 'text-green-400'}"
					>
						{message.role === 'user' ? 'You' : 'Assistant'}
					</div>
					<div class="mt-0.5 text-sm text-gray-300">{message.content}</div>
				</div>
			{/each}
			{#if messages.length === 0}
				<div class="py-8 text-center text-xs text-gray-500">No messages in thread yet</div>
			{/if}
		</div>

		<!-- Composer -->
		<div class="border-t border-gray-800 p-2">
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={input}
					onkeydown={handleKeydown}
					placeholder="Reply in thread..."
					class="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
				/>
				<button
					onclick={handleSend}
					disabled={!input.trim()}
					class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
				>
					Send
				</button>
			</div>
		</div>
	</div>
{/if}
