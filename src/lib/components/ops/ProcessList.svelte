<script lang="ts">
	import type { OpsEntry } from '$lib/stores/ops.js';
	import { loadEntries, currentSessionId, isLoading } from '$lib/stores/ops.js';

	let {
		entries = [],
		selectedId = null,
		onselect
	}: {
		entries: OpsEntry[];
		selectedId: string | null;
		onselect: (id: string) => void;
	} = $props();

	const PAGE_SIZE = 50;
	let displayLimit = $state(PAGE_SIZE);

	// Only show exec entries
	const execEntries = $derived(entries.filter((e) => e.toolName === 'exec'));
	const visible = $derived(execEntries.slice(0, displayLimit));
	const hasMore = $derived(execEntries.length > displayLimit);

	function loadMore() {
		displayLimit += PAGE_SIZE;
		const sid = $currentSessionId;
		if (sid) loadEntries(sid, 'exec', displayLimit);
	}

	function formatDuration(ms?: number): string {
		if (ms === undefined) return '—';
		if (ms < 1000) return `${ms}ms`;
		const s = ms / 1000;
		if (s < 60) return `${s.toFixed(1)}s`;
		const m = Math.floor(s / 60);
		return `${m}m ${Math.round(s % 60)}s`;
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

	function truncate(str: string, n: number): string {
		return str.length > n ? str.slice(0, n) + '…' : str;
	}

	function getCommand(entry: OpsEntry): string {
		const cmd = entry.arguments?.command;
		if (typeof cmd === 'string') return cmd;
		return JSON.stringify(entry.arguments).slice(0, 60);
	}

	function getCwd(entry: OpsEntry): string {
		return entry.result?.cwd ?? (entry.arguments?.workdir as string | undefined) ?? '';
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-surface-1">
	<!-- Section header -->
	<div class="border-b border-surface-border px-[var(--space-card-padding)] py-2.5">
		<h2 class="text-[length:var(--text-section-header)] font-bold uppercase tracking-wider text-status-muted">
			Processes
		</h2>
	</div>

	{#if $isLoading && execEntries.length === 0}
		<div class="flex flex-1 items-center justify-center text-[length:var(--text-body)] text-status-muted">
			Loading…
		</div>
	{:else if execEntries.length === 0}
		<div class="flex flex-1 items-center justify-center text-[length:var(--text-body)] text-status-muted/60">
			No processes found
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto">
			{#each visible as entry (entry.id)}
				{@const cmd = getCommand(entry)}
				{@const cwd = getCwd(entry)}
				<button
					onclick={() => onselect(entry.id)}
					class="w-full border-b border-surface-border/40 px-[var(--space-card-padding)] py-2.5 text-left transition-colors hover:bg-surface-3/40 {selectedId === entry.id
						? 'bg-surface-3 border-l-2 border-l-status-info'
						: ''}"
				>
					<!-- Command -->
					<p class="truncate font-mono text-[length:var(--text-mono)] text-white/90">
						{truncate(cmd, 60)}
					</p>

					<!-- cwd + meta row -->
					<div class="mt-1 flex items-center gap-3">
						{#if cwd}
							<span class="min-w-0 flex-1 truncate font-mono text-[length:var(--text-label)] text-status-muted/70">
								{cwd}
							</span>
						{/if}

						<!-- Duration -->
						<span class="shrink-0 text-[length:var(--text-label)] text-status-muted">
							{formatDuration(entry.result?.durationMs)}
						</span>

						<!-- Exit code badge -->
						{#if entry.status === 'running'}
							<span
								class="shrink-0 animate-pulse rounded-full bg-status-warning-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold text-status-warning"
							>
								running
							</span>
						{:else if entry.result?.exitCode === 0 || entry.result?.exitCode === undefined}
							<span
								class="shrink-0 rounded-full bg-status-active-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold text-status-active"
							>
								0
							</span>
						{:else}
							<span
								class="shrink-0 rounded-full bg-status-danger-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold text-status-danger"
							>
								{entry.result.exitCode}
							</span>
						{/if}

						<!-- Timestamp -->
						<span class="shrink-0 text-[length:var(--text-label)] text-status-muted/60">
							{formatRelTime(entry.timestamp)}
						</span>
					</div>
				</button>
			{/each}

			{#if hasMore}
				<div class="p-3 text-center">
					<button
						onclick={loadMore}
						class="rounded border border-surface-border bg-surface-2 px-4 py-1.5 text-[length:var(--text-body)] text-status-muted transition-colors hover:bg-surface-3 hover:text-white"
					>
						Load More
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
