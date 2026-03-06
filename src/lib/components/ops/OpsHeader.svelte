<script lang="ts">
	import {
		sessions,
		currentSessionId,
		autoRefresh,
		refreshInterval,
		loadSessions,
		loadEntries,
		startStream,
		stopStream,
		startAutoRefresh,
		stopAutoRefresh,
		streamConnected,
		computeStats
	} from '$lib/stores/ops.js';
	import type { OpsEntry } from '$lib/stores/ops.js';

	let { entries = [] }: { entries: OpsEntry[] } = $props();

	const stats = $derived(computeStats(entries));

	// Format session filename as relative time
	function formatSessionTime(mtime: number): string {
		const diff = Date.now() - mtime;
		const mins = Math.floor(diff / 60_000);
		const hrs = Math.floor(mins / 60);
		const days = Math.floor(hrs / 24);
		if (days > 0) return `${days}d ago`;
		if (hrs > 0) return `${hrs}h ago`;
		if (mins > 0) return `${mins}m ago`;
		return 'just now';
	}

	async function onSessionChange(e: Event) {
		const id = (e.target as HTMLSelectElement).value;
		if (!id) return;
		currentSessionId.set(id);
		await loadEntries(id);
		if ($autoRefresh) {
			startStream(id);
		}
	}

	function onAutoRefreshToggle() {
		autoRefresh.update((v) => {
			const next = !v;
			if (next) {
				const sid = $currentSessionId;
				if (sid) startStream(sid);
				startAutoRefresh();
			} else {
				stopStream();
				stopAutoRefresh();
			}
			return next;
		});
	}

	function onIntervalChange(e: Event) {
		const ms = parseInt((e.target as HTMLSelectElement).value, 10);
		refreshInterval.set(ms);
		if ($autoRefresh) {
			stopAutoRefresh();
			startAutoRefresh();
		}
	}

	// Refresh sessions list on mount
	$effect(() => {
		loadSessions();
	});
</script>

<div class="flex flex-col gap-3 border-b border-surface-border bg-surface-1 px-[var(--space-card-padding)] py-3">
	<div class="flex flex-wrap items-center gap-4">
		<!-- Agent selector (future multi-agent — hardcoded "main" for now) -->
		<div class="flex items-center gap-2">
			<span class="text-[length:var(--text-label)] font-medium text-status-muted">Agent</span>
			<select
				class="rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-body)] text-white outline-none focus:border-status-info"
				disabled
			>
				<option value="main">main</option>
			</select>
		</div>

		<!-- Session selector -->
		<div class="flex items-center gap-2">
			<span class="text-[length:var(--text-label)] font-medium text-status-muted">Session</span>
			<select
				class="max-w-[220px] rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-body)] text-white outline-none focus:border-status-info"
				value={$currentSessionId ?? ''}
				onchange={onSessionChange}
			>
				<option value="" disabled>Select session…</option>
				{#each $sessions as session (session.sessionId)}
					<option value={session.sessionId}>
						{session.sessionId.slice(0, 16)}… ({formatSessionTime(session.mtime)})
					</option>
				{/each}
			</select>
		</div>

		<!-- Auto-refresh controls -->
		<div class="flex items-center gap-2">
			<button
				onclick={onAutoRefreshToggle}
				class="flex items-center gap-1.5 rounded border px-2.5 py-1 text-[length:var(--text-label)] font-medium transition-colors {$autoRefresh
					? 'border-status-active/30 bg-status-active-bg text-status-active'
					: 'border-surface-border bg-surface-2 text-status-muted hover:text-white'}"
			>
				<!-- Live dot -->
				{#if $autoRefresh && $streamConnected}
					<span class="relative flex h-2 w-2">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-active opacity-60"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-status-active"></span>
					</span>
				{:else}
					<span class="h-2 w-2 rounded-full {$autoRefresh ? 'bg-status-warning' : 'bg-status-muted'}"></span>
				{/if}
				{$autoRefresh ? 'Live' : 'Paused'}
			</button>

			{#if $autoRefresh}
				<select
					class="rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-label)] text-white outline-none"
					value={$refreshInterval}
					onchange={onIntervalChange}
				>
					<option value={5000}>5s</option>
					<option value={10000}>10s</option>
					<option value={30000}>30s</option>
				</select>
			{/if}
		</div>

		<!-- Stats -->
		<div class="ml-auto flex items-center gap-4">
			<div class="flex items-center gap-1.5">
				<span class="text-[length:var(--text-label)] text-status-muted">Calls</span>
				<span class="text-[length:var(--text-label)] font-semibold text-white">{stats.totalCalls}</span>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-[length:var(--text-label)] text-status-muted">Exec</span>
				<span class="text-[length:var(--text-label)] font-semibold text-status-active">{stats.execCalls}</span>
			</div>
			{#if stats.errors > 0}
				<div class="flex items-center gap-1.5">
					<span class="text-[length:var(--text-label)] text-status-muted">Errors</span>
					<span class="text-[length:var(--text-label)] font-semibold text-status-danger">{stats.errors}</span>
				</div>
			{/if}
		</div>
	</div>
</div>
