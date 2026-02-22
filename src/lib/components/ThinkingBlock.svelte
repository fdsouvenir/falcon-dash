<script lang="ts">
	import { Brain, ChevronRight } from 'lucide-svelte';
	import MarkdownRenderer from './MarkdownRenderer.svelte';

	let {
		thinkingText = '',
		isStreaming = false,
		startedAt = 0,
		completedAt
	}: {
		thinkingText: string;
		isStreaming: boolean;
		startedAt: number;
		completedAt?: number;
	} = $props();

	let expanded = $state(false);
	let elapsedSeconds = $state(0);
	let userToggled = $state(false);

	// Auto-open when thinking text arrives while streaming
	$effect(() => {
		if (isStreaming && thinkingText && !userToggled) {
			expanded = true;
		}
	});

	// Auto-collapse ~1s after streaming ends
	$effect(() => {
		if (!isStreaming && completedAt && !userToggled) {
			const timer = setTimeout(() => {
				expanded = false;
			}, 1000);
			return () => clearTimeout(timer);
		}
	});

	// Track elapsed time
	$effect(() => {
		if (completedAt && startedAt) {
			elapsedSeconds = Math.floor((completedAt - startedAt) / 1000);
			return;
		}
		if (isStreaming && startedAt > 0) {
			elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
			const interval = setInterval(() => {
				elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
			}, 1000);
			return () => clearInterval(interval);
		}
	});

	let label = $derived(
		isStreaming
			? `Thinking... ${formatDuration(elapsedSeconds)}`
			: `Thought for ${formatDuration(elapsedSeconds)}`
	);

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	}

	function toggle() {
		userToggled = true;
		expanded = !expanded;
	}
</script>

{#if thinkingText}
	<div class="mb-2 rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
		<button
			onclick={toggle}
			class="flex w-full items-center gap-2 px-3 py-3 md:py-2 text-left text-sm text-gray-400 transition-colors hover:text-gray-200"
			aria-expanded={expanded}
		>
			<span class="transition-transform duration-200 {expanded ? 'rotate-90' : ''}">
				<ChevronRight class="h-3.5 w-3.5" />
			</span>
			<span class={isStreaming ? 'thinking-pulse' : ''}>
				<Brain class="h-4 w-4 md:h-3.5 md:w-3.5" />
			</span>
			<span class="text-xs font-medium">{label}</span>
		</button>

		<div class="thinking-content border-t border-gray-700" class:thinking-expanded={expanded}>
			<div class="px-4 py-3">
				<div
					class="max-h-64 overflow-y-auto text-xs leading-relaxed text-gray-400 thinking-markdown"
				>
					<MarkdownRenderer content={thinkingText} {isStreaming} />
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.thinking-content {
		max-height: 0;
		overflow: hidden;
		opacity: 0;
		transition:
			max-height 300ms ease,
			opacity 200ms ease;
	}

	.thinking-content.thinking-expanded {
		max-height: 20rem;
		opacity: 1;
	}

	@keyframes thinking-glow {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}

	.thinking-pulse {
		animation: thinking-glow 2s ease-in-out infinite;
	}

	.thinking-markdown :global(p) {
		margin-bottom: 0.25rem;
	}

	.thinking-markdown :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
