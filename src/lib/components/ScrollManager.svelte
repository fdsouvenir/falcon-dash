<script lang="ts">
	let {
		onloadmore,
		newMessageCount = 0,
		children,
		onscrollmanager
	}: {
		onloadmore: () => void;
		newMessageCount?: number;
		children: import('svelte').Snippet;
		onscrollmanager?: (api: {
			scrollToMessage: (id: string) => void;
			jumpToBottom: () => void;
		}) => void;
	} = $props();

	let container: HTMLDivElement | undefined = $state();
	let showJumpToBottom = $state(false);
	let isNearBottom = $state(true);

	function handleScroll() {
		if (!container) return;
		const { scrollTop, scrollHeight, clientHeight } = container;
		// Near bottom: within 100px of bottom
		isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
		showJumpToBottom = !isNearBottom;

		// Near top: trigger load more
		if (scrollTop < 50) {
			onloadmore();
		}
	}

	function jumpToBottom() {
		if (!container) return;
		container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
	}

	/** Scroll to a specific message element by ID */
	function scrollToMessage(messageId: string): void {
		if (!container) return;
		const el = container.querySelector(`[data-message-id="${messageId}"]`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			el.classList.add('highlight-message');
			setTimeout(() => el.classList.remove('highlight-message'), 2000);
		}
	}

	$effect(() => {
		if (container && onscrollmanager) {
			onscrollmanager({ scrollToMessage, jumpToBottom });
		}
	});
</script>

<div class="relative flex-1 overflow-hidden">
	<div bind:this={container} onscroll={handleScroll} class="h-full overflow-y-auto">
		{@render children()}
	</div>

	{#if showJumpToBottom}
		<div class="absolute bottom-4 left-1/2 -translate-x-1/2">
			<button
				onclick={jumpToBottom}
				class="flex items-center gap-1.5 rounded-full bg-gray-700 px-3 py-1.5 text-xs text-white shadow-lg transition-colors hover:bg-gray-600"
			>
				{#if newMessageCount > 0}
					<span
						class="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-xs"
					>
						{newMessageCount}
					</span>
				{/if}
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 14l-7 7m0 0l-7-7m7 7V3"
					/>
				</svg>
				Jump to bottom
			</button>
		</div>
	{/if}
</div>

<style>
	:global(.highlight-message) {
		animation: highlight-fade 2s ease-out;
	}
	@keyframes highlight-fade {
		0% {
			background-color: rgb(59 130 246 / 0.2);
		}
		100% {
			background-color: transparent;
		}
	}
</style>
