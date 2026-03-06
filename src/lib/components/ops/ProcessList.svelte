<script lang="ts">
	import type { OpsEntry } from '$lib/stores/ops.js';
	import { shortSessionId } from '$lib/stores/ops.js';

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

	const execEntries = $derived(entries.filter((e) => e.toolName === 'exec'));
	const visible = $derived(execEntries.slice(0, displayLimit));
	const hasMore = $derived(execEntries.length > displayLimit);

	function loadMore() {
		displayLimit += PAGE_SIZE;
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
		return JSON.stringify(entry.arguments).slice(0, 80);
	}

	function getCwd(entry: OpsEntry): string {
		return entry.result?.cwd ?? (entry.arguments?.workdir as string | undefined) ?? '';
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-surface-1">
	<div class="border-b border-surface-border px-[var(--space-card-padding)] py-2.5">
		<h2
			class="text-[length:var(--text-section-header)] font-bold uppercase tracking-wider text-status-muted"
		>
			Processes
			<span class="ml-1 font-normal text-status-muted/50">({execEntries.length})</span>
		</h2>
	</div>

	{#if execEntries.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-2 text-status-muted/60">
			<svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
				/>
			</svg>
			<p class="text-[length:var(--text-body)]">No processes found</p>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto">
			{#each visible as entry (entry.id)}
				{@const cmd = getCommand(entry)}
				{@const cwd = getCwd(entry)}
				<button
					onclick={() => onselect(entry.id)}
					class="w-full border-b border-surface-border/40 px-[var(--space-card-padding)] py-2.5 text-left transition-colors hover:bg-surface-3/40 {selectedId ===
					entry.id
						? 'bg-surface-3 border-l-2 border-l-status-info'
						: ''}"
				>
					<!-- Command -->
					<p class="truncate font-mono text-[length:var(--text-body)] text-white/90">
						{truncate(cmd, 80)}
					</p>

					<!-- Meta row: session · cwd · duration · exit code · time -->
					<div class="mt-1 flex items-center gap-2.5 text-[length:var(--text-badge)]">
						<!-- Session tag -->
						<span
							class="shrink-0 rounded bg-status-purple-bg px-1.5 py-0.5 font-mono text-status-purple"
						>
							{shortSessionId(entry.sessionId)}
						</span>

						{#if cwd}
							<span class="min-w-0 flex-1 truncate font-mono text-status-muted/70">
								{cwd}
							</span>
						{:else}
							<span class="flex-1"></span>
						{/if}

						<span class="shrink-0 text-status-muted">
							{formatDuration(entry.result?.durationMs)}
						</span>

						{#if entry.status === 'running'}
							<span
								class="shrink-0 animate-pulse rounded-full bg-status-warning-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] font-semibold text-status-warning"
							>
								running
							</span>
						{:else if entry.result?.exitCode === 0 || entry.result?.exitCode === undefined}
							<span
								class="shrink-0 rounded-full bg-status-active-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] font-semibold text-status-active"
							>
								0
							</span>
						{:else}
							<span
								class="shrink-0 rounded-full bg-status-danger-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] font-semibold text-status-danger"
							>
								{entry.result.exitCode}
							</span>
						{/if}

						<span class="shrink-0 text-status-muted/60">
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
