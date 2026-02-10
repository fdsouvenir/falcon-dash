<script lang="ts">
	import { connection, snapshot } from '$lib/stores/gateway.js';
	import type { ConnectionState } from '$lib/gateway/types.js';

	let connectionState = $state<ConnectionState>('DISCONNECTED');
	let serverInfo = $state<{ version: string; host: string; connId: string } | null>(null);
	let showDetails = $state(false);
	let connectedAt = $state<number | null>(null);
	let currentTime = $state(Date.now());

	// Subscribe to connection state
	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
			if (s === 'READY' && connectedAt === null) {
				connectedAt = Date.now();
			} else if (s === 'DISCONNECTED') {
				connectedAt = null;
			}
		});
		return unsub;
	});

	// Subscribe to server snapshot
	$effect(() => {
		const unsub = snapshot.server.subscribe((s) => {
			serverInfo = s;
		});
		return unsub;
	});

	// Update current time every second for uptime calculation
	$effect(() => {
		if (connectionState === 'READY') {
			const interval = setInterval(() => {
				currentTime = Date.now();
			}, 1000);
			return () => clearInterval(interval);
		}
	});

	function statusColor(state: ConnectionState): string {
		if (state === 'READY') return 'bg-green-500';
		if (state === 'RECONNECTING' || state === 'CONNECTING' || state === 'AUTHENTICATING')
			return 'bg-yellow-500';
		return 'bg-red-500';
	}

	function statusText(state: ConnectionState): string {
		if (state === 'READY') return 'Connected';
		if (state === 'RECONNECTING') return 'Reconnecting...';
		if (state === 'CONNECTING' || state === 'AUTHENTICATING') return 'Connecting...';
		return 'Disconnected';
	}

	function formatUptime(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}

	function toggleDetails() {
		showDetails = !showDetails;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.connection-status-container')) {
			showDetails = false;
		}
	}

	$effect(() => {
		if (showDetails) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});

	let uptime = $derived(
		connectionState === 'READY' && connectedAt !== null
			? formatUptime(currentTime - connectedAt)
			: 'N/A'
	);
</script>

<div class="connection-status-container relative">
	<button
		class="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-800 transition-colors"
		onclick={toggleDetails}
		aria-label="Connection status"
	>
		<span class="h-2.5 w-2.5 rounded-full {statusColor(connectionState)}"></span>
		<div class="flex flex-col items-start">
			<span class="text-xs font-medium text-white">{statusText(connectionState)}</span>
			{#if serverInfo?.host}
				<span class="text-xs text-gray-400">{serverInfo.host}</span>
			{/if}
		</div>
	</button>

	{#if showDetails}
		<div
			class="absolute left-0 top-full mt-1 w-64 rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl z-50"
		>
			<h3 class="mb-3 text-sm font-semibold text-white">Connection Details</h3>
			<dl class="space-y-2 text-xs">
				<div>
					<dt class="text-gray-400">Status</dt>
					<dd class="text-white">{statusText(connectionState)}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Gateway Host</dt>
					<dd class="text-white">{serverInfo?.host || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Connection ID</dt>
					<dd class="font-mono text-white">{serverInfo?.connId || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Uptime</dt>
					<dd class="text-white">{uptime}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Protocol Version</dt>
					<dd class="text-white">3</dd>
				</div>
				<div>
					<dt class="text-gray-400">Server Version</dt>
					<dd class="text-white">{serverInfo?.version || 'N/A'}</dd>
				</div>
			</dl>
		</div>
	{/if}
</div>

<style>
	/* Ensure details panel appears above other content */
	.connection-status-container {
		position: relative;
	}
</style>
