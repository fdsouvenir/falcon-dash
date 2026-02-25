<script lang="ts">
	import ToolAdapter from './ToolAdapter.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';
	import { SvelteMap } from 'svelte/reactivity';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import type { ToolCallInfo } from '$lib/stores/chat.js';

	let { toolCalls }: { toolCalls: ToolCallInfo[] } = $props();

	let expanded = $state(false);

	// Auto-expand while tools are still running
	let allDone = $derived(toolCalls.every((t) => t.status === 'complete' || t.status === 'error'));
	let hasError = $derived(toolCalls.some((t) => t.status === 'error'));
	let hasRunning = $derived(
		toolCalls.some((t) => t.status === 'running' || t.status === 'pending')
	);
	let completedCount = $derived(
		toolCalls.filter((t) => t.status === 'complete' || t.status === 'error').length
	);

	// Aggregate duration
	let totalDuration = $derived.by(() => {
		let total = 0;
		for (const t of toolCalls) {
			if (t.completedAt && t.startedAt) {
				total += t.completedAt - t.startedAt;
			}
		}
		return total;
	});

	let durationLabel = $derived.by(() => {
		if (!allDone || totalDuration === 0) return '';
		const seconds = Math.floor(totalDuration / 1000);
		if (seconds < 60) return `${seconds}s`;
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	});

	// Group status
	let groupState = $derived.by(() => {
		if (hasError) return 'error' as const;
		if (hasRunning) return 'running' as const;
		return 'complete' as const;
	});

	let statusConfig = $derived.by(() => {
		const configs = {
			running: {
				Icon: ClockIcon,
				label: `${completedCount} of ${toolCalls.length} completed`,
				iconClass: 'animate-pulse'
			},
			complete: {
				Icon: CheckCircleIcon,
				label: `${toolCalls.length} completed`,
				iconClass: 'text-green-600'
			},
			error: {
				Icon: XCircleIcon,
				label: `${toolCalls.length} calls (errors)`,
				iconClass: 'text-red-600'
			}
		} as const;
		return configs[groupState];
	});

	// Compact pill data — deduplicate tool names with counts
	let toolPills = $derived.by(() => {
		const counts = new SvelteMap<string, { total: number; done: number; error: number }>();
		for (const t of toolCalls) {
			const entry = counts.get(t.name) ?? { total: 0, done: 0, error: 0 };
			entry.total++;
			if (t.status === 'complete') entry.done++;
			if (t.status === 'error') entry.error++;
			counts.set(t.name, entry);
		}
		return [...counts.entries()].map(([name, c]) => ({
			name,
			count: c.total,
			allDone: c.done === c.total,
			hasError: c.error > 0
		}));
	});

	function toggle() {
		expanded = !expanded;
	}
</script>

<div class="not-prose mb-4 w-full rounded-md border">
	<!-- Group header -->
	<button class="flex w-full items-center justify-between gap-4 p-3" onclick={toggle}>
		<div class="flex items-center gap-2">
			<WrenchIcon class="text-muted-foreground size-4" />
			<span class="text-sm font-medium">Tools</span>
			<Badge class="gap-1.5 rounded-full text-xs" variant="secondary">
				{#if groupState === 'running'}
					<ClockIcon class="size-4 animate-pulse" />
				{:else if groupState === 'error'}
					<XCircleIcon class="size-4 text-red-600" />
				{:else}
					<CheckCircleIcon class="size-4 text-green-600" />
				{/if}
				{statusConfig.label}
			</Badge>
			{#if durationLabel}
				<span class="text-xs text-muted-foreground">{durationLabel}</span>
			{/if}
		</div>
		<ChevronDownIcon
			class={cn('text-muted-foreground size-4 transition-transform', expanded && 'rotate-180')}
		/>
	</button>

	<!-- Compact pills row (visible when collapsed) -->
	{#if !expanded}
		<div class="flex flex-wrap gap-1.5 px-3 pb-3">
			{#each toolPills as pill (pill.name)}
				<span
					class={cn(
						'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
						'bg-muted text-muted-foreground'
					)}
				>
					<span
						class={cn(
							'size-1.5 rounded-full',
							pill.hasError
								? 'bg-red-500'
								: pill.allDone
									? 'bg-green-500'
									: 'bg-yellow-500 animate-pulse'
						)}
					></span>
					{pill.name}{#if pill.count > 1}<span class="opacity-60">×{pill.count}</span>{/if}
				</span>
			{/each}
		</div>
	{/if}

	<!-- Expanded: individual tool cards -->
	{#if expanded}
		<div class="border-t border-border px-3 pb-3 pt-3 space-y-0">
			{#each toolCalls as toolCall (toolCall.toolCallId)}
				<ToolAdapter {toolCall} />
			{/each}
		</div>
	{/if}
</div>
