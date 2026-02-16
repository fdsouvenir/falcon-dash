<script lang="ts">
	import { connection, snapshot, call } from '$lib/stores/gateway.js';
	import type { ConnectionState } from '$lib/gateway/types.js';
	import { addToast } from '$lib/stores/toast.js';

	let connectionState = $state<ConnectionState>('DISCONNECTED');
	let serverInfo = $state<{ version: string; host: string; connId: string } | null>(null);
	let connectedAt = $state<number | null>(null);
	let currentTime = $state(Date.now());

	// Gateway status data
	let gatewayStatus = $state<{
		uptime?: number;
		currentModel?: string;
		sessionCount?: number;
	} | null>(null);

	// Usage data
	let usageData = $state<{
		providers?: Array<{
			name: string;
			tokens: number;
			cost?: number;
		}>;
		total?: { tokens: number; cost?: number };
	} | null>(null);

	// Nodes data
	let nodesData = $state<
		Array<{
			id: string;
			name: string;
			status: string;
			capabilities?: string[];
			deviceType?: string;
		}>
	>([]);

	// Sub-agents data
	let agentsData = $state<{
		active?: Array<{
			runId: string;
			task: string;
			model: string;
			tokens?: number;
			cost?: number;
			startedAt?: number;
		}>;
		history?: Array<{
			runId: string;
			task: string;
			model: string;
			tokens?: number;
			cost?: number;
			completedAt?: number;
		}>;
	} | null>(null);

	// Loading states
	let loadingStatus = $state(false);
	let loadingUsage = $state(false);
	let loadingNodes = $state(false);
	let loadingAgents = $state(false);
	let showRestartConfirm = $state(false);

	// Unavailability states
	let statusUnavailable = $state(false);
	let usageUnavailable = $state(false);
	let nodesUnavailable = $state(false);
	let agentsUnavailable = $state(false);

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

	// Update current time every second
	$effect(() => {
		const interval = setInterval(() => {
			currentTime = Date.now();
		}, 1000);
		return () => clearInterval(interval);
	});

	// Load data on mount
	$effect(() => {
		if (connectionState === 'READY') {
			loadStatusData();
			loadUsageData();
			loadNodesData();
			loadAgentsData();
		}
	});

	async function loadStatusData() {
		loadingStatus = true;
		try {
			const result = await call<{ uptime?: number; model?: string; sessions?: number }>(
				'info.status'
			);
			gatewayStatus = {
				uptime: result.uptime,
				currentModel: result.model,
				sessionCount: result.sessions
			};
			statusUnavailable = false;
		} catch (err) {
			console.error('Failed to load status:', err);
			statusUnavailable = true;
		} finally {
			loadingStatus = false;
		}
	}

	async function loadUsageData() {
		loadingUsage = true;
		try {
			const result = await call<{
				providers?: Array<{ name: string; tokens: number; cost?: number }>;
				total?: { tokens: number; cost?: number };
			}>('info.usage');
			usageData = result;
			usageUnavailable = false;
		} catch (err) {
			console.error('Failed to load usage:', err);
			usageUnavailable = true;
		} finally {
			loadingUsage = false;
		}
	}

	async function loadNodesData() {
		loadingNodes = true;
		try {
			const result = await call<{
				nodes: Array<{
					id: string;
					name: string;
					status: string;
					capabilities?: string[];
					deviceType?: string;
				}>;
			}>('nodes.list');
			nodesData = result.nodes || [];
			nodesUnavailable = false;
		} catch (err) {
			console.error('Failed to load nodes:', err);
			nodesUnavailable = true;
		} finally {
			loadingNodes = false;
		}
	}

	async function loadAgentsData() {
		loadingAgents = true;
		try {
			const result = await call<{
				active?: Array<{
					runId: string;
					task: string;
					model: string;
					tokens?: number;
					cost?: number;
					startedAt?: number;
				}>;
				history?: Array<{
					runId: string;
					task: string;
					model: string;
					tokens?: number;
					cost?: number;
					completedAt?: number;
				}>;
			}>('agents.list');
			agentsData = result;
			agentsUnavailable = false;
		} catch (err) {
			console.error('Failed to load agents:', err);
			agentsUnavailable = true;
		} finally {
			loadingAgents = false;
		}
	}

	async function stopAgent(runId: string) {
		try {
			await call('agents.stop', { runId });
			addToast('Agent stopped', 'success');
			loadAgentsData();
		} catch (err) {
			addToast('Failed to stop agent', 'error');
			console.error('Failed to stop agent:', err);
		}
	}

	async function restartGateway() {
		try {
			await call('update.run');
			addToast('Gateway restart initiated', 'success');
			showRestartConfirm = false;
		} catch (err) {
			addToast('Failed to restart gateway', 'error');
			console.error('Failed to restart gateway:', err);
		}
	}

	function formatUptime(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ${hours % 24}h`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	}

	function formatTokens(tokens: number): string {
		if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
		if (tokens >= 1000) return `${(tokens / 1000).toFixed(2)}K`;
		return tokens.toString();
	}

	function formatCost(cost: number): string {
		return `$${cost.toFixed(4)}`;
	}

	let sessionUptime = $derived(
		connectionState === 'READY' && connectedAt !== null
			? formatUptime(currentTime - connectedAt)
			: 'N/A'
	);

	let gatewayUptime = $derived(gatewayStatus?.uptime ? formatUptime(gatewayStatus.uptime) : 'N/A');
</script>

<div class="flex flex-col gap-6 p-6">
	<!-- Gateway Status Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Gateway Status</h3>
		{#if loadingStatus}
			<div class="text-sm text-gray-400">Loading...</div>
		{:else if statusUnavailable}
			<dl class="grid grid-cols-2 gap-4 text-sm mb-4">
				<div>
					<dt class="text-gray-400">Connection</dt>
					<dd class="mt-1 font-medium text-white">
						{connectionState === 'READY' ? 'Connected' : 'Disconnected'}
					</dd>
				</div>
				<div>
					<dt class="text-gray-400">URL</dt>
					<dd class="mt-1 font-mono text-xs text-white">{serverInfo?.host || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Session Uptime</dt>
					<dd class="mt-1 font-medium text-white">{sessionUptime}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Server Version</dt>
					<dd class="mt-1 font-medium text-white">{serverInfo?.version || 'N/A'}</dd>
				</div>
			</dl>
			<div class="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
				<p class="text-sm text-yellow-400">
					Extended gateway status requires gateway methods (info.status, info.usage, etc.) that may
					not be available in all gateway versions.
				</p>
			</div>
		{:else}
			<dl class="grid grid-cols-2 gap-4 text-sm">
				<div>
					<dt class="text-gray-400">Connection</dt>
					<dd class="mt-1 font-medium text-white">
						{connectionState === 'READY' ? 'Connected' : 'Disconnected'}
					</dd>
				</div>
				<div>
					<dt class="text-gray-400">URL</dt>
					<dd class="mt-1 font-mono text-xs text-white">{serverInfo?.host || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Session Uptime</dt>
					<dd class="mt-1 font-medium text-white">{sessionUptime}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Gateway Uptime</dt>
					<dd class="mt-1 font-medium text-white">{gatewayUptime}</dd>
				</div>
				<div>
					<dt class="text-gray-400">Current Model</dt>
					<dd class="mt-1 font-medium text-white">{gatewayStatus?.currentModel || 'N/A'}</dd>
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

	<!-- Usage & Costs Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Usage & Costs</h3>
		{#if loadingUsage}
			<div class="text-sm text-gray-400">Loading...</div>
		{:else if usageUnavailable}
			<div class="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
				<p class="text-sm text-yellow-400">
					Usage data requires the info.usage gateway method. This feature may not be available in
					all gateway versions.
				</p>
			</div>
		{:else if usageData?.providers && usageData.providers.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-700">
							<th class="pb-2 text-left font-medium text-gray-400">Provider</th>
							<th class="pb-2 text-right font-medium text-gray-400">Tokens</th>
							<th class="pb-2 text-right font-medium text-gray-400">Cost</th>
						</tr>
					</thead>
					<tbody>
						{#each usageData.providers as provider (provider.name)}
							<tr class="border-b border-gray-700/50">
								<td class="py-2 text-white">{provider.name}</td>
								<td class="py-2 text-right font-mono text-white">{formatTokens(provider.tokens)}</td
								>
								<td class="py-2 text-right font-mono text-white">
									{provider.cost !== undefined ? formatCost(provider.cost) : 'N/A'}
								</td>
							</tr>
						{/each}
						{#if usageData.total}
							<tr class="font-semibold">
								<td class="pt-2 text-white">Total</td>
								<td class="pt-2 text-right font-mono text-white">
									{formatTokens(usageData.total.tokens)}
								</td>
								<td class="pt-2 text-right font-mono text-white">
									{usageData.total.cost !== undefined ? formatCost(usageData.total.cost) : 'N/A'}
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="text-sm text-gray-400">No usage data available</div>
		{/if}
	</div>

	<!-- Nodes Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Paired Nodes</h3>
		{#if loadingNodes}
			<div class="text-sm text-gray-400">Loading...</div>
		{:else if nodesUnavailable}
			<div class="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
				<p class="text-sm text-yellow-400">
					Node data requires the nodes.list gateway method. This feature may not be available in all
					gateway versions.
				</p>
			</div>
		{:else if nodesData.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-700">
							<th class="pb-2 text-left font-medium text-gray-400">Name</th>
							<th class="pb-2 text-left font-medium text-gray-400">Status</th>
							<th class="pb-2 text-left font-medium text-gray-400">Device Type</th>
							<th class="pb-2 text-left font-medium text-gray-400">Capabilities</th>
						</tr>
					</thead>
					<tbody>
						{#each nodesData as node (node.id)}
							<tr class="border-b border-gray-700/50">
								<td class="py-2 text-white">{node.name}</td>
								<td class="py-2">
									<span
										class="inline-block rounded px-2 py-0.5 text-xs {node.status === 'online'
											? 'bg-green-900/50 text-green-400'
											: 'bg-gray-700 text-gray-300'}"
									>
										{node.status}
									</span>
								</td>
								<td class="py-2 text-white">{node.deviceType || 'N/A'}</td>
								<td class="py-2 text-gray-300">
									{node.capabilities && node.capabilities.length > 0
										? node.capabilities.join(', ')
										: 'None'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="text-sm text-gray-400">No paired nodes</div>
		{/if}
	</div>

	<!-- Sub-agents Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Sub-agents</h3>
		{#if loadingAgents}
			<div class="text-sm text-gray-400">Loading...</div>
		{:else if agentsUnavailable}
			<div class="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
				<p class="text-sm text-yellow-400">
					Agent data requires the agents.list gateway method. This feature may not be available in
					all gateway versions.
				</p>
			</div>
		{:else}
			<!-- Active Runs -->
			{#if agentsData?.active && agentsData.active.length > 0}
				<div class="mb-4">
					<h4 class="mb-2 text-sm font-medium text-gray-300">Active Runs</h4>
					<div class="space-y-2">
						{#each agentsData.active as agent (agent.runId)}
							<div class="rounded border border-gray-700 bg-gray-900 p-3">
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium text-white">{agent.task}</div>
										<div class="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
											<span>Model: {agent.model}</span>
											{#if agent.tokens !== undefined}
												<span>Tokens: {formatTokens(agent.tokens)}</span>
											{/if}
											{#if agent.cost !== undefined}
												<span>Cost: {formatCost(agent.cost)}</span>
											{/if}
										</div>
									</div>
									<button
										onclick={() => stopAgent(agent.runId)}
										class="ml-2 rounded bg-red-900/50 px-2 py-1 text-xs text-red-400 hover:bg-red-900"
									>
										Stop
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="mb-4 text-sm text-gray-400">No active agents</div>
			{/if}

			<!-- History -->
			{#if agentsData?.history && agentsData.history.length > 0}
				<div>
					<h4 class="mb-2 text-sm font-medium text-gray-300">Recent History</h4>
					<div class="space-y-2">
						{#each agentsData.history.slice(0, 5) as agent (agent.runId)}
							<div class="rounded border border-gray-700/50 bg-gray-900/50 p-3">
								<div class="text-sm text-white">{agent.task}</div>
								<div class="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
									<span>Model: {agent.model}</span>
									{#if agent.tokens !== undefined}
										<span>Tokens: {formatTokens(agent.tokens)}</span>
									{/if}
									{#if agent.cost !== undefined}
										<span>Cost: {formatCost(agent.cost)}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Restart Gateway -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Gateway Control</h3>
		{#if showRestartConfirm}
			<div class="rounded border border-yellow-700 bg-yellow-900/20 p-3">
				<p class="mb-3 text-sm text-yellow-400">
					Are you sure you want to restart the gateway? All connections will be interrupted.
				</p>
				<div class="flex gap-2">
					<button
						onclick={restartGateway}
						class="rounded bg-red-900/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900"
					>
						Confirm Restart
					</button>
					<button
						onclick={() => (showRestartConfirm = false)}
						class="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<button
				onclick={() => (showRestartConfirm = true)}
				class="rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
			>
				Restart Gateway
			</button>
		{/if}
	</div>
</div>
