<script lang="ts">
	import type { OpsEntry } from '$lib/stores/ops.js';

	let { entry }: { entry: OpsEntry | null } = $props();

	function formatDuration(ms?: number): string {
		if (ms === undefined) return '—';
		if (ms < 1000) return `${ms}ms`;
		const s = ms / 1000;
		if (s < 60) return `${s.toFixed(1)}s`;
		const m = Math.floor(s / 60);
		return `${m}m ${Math.round(s % 60)}s`;
	}

	function getCommand(e: OpsEntry): string {
		const cmd = e.arguments?.command;
		return typeof cmd === 'string' ? cmd : JSON.stringify(e.arguments);
	}
</script>

<div class="flex h-full flex-col overflow-hidden border-l border-surface-border bg-surface-1 flex-[2]">
	{#if !entry}
		<div class="flex flex-1 items-center justify-center text-[length:var(--text-body)] text-status-muted/50">
			Select a process to view output
		</div>
	{:else}
		<!-- Header -->
		<div class="border-b border-surface-border bg-surface-2 px-[var(--space-card-padding)] py-3">
			<div class="mb-1.5 font-mono text-[length:var(--text-mono)] text-white/90 break-all">
				{getCommand(entry)}
			</div>
			<div class="flex flex-wrap items-center gap-3">
				{#if entry.result?.cwd}
					<span class="font-mono text-[length:var(--text-label)] text-status-muted">
						{entry.result.cwd}
					</span>
				{/if}
				<span class="text-[length:var(--text-label)] text-status-muted">
					{formatDuration(entry.result?.durationMs)}
				</span>
				<!-- Exit code -->
				{#if entry.status === 'running'}
					<span class="animate-pulse rounded-full bg-status-warning-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold text-status-warning">
						running
					</span>
				{:else if entry.result?.exitCode === 0 || entry.result?.exitCode === undefined}
					<span class="rounded-full bg-status-active-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold text-status-active">
						exit 0
					</span>
				{:else}
					<span class="rounded-full bg-status-danger-bg px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold text-status-danger">
						exit {entry.result?.exitCode}
					</span>
				{/if}
			</div>
		</div>

		<!-- Terminal output -->
		<div class="flex-1 overflow-auto bg-surface-0 p-[var(--space-card-padding)]">
			{#if entry.result?.text}
				<pre class="min-w-0 whitespace-pre-wrap break-words font-mono text-[length:var(--text-mono)] leading-relaxed text-green-400">{entry.result.text}</pre>
			{:else if entry.status === 'running'}
				<p class="font-mono text-[length:var(--text-mono)] text-status-warning/70">Process running…</p>
			{:else}
				<p class="font-mono text-[length:var(--text-mono)] text-status-muted/50">(no output)</p>
			{/if}
		</div>
	{/if}
</div>
