<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { logEntries, logCursor, tailLogs, clearLogs } from '$lib/stores';
	import type { LogLevel } from '$lib/types/settings';

	let container: HTMLDivElement;
	let isAtBottom = $state(true);
	let streaming = $state(true);
	let loading = $state(true);
	let filterLevel: LogLevel | 'all' = $state('all');
	let searchText = $state('');

	let tailInterval: ReturnType<typeof setInterval> | undefined;

	function levelColor(level: LogLevel): string {
		switch (level) {
			case 'error':
				return 'text-red-400';
			case 'warn':
				return 'text-yellow-400';
			case 'info':
				return 'text-slate-300';
			case 'debug':
				return 'text-slate-500';
			default:
				return 'text-slate-400';
		}
	}

	function levelBadgeClass(level: LogLevel): string {
		switch (level) {
			case 'error':
				return 'bg-red-900/40 text-red-400';
			case 'warn':
				return 'bg-yellow-900/40 text-yellow-400';
			case 'info':
				return 'bg-slate-700/60 text-slate-300';
			case 'debug':
				return 'bg-slate-800/60 text-slate-500';
			default:
				return 'bg-slate-700/60 text-slate-400';
		}
	}

	function formatLogTimestamp(ts: number): string {
		const d = new Date(ts);
		const h = d.getHours().toString().padStart(2, '0');
		const m = d.getMinutes().toString().padStart(2, '0');
		const s = d.getSeconds().toString().padStart(2, '0');
		const ms = d.getMilliseconds().toString().padStart(3, '0');
		return `${h}:${m}:${s}.${ms}`;
	}

	function handleScroll() {
		if (!container) return;
		const threshold = 40;
		isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
	}

	function scrollToBottom() {
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}

	function jumpToBottom() {
		isAtBottom = true;
		scrollToBottom();
	}

	function toggleStreaming() {
		streaming = !streaming;
		if (streaming) {
			startTailing();
		} else {
			stopTailing();
		}
	}

	function handleClear() {
		clearLogs();
	}

	async function fetchLogs() {
		const cursor = $logCursor || undefined;
		await tailLogs({ cursor, limit: 100 });
	}

	function startTailing() {
		stopTailing();
		tailInterval = setInterval(() => {
			fetchLogs();
		}, 3000);
	}

	function stopTailing() {
		if (tailInterval) {
			clearInterval(tailInterval);
			tailInterval = undefined;
		}
	}

	let filteredEntries = $derived(
		$logEntries.filter((entry) => {
			if (filterLevel !== 'all' && entry.level !== filterLevel) return false;
			if (searchText) {
				const lower = searchText.toLowerCase();
				if (
					!entry.message.toLowerCase().includes(lower) &&
					!(entry.source && entry.source.toLowerCase().includes(lower))
				) {
					return false;
				}
			}
			return true;
		})
	);

	onMount(async () => {
		try {
			await fetchLogs();
		} catch {
			// Gateway may not support logs.tail yet
		}
		loading = false;
		if (streaming) {
			startTailing();
		}
	});

	onDestroy(() => {
		stopTailing();
	});

	$effect(() => {
		// Track filteredEntries length to re-run when log entries change
		const _len = filteredEntries.length;
		void _len;
		if (isAtBottom && streaming) {
			tick().then(() => scrollToBottom());
		}
	});
</script>

<div class="flex h-full flex-col">
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-2 border-b border-slate-700 px-4 py-2">
		<!-- Level filter -->
		<select
			bind:value={filterLevel}
			class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
		>
			<option value="all">All levels</option>
			<option value="error">Error</option>
			<option value="warn">Warn</option>
			<option value="info">Info</option>
			<option value="debug">Debug</option>
		</select>

		<!-- Search -->
		<input
			type="text"
			bind:value={searchText}
			placeholder="Search logs..."
			class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
		/>

		<div class="flex-1"></div>

		<!-- Entry count -->
		<span class="text-xs text-slate-500">
			{filteredEntries.length}{filteredEntries.length !== $logEntries.length
				? ` / ${$logEntries.length}`
				: ''} entries
		</span>

		<!-- Pause/Resume -->
		<button
			onclick={toggleStreaming}
			class="rounded px-2 py-1 text-xs transition-colors {streaming
				? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
				: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
		>
			{streaming ? 'Streaming' : 'Paused'}
		</button>

		<!-- Clear -->
		<button
			onclick={handleClear}
			class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-600"
		>
			Clear
		</button>
	</div>

	<!-- Log entries -->
	<div
		class="relative flex-1 overflow-y-auto bg-slate-900/50"
		bind:this={container}
		onscroll={handleScroll}
	>
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<p class="text-sm text-slate-400">Loading logs...</p>
			</div>
		{:else if filteredEntries.length === 0}
			<div class="flex items-center justify-center py-8">
				<p class="text-sm text-slate-500">
					{$logEntries.length === 0 ? 'No log entries yet.' : 'No entries match the filter.'}
				</p>
			</div>
		{:else}
			<div class="p-2">
				{#each filteredEntries as entry, i (entry.timestamp + '-' + i)}
					<div
						class="flex gap-2 rounded px-2 py-0.5 font-mono text-xs hover:bg-slate-800/60 {levelColor(
							entry.level
						)}"
					>
						<span class="flex-shrink-0 text-slate-500">
							{formatLogTimestamp(entry.timestamp)}
						</span>
						<span
							class="inline-flex w-12 flex-shrink-0 items-center justify-center rounded px-1 text-center uppercase {levelBadgeClass(
								entry.level
							)}"
						>
							{entry.level}
						</span>
						{#if entry.source}
							<span class="flex-shrink-0 text-slate-400">[{entry.source}]</span>
						{/if}
						<span class="min-w-0 break-all">{entry.message}</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Jump to bottom button -->
		{#if !isAtBottom}
			<button
				class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-600 px-3 py-1 text-xs text-slate-200 shadow-lg transition-colors hover:bg-slate-500"
				onclick={jumpToBottom}
			>
				Jump to bottom
			</button>
		{/if}
	</div>
</div>
