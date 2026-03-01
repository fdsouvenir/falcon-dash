<script lang="ts">
	import { gatewayEvents } from '$lib/gateway-api.js';
	import { tickHealth } from '$lib/stores/diagnostics.js';
	import DiagnosticPanel from './DiagnosticPanel.svelte';

	let connectionState = $state<string>('disconnected');
	let serverInfo = $state<{ version: string; host: string; connId: string } | null>(null);
	let showDetails = $state(false);
	let showDiagnostics = $state(false);
	let connectedAt = $state<number | null>(null);
	let currentTime = $state(Date.now());
	let lastTickAt = $state<number | null>(null);

	// Subscribe to connection state
	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connectionState = s;
			if (s === 'ready' && connectedAt === null) {
				connectedAt = Date.now();
			} else if (s === 'disconnected') {
				connectedAt = null;
			}
		});
		return unsub;
	});

	// Subscribe to server snapshot
	$effect(() => {
		const unsub = gatewayEvents.snapshot.subscribe((snap) => {
			serverInfo = snap?.server ?? null;
		});
		return unsub;
	});

	// Subscribe to tick health
	$effect(() => {
		const unsub = tickHealth.subscribe((h) => {
			lastTickAt = h.lastTickAt;
		});
		return unsub;
	});

	// Update current time every second for uptime calculation
	$effect(() => {
		if (connectionState === 'ready' || connectionState === 'reconnecting') {
			const interval = setInterval(() => {
				currentTime = Date.now();
			}, 1000);
			return () => clearInterval(interval);
		}
	});

	function statusColor(state: string): string {
		if (state === 'ready') return 'bg-green-500';
		if (state === 'pairing_required') return 'bg-yellow-500 animate-pulse';
		if (state === 'reconnecting' || state === 'connecting' || state === 'authenticating')
			return 'bg-yellow-500';
		return 'bg-red-500';
	}

	function statusText(state: string): string {
		if (state === 'ready') return 'Connected';
		if (state === 'reconnecting') return 'Reconnecting...';
		if (state === 'connecting' || state === 'authenticating') return 'Connecting...';
		if (state === 'auth_failed') return 'Auth Failed';
		if (state === 'pairing_required') return 'Pairing Required';
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

	function handleReenterToken() {
		// Auth is server-side; just retry connection
		gatewayEvents.disconnect();
		gatewayEvents.connect();
		showDetails = false;
	}

	function handleRetryConnection() {
		// Server-side SSE reconnects automatically; force by reconnecting the EventSource
		gatewayEvents.disconnect();
		gatewayEvents.connect();
		showDetails = false;
	}

	function handleOpenDiagnostics() {
		showDetails = false;
		showDiagnostics = true;
	}

	let uptime = $derived(
		connectionState === 'ready' && connectedAt !== null
			? formatUptime(currentTime - connectedAt)
			: 'N/A'
	);

	let lastTickAgo = $derived(
		lastTickAt !== null ? Math.floor((currentTime - lastTickAt) / 1000) : null
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
			class="absolute left-0 top-full mt-1 w-72 rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl z-50"
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

				<!-- Reconnecting info -->
				{#if connectionState === 'reconnecting'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<p class="text-yellow-400">SSE reconnecting automatically...</p>
						<button
							class="mt-2 w-full rounded bg-blue-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
							onclick={handleRetryConnection}
						>
							Force Reconnect
						</button>
					</div>
				{/if}

				<!-- Disconnected recovery -->
				{#if connectionState === 'disconnected'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<button
							class="w-full rounded bg-blue-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
							onclick={handleRetryConnection}
						>
							Retry Connection
						</button>
					</div>
				{/if}

				<!-- Ready state info -->
				{#if connectionState === 'ready'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<div>
							<dt class="text-gray-400">Last tick</dt>
							<dd class="text-white">
								{lastTickAgo !== null ? `${lastTickAgo}s ago` : 'N/A'}
							</dd>
						</div>
					</div>
				{/if}

				<!-- Auth failed recovery -->
				{#if connectionState === 'auth_failed'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<button
							class="w-full rounded bg-red-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
							onclick={handleReenterToken}
						>
							Re-enter Token
						</button>
					</div>
				{/if}

				<!-- Pairing required recovery -->
				{#if connectionState === 'pairing_required'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<p class="text-yellow-400 mb-1">Approve device in gateway admin</p>
						<p class="text-xs text-gray-400 mb-2">
							Run <code class="font-mono">openclaw devices approve</code>
						</p>
						<button
							class="w-full rounded bg-yellow-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 transition-colors"
							onclick={handleRetryConnection}
						>
							Retry
						</button>
					</div>
				{/if}
			</dl>

			<!-- View Diagnostics button -->
			<div class="mt-3 border-t border-gray-700 pt-3">
				<button
					class="w-full rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
					onclick={handleOpenDiagnostics}
				>
					View Diagnostics
				</button>
			</div>
		</div>
	{/if}
</div>

<DiagnosticPanel bind:open={showDiagnostics} />

<style>
	/* Ensure details panel appears above other content */
	.connection-status-container {
		position: relative;
	}
</style>
