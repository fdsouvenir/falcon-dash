<script lang="ts">
	import { Tool, ToolHeader, ToolContent } from '$lib/components/ai-elements/tool/index.js';
	import type { ToolCallInfo } from '$lib/stores/chat.js';

	let { toolCall }: { toolCall: ToolCallInfo } = $props();

	let elapsedSeconds = $state(0);
	let showFullOutput = $state(false);

	const OUTPUT_TRUNCATE_LIMIT = 2000;
	const OUTPUT_PREVIEW_LENGTH = 500;

	// Map OpenClaw status to ai-elements state
	let toolState = $derived.by(() => {
		switch (toolCall.status) {
			case 'pending':
				return 'input-streaming' as const;
			case 'running':
				return 'input-available' as const;
			case 'complete':
				return 'output-available' as const;
			case 'error':
				return 'output-error' as const;
		}
	});

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

	let durationLabel = $derived.by(() => {
		if (toolCall.status === 'pending') return undefined;
		if (toolCall.status === 'running') return formatDuration(elapsedSeconds);
		if (elapsedSeconds > 0) return formatDuration(elapsedSeconds);
		return undefined;
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
		(toolCall.args.shell as string) ?? (toolCall.args.runtime as string) ?? undefined
	);

	function formatJson(value: unknown): string {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}
</script>

<Tool>
	<ToolHeader type={toolCall.name} state={toolState} {durationLabel} {shellInfo} />
	<ToolContent>
		<div class="space-y-3 border-t border-border px-4 py-3">
			<!-- Arguments -->
			{#if Object.keys(toolCall.args).length > 0}
				<div>
					<h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Parameters
					</h4>
					<div class="rounded-md bg-muted/50">
						<pre
							class="max-h-48 overflow-auto p-2 text-xs text-foreground font-mono whitespace-pre-wrap md:whitespace-pre">{formatJson(
								toolCall.args
							)}</pre>
					</div>
				</div>
			{/if}

			<!-- Error message -->
			{#if toolCall.status === 'error' && toolCall.errorMessage}
				<div class="space-y-2">
					<h4 class="text-xs font-semibold uppercase tracking-wide text-destructive">Error</h4>
					<div class="rounded-md bg-destructive/10 p-3">
						<div class="text-sm text-destructive whitespace-pre-wrap">
							{toolCall.errorMessage}
						</div>
					</div>
				</div>
			{/if}

			<!-- Output -->
			{#if outputString}
				<div>
					<h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Result
					</h4>
					<div class="rounded-md bg-muted/50">
						<pre
							class="max-h-48 overflow-auto p-2 text-xs text-foreground font-mono whitespace-pre-wrap md:whitespace-pre">{displayedOutput}</pre>
					</div>
					{#if isOutputTruncated}
						<button
							onclick={() => (showFullOutput = !showFullOutput)}
							class="mt-1 text-xs text-blue-400 transition-colors hover:text-blue-300"
						>
							{showFullOutput
								? 'Show less'
								: `Show more (${Math.round(outputString.length / 1000)}k chars)`}
						</button>
					{/if}
				</div>
			{:else if toolCall.status === 'running'}
				<div class="text-xs text-muted-foreground italic">Running...</div>
			{:else if toolCall.status === 'pending'}
				<div class="text-xs text-muted-foreground italic">Pending...</div>
			{/if}
		</div>
	</ToolContent>
</Tool>
