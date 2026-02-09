<script lang="ts">
	import { afterUpdate, onMount } from 'svelte';
	import type { ChatMessage } from '$lib/gateway/types';
	import { formatRelativeTime, formatFullTimestamp } from '$lib/utils/time';

	export let messages: ChatMessage[] = [];

	let container: HTMLDivElement;
	let isAtBottom = true;
	let now = Date.now();

	/** Track whether user has scrolled away from bottom */
	function handleScroll() {
		if (!container) return;
		const threshold = 40;
		isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
	}

	/** Scroll to the bottom of the message list */
	function scrollToBottom() {
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}

	/** Jump to bottom on button click */
	function jumpToBottom() {
		isAtBottom = true;
		scrollToBottom();
	}

	onMount(() => {
		scrollToBottom();
		// Refresh relative timestamps every 30s
		const interval = setInterval(() => {
			now = Date.now();
		}, 30000);
		return () => clearInterval(interval);
	});

	afterUpdate(() => {
		if (isAtBottom) {
			scrollToBottom();
		}
	});

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
</script>

<div class="relative flex h-full flex-col">
	<div class="flex-1 overflow-y-auto px-4 py-4" bind:this={container} on:scroll={handleScroll}>
		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center">
				<p class="text-sm text-slate-400">No messages yet. Start a conversation!</p>
			</div>
		{:else}
			<div class="space-y-3" role="log" aria-live="polite" aria-label="Chat messages">
				{#each messages as message (message.id)}
					<div
						class="rounded-lg px-4 py-3 {roleClass(message.role)}"
						style="content-visibility: auto; contain-intrinsic-size: auto 60px;"
					>
						<div class="mb-1 flex items-center justify-between">
							<span class="text-xs font-medium text-slate-300">
								{roleLabel(message.role)}
							</span>
							<span class="text-xs text-slate-500" title={formatFullTimestamp(message.timestamp)}>
								{formatRelativeTime(message.timestamp, now)}
							</span>
						</div>
						<div class="whitespace-pre-wrap text-sm text-slate-200">
							{message.content}
						</div>
					</div>
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
</div>
