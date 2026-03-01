<script lang="ts">
	import { diagnosticLog } from '$lib/stores/diagnostics.js';
	import { gatewayEvents } from '$lib/gateway-api.js';
	import { get } from 'svelte/store';
	import type { DiagnosticEvent, DiagnosticLevel } from '$lib/stores/diagnostic-log.js';

	let { open = $bindable(false) } = $props();

	let entries = $state<DiagnosticEvent[]>([]);
	let errorCount = $state(0);
	let warnCount = $state(0);
	let levelFilter = $state<DiagnosticLevel | 'all'>('all');
	let logContainer: HTMLDivElement | undefined = $state();
	let autoScroll = $state(true);

	$effect(() => {
		const unsub = diagnosticLog.entries.subscribe((e) => {
			entries = e;
			if (autoScroll && logContainer) {
				requestAnimationFrame(() => {
					logContainer?.scrollTo({ top: logContainer.scrollHeight });
				});
			}
		});
		return unsub;
	});

	$effect(() => {
		const unsub = diagnosticLog.errorCount.subscribe((n) => {
			errorCount = n;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = diagnosticLog.warnCount.subscribe((n) => {
			warnCount = n;
		});
		return unsub;
	});

	let filteredEntries = $derived(
		levelFilter === 'all' ? entries : entries.filter((e) => e.level === levelFilter)
	);

	function handleScroll() {
		if (!logContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = logContainer;
		autoScroll = scrollHeight - scrollTop - clientHeight < 40;
	}

	function handleClear() {
		diagnosticLog.clear();
	}

	function handleCopyLog() {
		navigator.clipboard.writeText(diagnosticLog.export());
	}

	function handleCopySummary() {
		const summary = {
			state: get(gatewayEvents.state),
			connected: get(gatewayEvents.connected),
			snapshot: get(gatewayEvents.snapshot)
		};
		navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
	}

	function handleClose() {
		open = false;
	}

	function levelColor(level: DiagnosticLevel): string {
		switch (level) {
			case 'error':
				return 'bg-red-900 text-red-300';
			case 'warn':
				return 'bg-yellow-900 text-yellow-300';
			case 'info':
				return 'bg-blue-900 text-blue-300';
			case 'debug':
				return 'bg-gray-700 text-gray-400';
		}
	}

	function categoryColor(cat: string): string {
		switch (cat) {
			case 'connection':
				return 'text-cyan-400';
			case 'auth':
				return 'text-purple-400';
			case 'reconnect':
				return 'text-orange-400';
			case 'tick':
				return 'text-green-400';
			case 'request':
				return 'text-blue-400';
			case 'error':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

{#if open}
	<div
		class="fixed inset-y-0 left-0 z-50 flex w-96 flex-col border-r border-gray-700 bg-gray-900 shadow-2xl"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
			<h2 class="text-sm font-semibold text-white">Connection Diagnostics</h2>
			<button
				class="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
				onclick={handleClose}
				aria-label="Close diagnostics"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<!-- Summary row -->
		<div class="flex gap-4 border-b border-gray-700 px-4 py-2 text-xs">
			<span class="text-gray-400">
				Events: <span class="text-white">{entries.length}</span>
			</span>
			<span class="text-gray-400">
				Errors: <span class="text-red-400">{errorCount}</span>
			</span>
			<span class="text-gray-400">
				Warnings: <span class="text-yellow-400">{warnCount}</span>
			</span>
		</div>

		<!-- Controls -->
		<div class="flex items-center gap-2 border-b border-gray-700 px-4 py-2">
			<select
				class="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white"
				bind:value={levelFilter}
			>
				<option value="all">All levels</option>
				<option value="error">Errors</option>
				<option value="warn">Warnings</option>
				<option value="info">Info</option>
				<option value="debug">Debug</option>
			</select>
			<button
				class="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
				onclick={handleCopySummary}
			>
				Copy Summary
			</button>
			<button
				class="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
				onclick={handleCopyLog}
			>
				Copy Log
			</button>
			<button
				class="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
				onclick={handleClear}
			>
				Clear
			</button>
		</div>

		<!-- Scrollable log -->
		<div
			class="flex-1 overflow-y-auto font-mono text-xs"
			bind:this={logContainer}
			onscroll={handleScroll}
		>
			{#if filteredEntries.length === 0}
				<div class="p-4 text-center text-gray-500">No diagnostic events</div>
			{:else}
				{#each filteredEntries as entry (entry.ts + entry.message)}
					<div class="border-b border-gray-800 px-3 py-1.5 hover:bg-gray-800/50">
						<div class="flex items-center gap-2">
							<span class="text-gray-500">{formatTime(entry.ts)}</span>
							<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {levelColor(entry.level)}">
								{entry.level.toUpperCase()}
							</span>
							<span class="text-[10px] font-medium {categoryColor(entry.category)}">
								{entry.category}
							</span>
						</div>
						<div class="mt-0.5 text-gray-300">{entry.message}</div>
						{#if entry.detail}
							<div class="mt-0.5 text-gray-500">
								{JSON.stringify(entry.detail)}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-40 bg-black/30"
		onclick={handleClose}
		aria-label="Close diagnostics panel"
	></button>
{/if}
