<script lang="ts">
	import { connection, snapshot, call } from '$lib/stores/gateway.js';
	import type { ConnectionState, HelloOkPayload } from '$lib/gateway/types.js';
	import type { PresenceEntry, SessionDefaults } from '$lib/gateway/snapshot-store.js';
	import { addToast } from '$lib/stores/toast.js';

	let connectionState = $state<ConnectionState>('DISCONNECTED');
	let helloOk = $state<HelloOkPayload | null>(null);
	let serverInfo = $state<{ version: string; host: string; connId: string } | null>(null);
	let sessionDefaults = $state<SessionDefaults>({});
	let policy = $state<{
		maxPayload: number;
		maxBufferedBytes: number;
		tickIntervalMs: number;
	} | null>(null);
	let features = $state<string[]>([]);
	let presence = $state<PresenceEntry[]>([]);
	let connectedAt = $state<number | null>(null);
	let currentTime = $state(Date.now());

	// RPC supplementary data
	let gatewayStatus = $state<{
		uptime?: number;
		currentModel?: string;
		sessionCount?: number;
	} | null>(null);
	let usageData = $state<{
		providers?: Array<{ name: string; tokens: number; cost?: number }>;
		total?: { tokens: number; cost?: number };
	} | null>(null);
	let nodesData = $state<
		Array<{
			id: string;
			name: string;
			status: string;
			capabilities?: string[];
			deviceType?: string;
		}>
	>([]);
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

	let loadingRpc = $state(false);
	let showRestartConfirm = $state(false);
	let rpcErrors = $state<string[]>([]);

	// Subscribe to stores
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
			helloOk = h;
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
		const unsub = snapshot.sessionDefaults.subscribe((s) => {
			sessionDefaults = s;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = snapshot.policy.subscribe((p) => {
			policy = p;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = snapshot.features.subscribe((f) => {
			features = f;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = snapshot.presence.subscribe((p) => {
			presence = p;
		});
		return unsub;
	});

	$effect(() => {
		const interval = setInterval(() => {
			currentTime = Date.now();
		}, 1000);
		return () => clearInterval(interval);
	});

	// Load RPC data when ready
	$effect(() => {
		if (connectionState === 'READY') {
			loadRpcData();
		}
	});

	async function loadRpcData() {
		loadingRpc = true;
		rpcErrors = [];
		const errors: string[] = [];

		await Promise.allSettled([
			call<{ uptime?: number; model?: string; sessions?: number }>('info.status')
				.then((r) => {
					gatewayStatus = { uptime: r.uptime, currentModel: r.model, sessionCount: r.sessions };
				})
				.catch(() => errors.push('info.status')),
			call<{
				providers?: Array<{ name: string; tokens: number; cost?: number }>;
				total?: { tokens: number; cost?: number };
			}>('info.usage')
				.then((r) => {
					usageData = r;
				})
				.catch(() => errors.push('info.usage')),
			call<{
				nodes: Array<{
					id: string;
					name: string;
					status: string;
					capabilities?: string[];
					deviceType?: string;
				}>;
			}>('nodes.list')
				.then((r) => {
					nodesData = r.nodes || [];
				})
				.catch(() => errors.push('nodes.list')),
			call<{
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
			}>('agents.list')
				.then((r) => {
					agentsData = r;
				})
				.catch(() => errors.push('agents.list'))
		]);

		rpcErrors = errors;
		loadingRpc = false;
	}

	async function stopAgent(runId: string) {
		try {
			await call('agents.stop', { runId });
			addToast('Agent stopped', 'success');
			loadRpcData();
		} catch {
			addToast('Failed to stop agent', 'error');
		}
	}

	async function restartGateway() {
		try {
			await call('update.run');
			addToast('Gateway restart initiated', 'success');
			showRestartConfirm = false;
		} catch {
			addToast('Failed to restart gateway', 'error');
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

	function formatBytes(bytes: number): string {
		if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
		if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${bytes} B`;
	}

	function formatTokens(tokens: number): string {
		if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
		if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
		return tokens.toString();
	}

	function formatCost(cost: number): string {
		return `$${cost.toFixed(4)}`;
	}

	// Derived values from hello-ok (no RPC needed)
	let isConnected = $derived(connectionState === 'READY');
	let authRole = $derived(helloOk?.auth?.role ?? null);
	let authScopes = $derived(helloOk?.auth?.scopes ?? []);
	let uptimeMs = $derived(helloOk?.snapshot?.uptimeMs ?? null);
	let configPath = $derived(helloOk?.snapshot?.configPath ?? null);
	let stateDir = $derived(helloOk?.snapshot?.stateDir ?? null);
	let protocolVersion = $derived(helloOk?.protocol ?? null);

	let sessionUptime = $derived(
		isConnected && connectedAt !== null ? formatUptime(currentTime - connectedAt) : null
	);

	let gatewayUptime = $derived(
		uptimeMs != null ? formatUptime(uptimeMs + (currentTime - (connectedAt ?? currentTime))) : null
	);

	let deviceCount = $derived(presence.length);

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
</script>

<div class="flex flex-col gap-5 p-4 sm:p-6">
	<!-- Connection Status Header -->
	<div
		class="relative overflow-hidden rounded-lg border border-gray-700/80 bg-gradient-to-r from-gray-800/90 to-gray-800/50"
	>
		<div
			class="absolute inset-0 opacity-[0.03]"
			style="background-image: repeating-linear-gradient(90deg, transparent, transparent 40px, currentColor 40px, currentColor 41px), repeating-linear-gradient(0deg, transparent, transparent 40px, currentColor 40px, currentColor 41px)"
		></div>
		<div class="relative flex items-center gap-4 px-4 py-3.5 sm:px-5">
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
					{#if protocolVersion}
						<span class="text-gray-600">|</span>
						<span>proto {protocolVersion}</span>
					{/if}
				</div>
			{/if}
			{#if gatewayUptime}
				<div class="ml-auto text-xs text-gray-400">
					<span class="text-gray-500">up</span>
					<span class="ml-1 font-mono text-gray-300">{gatewayUptime}</span>
				</div>
			{/if}
		</div>
		{#if serverInfo}
			<div
				class="flex items-center gap-3 border-t border-gray-700/40 px-4 py-2 text-xs text-gray-400 sm:hidden"
			>
				<span class="font-mono">{serverInfo.host}</span>
				<span class="text-gray-600">|</span>
				<span>v{serverInfo.version}</span>
			</div>
		{/if}
	</div>

	<!-- Metric Tiles -->
	{#if isConnected}
		<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
			<div class="rounded-lg border border-gray-700/60 bg-gray-800/60 px-3 py-2.5">
				<div class="text-[10px] font-medium uppercase tracking-widest text-gray-500">Model</div>
				<div class="mt-0.5 truncate font-mono text-sm text-gray-100">
					{gatewayStatus?.currentModel || sessionDefaults.model || '--'}
				</div>
			</div>
			<div class="rounded-lg border border-gray-700/60 bg-gray-800/60 px-3 py-2.5">
				<div class="text-[10px] font-medium uppercase tracking-widest text-gray-500">Thinking</div>
				<div class="mt-0.5 font-mono text-sm text-gray-100">
					{sessionDefaults.thinkingLevel || '--'}
				</div>
			</div>
			<div class="rounded-lg border border-gray-700/60 bg-gray-800/60 px-3 py-2.5">
				<div class="text-[10px] font-medium uppercase tracking-widest text-gray-500">Devices</div>
				<div class="mt-0.5 font-mono text-sm text-gray-100">{deviceCount}</div>
			</div>
			<div class="rounded-lg border border-gray-700/60 bg-gray-800/60 px-3 py-2.5">
				<div class="text-[10px] font-medium uppercase tracking-widest text-gray-500">Session</div>
				<div class="mt-0.5 font-mono text-sm text-gray-100">{sessionUptime || '--'}</div>
			</div>
		</div>
	{/if}

	<!-- Auth & Session Defaults -->
	{#if isConnected}
		<div class="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
			<!-- Auth & Scopes -->
			<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3.5">
				<h3 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
					Auth & Scopes
				</h3>
				{#if authRole}
					<div class="mb-2 flex items-center gap-2">
						<span class="text-xs text-gray-400">Role</span>
						<span class="rounded bg-gray-700/80 px-1.5 py-0.5 font-mono text-xs text-gray-200">
							{authRole}
						</span>
					</div>
				{/if}
				{#if authScopes.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each authScopes as scope (scope)}
							<span
								class="rounded border border-gray-600/50 bg-gray-700/40 px-1.5 py-0.5 text-[11px] text-gray-300"
							>
								{scope}
							</span>
						{/each}
					</div>
				{:else}
					<div class="text-xs text-gray-500">No scopes</div>
				{/if}
			</div>

			<!-- Session Defaults -->
			<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3.5">
				<h3 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
					Session Defaults
				</h3>
				<div class="space-y-1.5 text-xs">
					<div class="flex justify-between">
						<span class="text-gray-400">Context tokens</span>
						<span class="font-mono text-gray-200">
							{sessionDefaults.contextTokens != null
								? sessionDefaults.contextTokens.toLocaleString()
								: '--'}
						</span>
					</div>
					{#if sessionDefaults.defaultAgentId}
						<div class="flex justify-between">
							<span class="text-gray-400">Default agent</span>
							<span class="font-mono text-gray-200">{sessionDefaults.defaultAgentId}</span>
						</div>
					{/if}
					{#each Object.entries(sessionDefaults).filter(([k]) => !['model', 'contextTokens', 'thinkingLevel', 'defaultAgentId'].includes(k)) as [key, value] (key)}
						<div class="flex justify-between">
							<span class="text-gray-400">{key}</span>
							<span class="truncate pl-2 font-mono text-gray-200">{value}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Policy & Paths -->
	{#if isConnected}
		<div class="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
			<!-- Policy -->
			<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3.5">
				<h3 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
					Policy
				</h3>
				<div class="space-y-1.5 text-xs">
					{#if policy}
						<div class="flex justify-between">
							<span class="text-gray-400">Max payload</span>
							<span class="font-mono text-gray-200">{formatBytes(policy.maxPayload)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">Max buffered</span>
							<span class="font-mono text-gray-200">{formatBytes(policy.maxBufferedBytes)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">Tick interval</span>
							<span class="font-mono text-gray-200">{policy.tickIntervalMs}ms</span>
						</div>
					{:else}
						<div class="text-gray-500">--</div>
					{/if}
				</div>
			</div>

			<!-- Server Paths -->
			<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3.5">
				<h3 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
					Server Paths
				</h3>
				<div class="space-y-1.5 text-xs">
					{#if configPath}
						<div>
							<span class="text-gray-400">Config</span>
							<div class="mt-0.5 truncate font-mono text-gray-300" title={configPath}>
								{configPath}
							</div>
						</div>
					{/if}
					{#if stateDir}
						<div>
							<span class="text-gray-400">State dir</span>
							<div class="mt-0.5 truncate font-mono text-gray-300" title={stateDir}>
								{stateDir}
							</div>
						</div>
					{/if}
					{#if serverInfo?.connId}
						<div>
							<span class="text-gray-400">Connection ID</span>
							<div class="mt-0.5 truncate font-mono text-gray-300">{serverInfo.connId}</div>
						</div>
					{/if}
					{#if !configPath && !stateDir && !serverInfo?.connId}
						<div class="text-gray-500">--</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Connected Devices -->
	{#if isConnected && presence.length > 0}
		<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3.5">
			<h3 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
				Connected Devices
				<span class="ml-1.5 font-mono text-gray-400">{presence.length}</span>
			</h3>
			<div class="space-y-1">
				{#each presence as device (device.instanceId)}
					<div
						class="flex items-center gap-2.5 rounded border border-gray-700/30 bg-gray-900/40 px-2.5 py-1.5"
					>
						<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
						<span class="min-w-0 flex-1 truncate text-xs text-gray-200">
							{device.displayName || device.instanceId}
						</span>
						{#if device.deviceType}
							<span class="text-[11px] text-gray-500">{device.deviceType}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Available Methods -->
	{#if isConnected && features.length > 0}
		<details class="group rounded-lg border border-gray-700/60 bg-gray-800/40">
			<summary
				class="flex cursor-pointer items-center justify-between px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500 select-none"
			>
				<span>
					Available Methods
					<span class="ml-1.5 font-mono text-gray-400">{features.length}</span>
				</span>
				<svg
					class="h-3.5 w-3.5 text-gray-500 transition-transform group-open:rotate-180"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
				</svg>
			</summary>
			<div class="flex flex-wrap gap-1 border-t border-gray-700/40 px-3.5 py-2.5">
				{#each features as method (method)}
					<span
						class="rounded border border-gray-600/30 bg-gray-900/50 px-1.5 py-0.5 font-mono text-[11px] text-gray-400"
					>
						{method}
					</span>
				{/each}
			</div>
		</details>
	{/if}

	<!-- RPC Supplementary Data -->
	{#if isConnected}
		<div class="border-t border-gray-700/40 pt-4">
			<div class="mb-3 flex items-center gap-2">
				<h3 class="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
					Extended Data
				</h3>
				{#if loadingRpc}
					<div
						class="h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-gray-300"
					></div>
				{:else}
					<button
						onclick={loadRpcData}
						class="rounded p-0.5 text-gray-500 transition-colors hover:text-gray-300"
						title="Refresh"
					>
						<svg
							class="h-3 w-3"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</button>
				{/if}
				{#if rpcErrors.length > 0}
					<span class="text-[10px] text-gray-500" title={rpcErrors.join(', ')}>
						{rpcErrors.length} method{rpcErrors.length === 1 ? '' : 's'} unavailable
					</span>
				{/if}
			</div>

			<div class="space-y-2.5">
				<!-- Usage Table -->
				{#if usageData?.providers && usageData.providers.length > 0}
					<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3.5">
						<h4 class="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
							Usage & Costs
						</h4>
						<div class="overflow-x-auto">
							<table class="w-full text-xs">
								<thead>
									<tr class="border-b border-gray-700/60">
										<th class="pb-1.5 text-left font-medium text-gray-500">Provider</th>
										<th class="pb-1.5 text-right font-medium text-gray-500">Tokens</th>
										<th class="pb-1.5 text-right font-medium text-gray-500">Cost</th>
									</tr>
								</thead>
								<tbody>
									{#each usageData.providers as provider (provider.name)}
										<tr class="border-b border-gray-700/30">
											<td class="py-1.5 text-gray-200">{provider.name}</td>
											<td class="py-1.5 text-right font-mono text-gray-300">
												{formatTokens(provider.tokens)}
											</td>
											<td class="py-1.5 text-right font-mono text-gray-300">
												{provider.cost !== undefined ? formatCost(provider.cost) : '--'}
											</td>
										</tr>
									{/each}
									{#if usageData.total}
										<tr class="font-medium">
											<td class="pt-1.5 text-gray-100">Total</td>
											<td class="pt-1.5 text-right font-mono text-gray-100">
												{formatTokens(usageData.total.tokens)}
											</td>
											<td class="pt-1.5 text-right font-mono text-gray-100">
												{usageData.total.cost !== undefined
													? formatCost(usageData.total.cost)
													: '--'}
											</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					</div>
				{/if}

				<!-- Nodes -->
				{#if nodesData.length > 0}
					<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3.5">
						<h4 class="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
							Paired Nodes
							<span class="ml-1 font-mono text-gray-400">{nodesData.length}</span>
						</h4>
						<div class="space-y-1">
							{#each nodesData as node (node.id)}
								<div
									class="flex items-center gap-2.5 rounded border border-gray-700/30 bg-gray-900/40 px-2.5 py-1.5"
								>
									<span
										class="h-1.5 w-1.5 rounded-full {node.status === 'online'
											? 'bg-emerald-400'
											: 'bg-gray-500'}"
									></span>
									<span class="min-w-0 flex-1 truncate text-xs text-gray-200">
										{node.name}
									</span>
									{#if node.deviceType}
										<span class="text-[11px] text-gray-500">{node.deviceType}</span>
									{/if}
									{#if node.capabilities && node.capabilities.length > 0}
										<span class="hidden text-[11px] text-gray-500 sm:inline">
											{node.capabilities.join(', ')}
										</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Agents -->
				{#if agentsData?.active && agentsData.active.length > 0}
					<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-3.5">
						<h4 class="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
							Active Agents
							<span class="ml-1 font-mono text-gray-400">{agentsData.active.length}</span>
						</h4>
						<div class="space-y-1.5">
							{#each agentsData.active as agent (agent.runId)}
								<div
									class="flex items-start justify-between rounded border border-gray-700/30 bg-gray-900/40 px-2.5 py-2"
								>
									<div class="min-w-0 flex-1">
										<div class="truncate text-xs text-gray-200">{agent.task}</div>
										<div class="mt-0.5 flex flex-wrap gap-2 text-[11px] text-gray-500">
											<span class="font-mono">{agent.model}</span>
											{#if agent.tokens !== undefined}
												<span class="font-mono">{formatTokens(agent.tokens)} tok</span>
											{/if}
											{#if agent.cost !== undefined}
												<span class="font-mono">{formatCost(agent.cost)}</span>
											{/if}
										</div>
									</div>
									<button
										onclick={() => stopAgent(agent.runId)}
										class="ml-2 rounded bg-red-900/40 px-1.5 py-0.5 text-[11px] text-red-400 transition-colors hover:bg-red-900/70"
									>
										Stop
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if agentsData?.history && agentsData.history.length > 0}
					<details class="group rounded-lg border border-gray-700/60 bg-gray-800/40">
						<summary
							class="flex cursor-pointer items-center justify-between px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500 select-none"
						>
							<span>
								Agent History
								<span class="ml-1 font-mono text-gray-400">{agentsData.history.length}</span>
							</span>
							<svg
								class="h-3.5 w-3.5 text-gray-500 transition-transform group-open:rotate-180"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
							</svg>
						</summary>
						<div class="space-y-1 border-t border-gray-700/40 px-3.5 py-2.5">
							{#each agentsData.history.slice(0, 10) as agent (agent.runId)}
								<div
									class="flex items-center gap-2 rounded border border-gray-700/20 bg-gray-900/30 px-2.5 py-1.5"
								>
									<div class="min-w-0 flex-1 truncate text-xs text-gray-400">
										{agent.task}
									</div>
									<span class="whitespace-nowrap font-mono text-[11px] text-gray-500">
										{agent.model}
									</span>
								</div>
							{/each}
						</div>
					</details>
				{/if}

				<!-- Sessions from RPC -->
				{#if gatewayStatus?.sessionCount != null}
					<div
						class="flex items-center justify-between rounded-lg border border-gray-700/60 bg-gray-800/40 px-3.5 py-2.5"
					>
						<span class="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
							Active Sessions
						</span>
						<span class="font-mono text-sm text-gray-200">
							{gatewayStatus.sessionCount}
						</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Disconnected State -->
	{#if !isConnected && connectionState !== 'CONNECTING' && connectionState !== 'AUTHENTICATING' && connectionState !== 'RECONNECTING'}
		<div
			class="flex flex-col items-center justify-center gap-3 rounded-lg border border-gray-700/40 bg-gray-800/20 py-12"
		>
			<div class="h-8 w-8 rounded-full border-2 border-gray-700 bg-gray-800 p-1.5">
				<svg
					class="h-full w-full text-gray-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15.536 8.464a5 5 0 010 7.072M8.464 15.536a5 5 0 010-7.072"
					/>
				</svg>
			</div>
			<div class="text-sm text-gray-400">Not connected to gateway</div>
		</div>
	{/if}

	<!-- Gateway Control -->
	{#if isConnected}
		<div class="border-t border-gray-700/40 pt-4">
			{#if showRestartConfirm}
				<div class="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3">
					<p class="mb-2.5 text-xs text-amber-400/90">
						Restart the gateway? All active connections will be interrupted.
					</p>
					<div class="flex gap-2">
						<button
							onclick={restartGateway}
							class="rounded bg-red-900/50 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/80"
						>
							Confirm Restart
						</button>
						<button
							onclick={() => (showRestartConfirm = false)}
							class="rounded bg-gray-700/60 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<button
					onclick={() => (showRestartConfirm = true)}
					class="rounded bg-gray-700/50 px-3.5 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
				>
					Restart Gateway
				</button>
			{/if}
		</div>
	{/if}
</div>
