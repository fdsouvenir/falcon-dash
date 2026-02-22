<script lang="ts">
	import { Clock, Loader2, Check, X, ChevronRight } from 'lucide-svelte';
	import type { ToolCallInfo } from '$lib/stores/chat.js';

	let { toolCall }: { toolCall: ToolCallInfo } = $props();

	let expanded = $state(false);
	let userToggled = $state(false);
	let elapsedSeconds = $state(0);
	let showFullOutput = $state(false);

	const OUTPUT_TRUNCATE_LIMIT = 2000;
	const OUTPUT_PREVIEW_LENGTH = 500;

	// Live timer when running
	$effect(() => {
		if (toolCall.completedAt && toolCall.startedAt) {
			elapsedSeconds = Math.floor((toolCall.completedAt - toolCall.startedAt) / 1000);
			return;
		}
		if (toolCall.status === 'running' && toolCall.startedAt) {
			elapsedSeconds = Math.floor((Date.now() - toolCall.startedAt) / 1000);
			const interval = setInterval(() => {
				elapsedSeconds = Math.floor((Date.now() - (toolCall.startedAt ?? Date.now())) / 1000);
			}, 1000);
			return () => clearInterval(interval);
		}
	});

	// Auto-expand on error
	$effect(() => {
		if (toolCall.status === 'error' && !userToggled) {
			expanded = true;
		}
	});

	function toggle() {
		userToggled = true;
		expanded = !expanded;
	}

	let borderColor = $derived.by(() => {
		switch (toolCall.status) {
			case 'pending':
				return 'border-gray-600';
			case 'running':
				return 'border-blue-600';
			case 'complete':
				return 'border-green-600';
			case 'error':
				return 'border-red-600';
		}
	});

	let bgColor = $derived.by(() => {
		switch (toolCall.status) {
			case 'pending':
				return 'bg-gray-950';
			case 'running':
				return 'bg-blue-950';
			case 'complete':
				return 'bg-green-950';
			case 'error':
				return 'bg-red-950';
		}
	});

	let durationLabel = $derived.by(() => {
		if (toolCall.status === 'pending') return '';
		if (toolCall.status === 'running') return formatDuration(elapsedSeconds);
		if (elapsedSeconds > 0) return formatDuration(elapsedSeconds);
		return '';
	});

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	}

	let outputString = $derived.by(() => {
		if (toolCall.output === undefined || toolCall.output === null) return '';
		if (typeof toolCall.output === 'string') return toolCall.output;
		try {
			return JSON.stringify(toolCall.output, null, 2);
		} catch {
			return String(toolCall.output);
		}
	});

	let isOutputTruncated = $derived(outputString.length > OUTPUT_TRUNCATE_LIMIT);

	let displayedOutput = $derived(
		isOutputTruncated && !showFullOutput
			? outputString.slice(0, OUTPUT_PREVIEW_LENGTH) + '...'
			: outputString
	);

	let shellInfo = $derived(
		(toolCall.args.shell as string) ?? (toolCall.args.runtime as string) ?? null
	);

	function formatJson(value: unknown): string {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}
</script>

<div class="my-2 rounded-lg border-l-4 {borderColor} {bgColor} overflow-hidden">
	<button
		onclick={toggle}
		class="flex w-full items-center gap-2 px-3 py-3 md:py-2 text-left hover:bg-white/5 transition-colors"
		aria-expanded={expanded}
	>
		<!-- Status icon -->
		{#if toolCall.status === 'pending'}
			<Clock class="h-4 w-4 md:h-3.5 md:w-3.5 text-gray-400" />
		{:else if toolCall.status === 'running'}
			<Loader2 class="h-4 w-4 md:h-3.5 md:w-3.5 text-blue-400 animate-spin" />
		{:else if toolCall.status === 'complete'}
			<Check class="h-4 w-4 md:h-3.5 md:w-3.5 text-green-400" />
		{:else}
			<X class="h-4 w-4 md:h-3.5 md:w-3.5 text-red-400" />
		{/if}

		<!-- Tool name -->
		<span class="text-sm font-medium text-gray-200">{toolCall.name}</span>

		<!-- Shell info badge -->
		{#if shellInfo}
			<span class="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400">{shellInfo}</span>
		{/if}

		<!-- Duration -->
		{#if durationLabel}
			<span class="text-xs text-gray-500">{durationLabel}</span>
		{/if}

		<!-- Expand chevron -->
		<span class="ml-auto transition-transform duration-200 {expanded ? 'rotate-90' : ''}">
			<ChevronRight class="h-3.5 w-3.5 text-gray-500" />
		</span>
	</button>

	{#if expanded}
		<div class="border-t border-gray-700 px-4 py-3 space-y-3">
			<!-- Arguments -->
			{#if Object.keys(toolCall.args).length > 0}
				<div>
					<div class="mb-1 text-xs font-semibold uppercase text-gray-500">Arguments</div>
					<pre
						class="max-h-48 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-300 font-mono whitespace-pre-wrap md:whitespace-pre">{formatJson(
							toolCall.args
						)}</pre>
				</div>
			{/if}

			<!-- Error message -->
			{#if toolCall.status === 'error' && toolCall.errorMessage}
				<div class="rounded bg-red-950/50 border border-red-800/50 p-3">
					<div class="mb-1 text-xs font-semibold uppercase text-red-400">Error</div>
					<div class="text-sm text-red-300 whitespace-pre-wrap">{toolCall.errorMessage}</div>
				</div>
			{/if}

			<!-- Output -->
			{#if outputString}
				<div>
					<div class="mb-1 text-xs font-semibold uppercase text-gray-500">Result</div>
					<pre
						class="max-h-48 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-300 font-mono whitespace-pre-wrap md:whitespace-pre">{displayedOutput}</pre>
					{#if isOutputTruncated}
						<button
							onclick={() => (showFullOutput = !showFullOutput)}
							class="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
						>
							{showFullOutput
								? 'Show less'
								: `Show more (${Math.round(outputString.length / 1000)}k chars)`}
						</button>
					{/if}
				</div>
			{:else if toolCall.status === 'running'}
				<div class="text-xs text-gray-500 italic">Running...</div>
			{:else if toolCall.status === 'pending'}
				<div class="text-xs text-gray-500 italic">Pending...</div>
			{/if}
		</div>
	{/if}
</div>
