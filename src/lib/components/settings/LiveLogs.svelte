<script lang="ts">
	import { rpc, gatewayEvents } from '$lib/gateway-api.js';

	type LogEntry = {
		ts: number;
		level: string;
		message: string;
	};

	type LogsTailResponse = {
		entries: LogEntry[];
		cursor: string;
		hasMore: boolean;
	};

	let entries = $state<LogEntry[]>([]);
	let cursor = $state<string | undefined>(undefined);
	let isRunning = $state(false);
	let autoFollow = $state(true);
	let textFilter = $state('');
	let levelFilter = $state<'all' | 'debug' | 'info' | 'warn' | 'error'>('all');
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let logContainer: HTMLDivElement;
	let unavailable = $state(false);

	const MAX_ENTRIES = 1000;

	function getLevelColor(level: string): string {
		switch (level.toLowerCase()) {
			case 'debug':
				return 'text-gray-500';
			case 'info':
				return 'text-blue-400';
			case 'warn':
				return 'text-yellow-400';
			case 'error':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	}

	async function fetchLogs() {
		try {
			const response = await rpc<LogsTailResponse>('logs.tail', {
				cursor,
				limit: 500,
				maxBytes: 250000
			});

			if (response.entries.length > 0) {
				entries = [...entries, ...response.entries].slice(-MAX_ENTRIES);
				cursor = response.cursor;

				if (autoFollow) {
					setTimeout(() => {
						if (logContainer) {
							logContainer.scrollTop = logContainer.scrollHeight;
						}
					}, 0);
				}
			}
		} catch (e) {
			console.error('Failed to fetch logs:', e);
			unavailable = true;
			stopPolling();
		}
	}

	function startPolling() {
		isRunning = true;
		fetchLogs();
		pollInterval = setInterval(fetchLogs, 2000);
	}

	function stopPolling() {
		isRunning = false;
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	function togglePolling() {
		if (isRunning) {
			stopPolling();
		} else {
			startPolling();
		}
	}

	function clearLogs() {
		entries = [];
		cursor = undefined;
	}

	const filteredEntries = $derived(
		entries.filter((entry) => {
			if (levelFilter !== 'all' && entry.level.toLowerCase() !== levelFilter) {
				return false;
			}
			if (textFilter && !entry.message.toLowerCase().includes(textFilter.toLowerCase())) {
				return false;
			}
			return true;
		})
	);

	function formatTimestamp(ts: number): string {
		const date = new Date(ts);
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3
		});
	}

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe(() => {});
		return () => {
			unsub();
			stopPolling();
		};
	});
</script>

<div class="flex h-full flex-col overflow-hidden bg-gray-900">
	<div class="border-b border-gray-800 px-4 py-3">
		<h2 class="text-lg font-semibold text-white">Live Logs</h2>
		<p class="text-sm text-gray-400">View real-time gateway logs</p>
	</div>

	<!-- Controls -->
	<div class="border-b border-gray-800 px-4 py-3">
		<div class="flex flex-wrap items-center gap-3">
			<button
				onclick={togglePolling}
				class="rounded px-3 py-1 text-sm font-medium transition-colors {isRunning
					? 'bg-red-600 hover:bg-red-500'
					: 'bg-green-600 hover:bg-green-500'} text-white"
			>
				{isRunning ? 'Pause' : 'Play'}
			</button>

			<button
				onclick={clearLogs}
				class="rounded bg-gray-700 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
			>
				Clear
			</button>

			<label class="flex items-center gap-2 text-sm text-gray-300">
				<input type="checkbox" bind:checked={autoFollow} class="rounded" />
				Auto-follow
			</label>

			<select
				bind:value={levelFilter}
				class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white"
			>
				<option value="all">All Levels</option>
				<option value="debug">Debug</option>
				<option value="info">Info</option>
				<option value="warn">Warn</option>
				<option value="error">Error</option>
			</select>

			<input
				type="text"
				bind:value={textFilter}
				placeholder="Filter by text..."
				class="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-sm text-white placeholder-gray-500"
			/>

			<span class="ml-auto text-xs text-gray-500">
				{filteredEntries.length} / {entries.length} entries
			</span>
		</div>
	</div>

	<!-- Log entries -->
	<div bind:this={logContainer} class="flex-1 overflow-y-auto bg-gray-950 p-4 font-mono text-sm">
		{#if unavailable}
			<div class="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
				<p class="text-sm text-yellow-400">
					Live log streaming requires the logs.tail gateway method. No log source is currently
					connected.
				</p>
			</div>
		{:else if filteredEntries.length === 0}
			<div class="text-center text-gray-500">
				{isRunning ? 'Waiting for logs...' : 'Press Play to start tailing logs'}
			</div>
		{:else}
			<div class="space-y-1">
				{#each filteredEntries as entry (entry.ts + entry.message)}
					<div class="flex gap-3">
						<span class="flex-shrink-0 text-gray-600">{formatTimestamp(entry.ts)}</span>
						<span class="w-12 flex-shrink-0 font-semibold uppercase {getLevelColor(entry.level)}">
							{entry.level}
						</span>
						<span class="flex-1 text-gray-300">{entry.message}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
