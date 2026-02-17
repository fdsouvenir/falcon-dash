<script lang="ts">
	let {
		thinkingText = '',
		isStreaming = false,
		startedAt = 0
	}: {
		thinkingText: string;
		isStreaming: boolean;
		startedAt: number;
	} = $props();

	let expanded = $state(false);
	let elapsedSeconds = $state(0);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// Track elapsed time while streaming
	$effect(() => {
		if (isStreaming && startedAt > 0) {
			intervalId = setInterval(() => {
				elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
			}, 1000);
			return () => {
				if (intervalId) clearInterval(intervalId);
			};
		} else if (!isStreaming && startedAt > 0) {
			// Final elapsed time
			elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
			}
		}
	});

	let label = $derived(
		isStreaming ? 'Thinking...' : `Thought for ${formatDuration(elapsedSeconds)}`
	);

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	}

	function toggle() {
		expanded = !expanded;
	}
</script>

{#if thinkingText}
	<div class="mb-2 rounded-lg border border-gray-700 bg-gray-900">
		<button
			onclick={toggle}
			class="flex w-full items-center gap-2 px-3 py-3 md:py-2 text-left text-sm text-gray-400 transition-colors hover:text-gray-200"
			aria-expanded={expanded}
		>
			<!-- Chevron -->
			<svg
				class="h-4 w-4 md:h-3.5 md:w-3.5 transition-transform {expanded ? 'rotate-90' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
			<!-- Spinner while streaming -->
			{#if isStreaming}
				<span
					class="h-3.5 w-3.5 md:h-3 md:w-3 animate-spin rounded-full border-2 border-gray-500 border-t-blue-400"
				></span>
			{/if}
			<span class="text-xs font-medium">{label}</span>
		</button>

		{#if expanded}
			<div class="border-t border-gray-700 px-4 py-3">
				<div
					class="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-400"
				>
					{thinkingText}
				</div>
			</div>
		{/if}
	</div>
{/if}
