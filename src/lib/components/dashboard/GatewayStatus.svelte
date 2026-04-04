<script lang="ts">
	import { gatewayEvents } from '$lib/gateway-api.js';

	let connectionState = $state<string>('disconnected');
	let serverInfo = $state<{ version: string; host: string; connId: string } | null>(null);
	let uptimeMs = $state<number | null>(null);
	let snapshotReceivedAt = $state<number | null>(null);
	let currentTime = $state(Date.now());
	let deviceCount = $state(0);

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = gatewayEvents.snapshot.subscribe((snap) => {
			uptimeMs = snap?.snapshot?.uptimeMs ?? null;
			const rawSnap = snap as unknown as Record<string, unknown> | null;
			snapshotReceivedAt = (rawSnap?._snapshotReceivedAt as number | undefined) ?? null;
			serverInfo = snap?.server ?? null;
			deviceCount = (snap?.snapshot?.presence as unknown[] | undefined)?.length ?? 0;
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

	let isConnected = $derived(connectionState === 'ready');
	let isConnecting = $derived(
		connectionState === 'reconnecting' || connectionState === 'connecting'
	);

	let statusDotColor = $derived(
		isConnected ? 'bg-status-active' : isConnecting ? 'bg-status-warning' : 'bg-status-danger'
	);

	let statusLabel = $derived(
		isConnected
			? 'Connected'
			: connectionState === 'reconnecting'
				? 'Reconnecting'
				: connectionState === 'connecting'
					? 'Connecting'
					: connectionState === 'authenticating'
						? 'Authenticating'
						: connectionState === 'pairing_required'
							? 'Pairing Required'
							: connectionState === 'auth_failed'
								? 'Auth Failed'
								: 'Disconnected'
	);

	let gatewayUptime = $derived(
		uptimeMs != null && snapshotReceivedAt != null
			? formatUptime(uptimeMs + (currentTime - snapshotReceivedAt))
			: null
	);
</script>

<div class="relative overflow-hidden rounded-lg border border-surface-border bg-surface-1">
	<!-- Subtle grid overlay -->
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.03]"
		style="background-image: repeating-linear-gradient(90deg, transparent, transparent 40px, currentColor 40px, currentColor 41px), repeating-linear-gradient(0deg, transparent, transparent 40px, currentColor 40px, currentColor 41px)"
	></div>

	<div class="relative flex items-center gap-4 px-5 py-3">
		<!-- Status dot + label -->
		<div class="flex items-center gap-2.5">
			<span class="relative flex h-2.5 w-2.5">
				{#if isConnected || isConnecting}
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 {statusDotColor}"
					></span>
				{/if}
				<span class="relative inline-flex h-2.5 w-2.5 rounded-full {statusDotColor}"></span>
			</span>
			<span class="text-[length:var(--text-card-title)] font-semibold tracking-wide text-white">
				{statusLabel}
			</span>
		</div>

		<!-- Server info -->
		{#if serverInfo}
			<div class="hidden items-center gap-3 sm:flex">
				<span class="font-mono text-[length:var(--text-label)] text-status-muted">
					{serverInfo.host}
				</span>
				<span class="text-surface-border">|</span>
				<span class="text-[length:var(--text-label)] text-status-muted">
					v{serverInfo.version}
				</span>
			</div>
		{/if}

		<!-- Right stats -->
		<div class="ml-auto flex items-center gap-5">
			{#if deviceCount > 0}
				<div class="flex items-center gap-1.5">
					<svg
						class="h-3.5 w-3.5 text-status-muted"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
						/>
					</svg>
					<span class="text-[length:var(--text-label)] font-medium text-white">
						{deviceCount}
					</span>
				</div>
			{/if}
			{#if gatewayUptime}
				<div class="flex items-center gap-1.5">
					<svg
						class="h-3.5 w-3.5 text-status-muted"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span class="font-mono text-[length:var(--text-label)] font-medium text-white">
						{gatewayUptime}
					</span>
				</div>
			{/if}
		</div>
	</div>
</div>
