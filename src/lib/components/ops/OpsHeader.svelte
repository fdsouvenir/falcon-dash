<script lang="ts">
	import type { OpsEntry } from '$lib/stores/ops.js';
	import {
		autoRefresh,
		refreshInterval,
		startAutoRefresh,
		stopAutoRefresh,
		computeStats
	} from '$lib/stores/ops.js';

	let { entries = [] }: { entries: OpsEntry[] } = $props();

	const stats = $derived(computeStats(entries));

	const intervals = [
		{ label: '5s', value: 5_000 },
		{ label: '10s', value: 10_000 },
		{ label: '30s', value: 30_000 }
	];

	function toggleAutoRefresh() {
		autoRefresh.update((v) => {
			const next = !v;
			if (next) {
				startAutoRefresh();
			} else {
				stopAutoRefresh();
			}
			return next;
		});
	}

	function setInterval(ms: number) {
		refreshInterval.set(ms);
		if ($autoRefresh) {
			stopAutoRefresh();
			startAutoRefresh();
		}
	}
</script>

<div
	class="flex items-center justify-between border-b border-surface-border bg-surface-1 px-[var(--space-card-padding)] py-2.5"
>
	<!-- Left: title + stats -->
	<div class="flex items-center gap-5">
		<h1 class="text-[length:var(--text-card-title)] font-semibold text-white">Ops Observer</h1>

		<div class="hidden items-center gap-4 text-[length:var(--text-label)] sm:flex">
			<span class="text-status-muted">
				Calls <span class="font-medium text-white">{stats.totalCalls}</span>
			</span>
			<span class="text-status-muted">
				Exec <span class="font-medium text-status-info">{stats.execCalls}</span>
			</span>
			<span class="text-status-muted">
				Errors <span
					class="font-medium {stats.errors > 0 ? 'text-status-danger' : 'text-status-active'}"
					>{stats.errors}</span
				>
			</span>
			<span class="text-status-muted">
				Sessions <span class="font-medium text-status-purple">{stats.uniqueSessions}</span>
			</span>
		</div>
	</div>

	<!-- Right: auto-refresh controls -->
	<div class="flex items-center gap-2">
		{#if $autoRefresh}
			<div class="flex items-center gap-1 rounded border border-surface-border bg-surface-2">
				{#each intervals as int (int.value)}
					<button
						onclick={() => setInterval(int.value)}
						class="px-2 py-1 text-[length:var(--text-badge)] font-medium transition-colors {$refreshInterval ===
						int.value
							? 'bg-surface-3 text-white'
							: 'text-status-muted hover:text-white'}"
					>
						{int.label}
					</button>
				{/each}
			</div>
		{/if}

		<button
			onclick={toggleAutoRefresh}
			class="flex items-center gap-1.5 rounded px-2.5 py-1 text-[length:var(--text-badge)] font-medium transition-colors {$autoRefresh
				? 'bg-status-active-bg text-status-active'
				: 'bg-surface-2 text-status-muted'}"
		>
			<span
				class="h-1.5 w-1.5 rounded-full {$autoRefresh
					? 'bg-status-active animate-pulse'
					: 'bg-status-muted'}"
			></span>
			{$autoRefresh ? 'Live' : 'Paused'}
		</button>
	</div>
</div>
