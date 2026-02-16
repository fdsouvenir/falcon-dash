<script lang="ts">
	import { snapshot, call } from '$lib/stores/gateway.js';

	const dashboardVersion = '0.0.1';

	let agentIdentity = $state<{ name: string; description?: string } | null>(null);
	let serverInfo = $state<{ version: string } | null>(null);
	let gatewayStatus = $state<{ uptime?: number; sessionCount?: number } | null>(null);
	let loading = $state(true);

	// Subscribe to server snapshot
	$effect(() => {
		const unsub = snapshot.server.subscribe((s) => {
			serverInfo = s;
		});
		return unsub;
	});

	// Load agent identity and gateway status
	$effect(() => {
		loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const [identity, status] = await Promise.all([
				call<{ name: string; description?: string }>('agent-identity').catch(() => ({
					name: 'OpenClaw Agent'
				})),
				call<{ uptime?: number; sessions?: number }>('info.status').catch(() => ({
					uptime: undefined,
					sessions: undefined
				}))
			]);
			agentIdentity = identity;
			gatewayStatus = {
				uptime: status.uptime,
				sessionCount: status.sessions
			};
		} catch (err) {
			console.error('Failed to load about data:', err);
		} finally {
			loading = false;
		}
	}

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
</script>

<div class="flex flex-col gap-6 p-6">
	<!-- Logo/Branding Section -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-6 text-center">
		<div class="mb-4 flex items-center justify-center">
			<div class="text-4xl">🦅</div>
		</div>
		<h2 class="mb-1 text-2xl font-bold text-white">Falcon Dash</h2>
		<p class="text-sm text-gray-400">OpenClaw Control Dashboard</p>
	</div>

	<!-- Agent Identity Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Agent Identity</h3>
		{#if loading}
			<div class="text-sm text-gray-400">Loading...</div>
		{:else}
			<dl class="space-y-3 text-sm">
				<div>
					<dt class="text-gray-400">Name</dt>
					<dd class="mt-1 font-medium text-white">{agentIdentity?.name || 'Unknown'}</dd>
				</div>
				{#if agentIdentity?.description}
					<div>
						<dt class="text-gray-400">Description</dt>
						<dd class="mt-1 text-white">{agentIdentity.description}</dd>
					</div>
				{/if}
			</dl>
		{/if}
	</div>

	<!-- Version Information Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Version Information</h3>
		{#if loading}
			<div class="text-sm text-gray-400">Loading...</div>
		{:else}
			<dl class="space-y-3 text-sm">
				<div>
					<dt class="text-gray-400">Dashboard Version</dt>
					<dd class="mt-1 font-mono text-white">{dashboardVersion}</dd>
				</div>
				<div>
					<dt class="text-gray-400">OpenClaw Gateway</dt>
					<dd class="mt-1 font-mono text-white">{serverInfo?.version || 'Unknown'}</dd>
				</div>
			</dl>
		{/if}
	</div>

	<!-- System Status Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">System Status</h3>
		{#if loading}
			<div class="text-sm text-gray-400">Loading...</div>
		{:else}
			<dl class="space-y-3 text-sm">
				<div>
					<dt class="text-gray-400">Gateway Uptime</dt>
					<dd class="mt-1 font-medium text-white">
						{gatewayStatus?.uptime ? formatUptime(gatewayStatus.uptime) : 'N/A'}
					</dd>
				</div>
				<div>
					<dt class="text-gray-400">Active Sessions</dt>
					<dd class="mt-1 font-medium text-white">
						{gatewayStatus?.sessionCount !== undefined ? gatewayStatus.sessionCount : 'N/A'}
					</dd>
				</div>
			</dl>
		{/if}
	</div>

	<!-- OpenClaw Platform Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">OpenClaw Platform</h3>
		<p class="text-sm text-gray-300">
			Falcon Dash is the control dashboard for the OpenClaw AI platform, providing real-time chat,
			project management, file browsing, and system monitoring through a unified web interface.
		</p>
	</div>
</div>
