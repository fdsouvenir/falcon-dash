<script lang="ts">
	interface ToolCallInfo {
		toolCallId: string;
		name: string;
		args: Record<string, unknown>;
		output?: unknown;
		status: 'running' | 'complete';
	}

	let { toolCall }: { toolCall: ToolCallInfo } = $props();

	let expanded = $state(false);

	function toggle() {
		expanded = !expanded;
	}

	let statusColor = $derived(
		toolCall.status === 'running' ? 'border-blue-600 bg-blue-950' : 'border-green-600 bg-green-950'
	);

	let statusTextColor = $derived(
		toolCall.status === 'running' ? 'text-blue-400' : 'text-green-400'
	);

	function formatJson(value: unknown): string {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}

	// Check for shell info in args
	let shellInfo = $derived(
		(toolCall.args.shell as string) ?? (toolCall.args.runtime as string) ?? null
	);
</script>

<div class="my-2 rounded-lg border-l-4 {statusColor} overflow-hidden">
	<button
		onclick={toggle}
		class="flex w-full items-center gap-2 px-3 py-3 md:py-2 text-left hover:bg-white/5 transition-colors"
		aria-expanded={expanded}
	>
		<!-- Status indicator -->
		{#if toolCall.status === 'running'}
			<span
				class="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin rounded-full border-2 border-blue-800 border-t-blue-400"
			></span>
		{:else}
			<svg
				class="h-4 w-4 md:h-3.5 md:w-3.5 {statusTextColor}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
		{/if}

		<!-- Tool name -->
		<span class="text-sm font-medium text-gray-200">{toolCall.name}</span>

		<!-- Shell info badge -->
		{#if shellInfo}
			<span class="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400">{shellInfo}</span>
		{/if}

		<!-- Expand chevron -->
		<svg
			class="ml-auto h-4 w-4 md:h-3.5 md:w-3.5 text-gray-500 transition-transform {expanded
				? 'rotate-90'
				: ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
		</svg>
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

			<!-- Result -->
			{#if toolCall.output !== undefined}
				<div>
					<div class="mb-1 text-xs font-semibold uppercase text-gray-500">Result</div>
					<pre
						class="max-h-48 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-300 font-mono whitespace-pre-wrap md:whitespace-pre">{formatJson(
							toolCall.output
						)}</pre>
				</div>
			{:else if toolCall.status === 'running'}
				<div class="text-xs text-gray-500 italic">Running...</div>
			{/if}
		</div>
	{/if}
</div>
