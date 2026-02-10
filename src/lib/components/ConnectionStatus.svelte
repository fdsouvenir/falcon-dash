<script lang="ts">
	import { connection, snapshot, reconnector, correlator } from '$lib/stores/gateway.js';
	import { tickHealth } from '$lib/stores/diagnostics.js';
	import { gatewayToken } from '$lib/stores/token.js';
	import { connectToGateway } from '$lib/stores/gateway.js';
	import { gatewayUrl } from '$lib/stores/token.js';
	import type { ConnectionState } from '$lib/gateway/types.js';
	import type { ReconnectorMetrics } from '$lib/gateway/reconnector.js';
	import type { CorrelatorMetrics } from '$lib/gateway/correlator.js';
	import DiagnosticPanel from './DiagnosticPanel.svelte';

	let connectionState = $state<ConnectionState>('DISCONNECTED');
	let serverInfo = $state<{ version: string; host: string; connId: string } | null>(null);
	let showDetails = $state(false);
	let showDiagnostics = $state(false);
	let connectedAt = $state<number | null>(null);
	let currentTime = $state(Date.now());
	let reconnectMetrics = $state<ReconnectorMetrics>({
		attempt: 0,
		maxAttempts: 20,
		exhausted: false,
		nextRetryAt: null,
		nextRetryDelayMs: null,
		lastReconnectAt: null,
		tickIntervalMs: null
	});
	let correlatorMetrics = $state<CorrelatorMetrics>({
		pendingCount: 0,
		totalRequests: 0,
		totalTimeouts: 0,
		totalErrors: 0,
		lastErrorAt: null
	});
	let lastTickAt = $state<number | null>(null);

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

	// Subscribe to reconnector metrics
	$effect(() => {
		const unsub = reconnector.metrics.subscribe((m) => {
			reconnectMetrics = m;
		});
		return unsub;
	});

	// Subscribe to correlator metrics
	$effect(() => {
		const unsub = correlator.metrics.subscribe((m) => {
			correlatorMetrics = m;
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
		if (connectionState === 'READY' || connectionState === 'RECONNECTING') {
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
		if (state === 'AUTH_FAILED') return 'Auth Failed';
		if (state === 'PAIRING_REQUIRED') return 'Pairing Required';
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
		gatewayToken.clear();
		showDetails = false;
	}

	function handleRetryConnection() {
		reconnector.resetAttempts();
		let url = 'ws://127.0.0.1:18789';
		let token: string | null = null;
		const unsubUrl = gatewayUrl.subscribe((v) => {
			url = v;
		});
		const unsubToken = gatewayToken.subscribe((v) => {
			token = v;
		});
		unsubUrl();
		unsubToken();
		if (token) {
			connectToGateway(url, token);
		}
		showDetails = false;
	}

	function handleOpenDiagnostics() {
		showDetails = false;
		showDiagnostics = true;
	}

	let uptime = $derived(
		connectionState === 'READY' && connectedAt !== null
			? formatUptime(currentTime - connectedAt)
			: 'N/A'
	);

	let retryCountdown = $derived(
		reconnectMetrics.nextRetryAt !== null
			? Math.max(0, Math.ceil((reconnectMetrics.nextRetryAt - currentTime) / 1000))
			: null
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
				{#if connectionState === 'RECONNECTING'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<div>
							<dt class="text-gray-400">Attempt</dt>
							<dd class="text-yellow-400">
								{reconnectMetrics.attempt}/{reconnectMetrics.maxAttempts}
							</dd>
						</div>
						<div class="mt-1">
							<dt class="text-gray-400">Next retry in</dt>
							<dd class="text-yellow-400">
								{retryCountdown !== null ? `${retryCountdown}s` : 'waiting for network...'}
							</dd>
						</div>
					</div>
				{/if}

				<!-- Retries exhausted -->
				{#if reconnectMetrics.exhausted && connectionState === 'DISCONNECTED'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<p class="text-red-400 mb-2">
							Connection failed after {reconnectMetrics.maxAttempts} attempts
						</p>
						<button
							class="w-full rounded bg-blue-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
							onclick={handleRetryConnection}
						>
							Retry Connection
						</button>
					</div>
				{/if}

				<!-- Ready state info -->
				{#if connectionState === 'READY'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<div>
							<dt class="text-gray-400">Last tick</dt>
							<dd class="text-white">
								{lastTickAgo !== null ? `${lastTickAgo}s ago` : 'N/A'}
							</dd>
						</div>
						<div class="mt-1">
							<dt class="text-gray-400">Pending requests</dt>
							<dd class="text-white">{correlatorMetrics.pendingCount}</dd>
						</div>
					</div>
				{/if}

				<!-- Auth failed recovery -->
				{#if connectionState === 'AUTH_FAILED'}
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
				{#if connectionState === 'PAIRING_REQUIRED'}
					<div class="border-t border-gray-700 pt-2 mt-2">
						<p class="text-gray-400 mb-2">Approve device in gateway admin</p>
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
