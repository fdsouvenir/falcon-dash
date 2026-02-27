<script lang="ts">
	import { connection, snapshot } from '$lib/stores/gateway.js';
	import type { ConnectionState } from '$lib/gateway/types.js';

	let connectionState = $state<ConnectionState>('DISCONNECTED');
	let serverInfo = $state<{ version: string; host: string; connId: string } | null>(null);
	let uptimeMs = $state<number | null>(null);
	let connectedAt = $state<number | null>(null);
	let currentTime = $state(Date.now());
	let deviceCount = $state(0);

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

	$effect(() => {
		const unsub = connection.helloOk.subscribe((h) => {
			uptimeMs = h?.snapshot?.uptimeMs ?? null;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = snapshot.server.subscribe((s) => {
			serverInfo = s;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = snapshot.presence.subscribe((p) => {
			deviceCount = p.length;
		});
		return unsub;
	});

	$effect(() => {
		const interval = setInterval(() => {
			currentTime = Date.now();
		}, 1000);
		return () => clearInterval(interval);
	});

	function formatUptime(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);
		if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	}

	let isConnected = $derived(connectionState === 'READY');

	let statusColor = $derived(
		isConnected
			? 'bg-emerald-400'
			: connectionState === 'RECONNECTING' || connectionState === 'CONNECTING'
				? 'bg-amber-400'
				: 'bg-red-400'
	);

	let statusLabel = $derived(
		isConnected
			? 'Connected'
			: connectionState === 'RECONNECTING'
				? 'Reconnecting'
				: connectionState === 'CONNECTING'
					? 'Connecting'
					: connectionState === 'AUTHENTICATING'
						? 'Authenticating'
						: connectionState === 'PAIRING_REQUIRED'
							? 'Pairing Required'
							: connectionState === 'AUTH_FAILED'
								? 'Auth Failed'
								: 'Disconnected'
	);

	let gatewayUptime = $derived(
		uptimeMs != null ? formatUptime(uptimeMs + (currentTime - (connectedAt ?? currentTime))) : null
	);
</script>

<div
	class="relative overflow-hidden rounded-lg border border-gray-700/80 bg-gradient-to-r from-gray-800/90 to-gray-800/50"
>
	<div
		class="absolute inset-0 opacity-[0.03]"
		style="background-image: repeating-linear-gradient(90deg, transparent, transparent 40px, currentColor 40px, currentColor 41px), repeating-linear-gradient(0deg, transparent, transparent 40px, currentColor 40px, currentColor 41px)"
	></div>
	<div class="relative flex items-center gap-4 px-4 py-3 sm:px-5">
		<div class="flex items-center gap-2.5">
			<span class="relative flex h-2.5 w-2.5">
				{#if isConnected || connectionState === 'RECONNECTING' || connectionState === 'CONNECTING'}
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 {statusColor}"
					></span>
				{/if}
				<span class="relative inline-flex h-2.5 w-2.5 rounded-full {statusColor}"></span>
			</span>
			<span class="text-sm font-semibold tracking-wide text-gray-100">{statusLabel}</span>
		</div>
		{#if serverInfo}
			<div class="hidden items-center gap-3 text-xs text-gray-400 sm:flex">
				<span class="font-mono">{serverInfo.host}</span>
				<span class="text-gray-600">|</span>
				<span>v{serverInfo.version}</span>
			</div>
		{/if}
		<div class="ml-auto flex items-center gap-4 text-xs text-gray-400">
			{#if deviceCount > 0}
				<span>
					<span class="text-gray-500">{deviceCount}</span>
					<span class="ml-0.5 text-gray-500">device{deviceCount !== 1 ? 's' : ''}</span>
				</span>
			{/if}
			{#if gatewayUptime}
				<span>
					<span class="text-gray-500">up</span>
					<span class="ml-1 font-mono text-gray-300">{gatewayUptime}</span>
				</span>
			{/if}
		</div>
	</div>
</div>
