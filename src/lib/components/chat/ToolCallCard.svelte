<script lang="ts">
	import type { ToolCall } from '$lib/gateway/types';

	interface Props {
		toolCall: ToolCall;
	}

	let { toolCall }: Props = $props();

	let open = $state(false);

	let statusColor = $derived(
		toolCall.status === 'pending'
			? 'bg-yellow-500/20 text-yellow-400'
			: toolCall.status === 'complete'
				? 'bg-green-500/20 text-green-400'
				: 'bg-red-500/20 text-red-400'
	);

	let statusLabel = $derived(
		toolCall.status === 'pending' ? 'Running' : toolCall.status === 'complete' ? 'Done' : 'Error'
	);

	function formatJson(value: unknown): string {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}
</script>

<details bind:open class="my-1">
	<summary
		class="cursor-pointer select-none text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-2"
	>
		<span class="font-mono">{toolCall.toolName}</span>
		<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium {statusColor}">
			{statusLabel}
		</span>
	</summary>
	<div class="mt-1 ml-4 pl-3 border-l-2 border-slate-600 text-sm space-y-2">
		<div>
			<span class="text-xs font-medium text-slate-400">Arguments</span>
			<pre
				class="mt-0.5 rounded bg-slate-800/50 p-2 text-xs text-slate-300 overflow-x-auto font-mono">{formatJson(
					toolCall.args
				)}</pre>
		</div>
		{#if toolCall.result !== undefined}
			<div>
				<span class="text-xs font-medium text-slate-400">Result</span>
				<pre
					class="mt-0.5 rounded bg-slate-800/50 p-2 text-xs text-slate-300 overflow-x-auto font-mono">{formatJson(
						toolCall.result
					)}</pre>
			</div>
		{/if}
	</div>
</details>
