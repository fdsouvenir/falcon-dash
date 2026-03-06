<script lang="ts">
	import type { OpsEntry } from '$lib/stores/ops.js';
	import { getToolColor } from '$lib/components/ui/design-tokens.js';
	import { STATUS_COLORS } from '$lib/components/ui/design-tokens.js';

	let { entries = [] }: { entries: OpsEntry[] } = $props();

	// Exclude exec from the activity feed (shown in Processes tab)
	const feedEntries = $derived(entries.filter((e) => e.toolName !== 'exec'));

	let expandedIds = $state<Set<string>>(new Set());

	function toggleExpand(id: string) {
		expandedIds = new Set(
			expandedIds.has(id) ? [...expandedIds].filter((x) => x !== id) : [...expandedIds, id]
		);
	}

	function formatDuration(ms?: number): string {
		if (ms === undefined) return '';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	function formatRelTime(ts: number): string {
		const diff = Date.now() - ts;
		const mins = Math.floor(diff / 60_000);
		const hrs = Math.floor(mins / 60);
		if (hrs > 0) return `${hrs}h ago`;
		if (mins > 0) return `${mins}m ago`;
		const secs = Math.floor(diff / 1000);
		if (secs > 0) return `${secs}s ago`;
		return 'now';
	}

	function getArgSummary(entry: OpsEntry): string {
		const args = entry.arguments;
		// Pick the most useful argument based on tool name
		const candidates: (string | undefined)[] = [
			args?.path as string | undefined,
			args?.file_path as string | undefined,
			args?.query as string | undefined,
			args?.url as string | undefined,
			args?.command as string | undefined,
			args?.message as string | undefined,
			args?.content as string | undefined
		];
		const val = candidates.find((v) => typeof v === 'string');
		if (val) return val.slice(0, 80);
		// Fallback: first string value in args
		const first = Object.values(args ?? {}).find((v) => typeof v === 'string');
		if (typeof first === 'string') return first.slice(0, 80);
		return JSON.stringify(args).slice(0, 80);
	}

	function getResultPreview(entry: OpsEntry): string {
		return (entry.result?.text ?? '').slice(0, 100);
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-surface-1">
	<!-- Section header -->
	<div class="border-b border-surface-border px-[var(--space-card-padding)] py-2.5">
		<h2 class="text-[length:var(--text-section-header)] font-bold uppercase tracking-wider text-status-muted">
			Activity Feed
		</h2>
	</div>

	{#if feedEntries.length === 0}
		<div class="flex flex-1 items-center justify-center text-[length:var(--text-body)] text-status-muted/60">
			No activity yet
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto">
			{#each feedEntries as entry (entry.id)}
				{@const colorKey = getToolColor(entry.toolName)}
				{@const color = STATUS_COLORS[colorKey]}
				{@const expanded = expandedIds.has(entry.id)}
				{@const argSummary = getArgSummary(entry)}
				{@const resultPreview = getResultPreview(entry)}

				<div
					class="border-b border-surface-border/40 transition-colors hover:bg-surface-3/30"
				>
					<!-- Collapsed row -->
					<button
						onclick={() => toggleExpand(entry.id)}
						class="flex w-full items-start gap-3 px-[var(--space-card-padding)] py-2.5 text-left"
					>
						<!-- Tool name pill -->
						<span
							class="mt-0.5 shrink-0 rounded-full px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold {color.bg} {color.text}"
						>
							{entry.toolName}
						</span>

						<!-- Argument summary -->
						<p class="min-w-0 flex-1 truncate text-[length:var(--text-body)] text-white/80">
							{argSummary}
						</p>

						<!-- Meta -->
						<div class="flex shrink-0 items-center gap-2">
							{#if entry.result?.durationMs !== undefined}
								<span class="text-[length:var(--text-label)] text-status-muted">
									{formatDuration(entry.result.durationMs)}
								</span>
							{/if}
							<span class="text-[length:var(--text-label)] text-status-muted/60">
								{formatRelTime(entry.timestamp)}
							</span>
							<!-- Expand chevron -->
							<svg
								class="h-3.5 w-3.5 text-status-muted transition-transform {expanded ? 'rotate-180' : ''}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
							</svg>
						</div>
					</button>

					<!-- Expanded result -->
					{#if expanded}
						<div class="border-t border-surface-border/30 bg-surface-0/60 px-[var(--space-card-padding)] py-3">
							{#if entry.result?.text}
								<pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[length:var(--text-mono)] leading-relaxed text-green-400/90">{entry.result.text}</pre>
							{:else}
								<p class="text-[length:var(--text-label)] text-status-muted/50">(no output)</p>
							{/if}
						</div>
					{:else if resultPreview}
						<p class="px-[var(--space-card-padding)] pb-2 font-mono text-[length:var(--text-label)] text-status-muted/70 truncate">
							{resultPreview}
						</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
