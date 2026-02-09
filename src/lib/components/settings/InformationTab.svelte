<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		gatewayStatus,
		usageStats,
		subAgentRuns,
		nodes,
		loadGatewayStatus,
		loadUsageStats,
		loadSubAgentRuns,
		loadNodes,
		restartGateway,
		connectionState,
		gatewayUrl,
		serverVersion
	} from '$lib/stores';
	import type { NodeEntry, SubAgentRun } from '$lib/types/settings';
	import { formatRelativeTime } from '$lib/utils/time';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';
	import LogsViewer from './LogsViewer.svelte';

	let loading = true;
	let showRestartConfirm = false;
	let restarting = false;
	let now = Date.now();

	let refreshInterval: ReturnType<typeof setInterval> | undefined;
	let nowInterval: ReturnType<typeof setInterval> | undefined;

	function formatUptime(ms: number): string {
		if (ms <= 0) return '—';
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	}

	function nodeStatusColor(status: NodeEntry['status']): string {
		switch (status) {
			case 'online':
				return 'bg-green-500';
			case 'offline':
				return 'bg-red-500';
			case 'connecting':
				return 'bg-yellow-500';
			default:
				return 'bg-slate-500';
		}
	}

	function runStatusColor(status: SubAgentRun['status']): string {
		switch (status) {
			case 'running':
				return 'text-blue-400';
			case 'complete':
				return 'text-green-400';
			case 'error':
				return 'text-red-400';
			default:
				return 'text-slate-400';
		}
	}

	function formatTokens(count: number): string {
		if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
		if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
		return count.toString();
	}

	async function loadAllData(): Promise<void> {
		await Promise.all([loadGatewayStatus(), loadNodes(), loadSubAgentRuns()]);
	}

	async function handleRestart(): Promise<void> {
		showRestartConfirm = false;
		restarting = true;
		try {
			await restartGateway();
		} catch {
			// Restart may disconnect us — that's expected
		} finally {
			restarting = false;
		}
	}

	$: activeRuns = $subAgentRuns.filter((r) => r.status === 'running');
	$: completedRuns = $subAgentRuns.filter((r) => r.status !== 'running');

	onMount(async () => {
		await loadAllData();
		loading = false;

		// Auto-refresh every 30s
		refreshInterval = setInterval(() => {
			loadGatewayStatus();
			loadUsageStats();
			loadSubAgentRuns();
		}, 30_000);

		nowInterval = setInterval(() => {
			now = Date.now();
		}, 30_000);
	});

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
		if (nowInterval) clearInterval(nowInterval);
	});
</script>

<div class="space-y-6 overflow-y-auto p-6">
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<p class="text-sm text-slate-400">Loading information...</p>
		</div>
	{:else}
		<!-- Gateway Status Section -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Gateway Status
				</h2>
				<button
					on:click={() => (showRestartConfirm = true)}
					disabled={restarting}
					class="rounded bg-slate-700 px-3 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-600 disabled:opacity-50"
				>
					{restarting ? 'Restarting...' : 'Restart'}
				</button>
			</div>
			<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
				<div>
					<dt class="text-xs text-slate-400">Connection</dt>
					<dd class="mt-0.5 text-sm font-medium text-slate-200">
						<span
							class="mr-1.5 inline-block h-2 w-2 rounded-full {$connectionState === 'READY'
								? 'bg-green-500'
								: $connectionState === 'RECONNECTING' || $connectionState === 'CONNECTING'
									? 'bg-yellow-500'
									: 'bg-red-500'}"
						></span>
						{$connectionState}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-400">Gateway URL</dt>
					<dd class="mt-0.5 truncate text-sm font-medium text-slate-200">
						{$gatewayUrl || $gatewayStatus.url || '—'}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-400">Uptime</dt>
					<dd class="mt-0.5 text-sm font-medium text-slate-200">
						{formatUptime($gatewayStatus.uptimeMs)}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-400">Model</dt>
					<dd class="mt-0.5 text-sm font-medium text-slate-200">
						{$gatewayStatus.model || '—'}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-400">Server Version</dt>
					<dd class="mt-0.5 text-sm font-medium text-slate-200">
						{$serverVersion || $gatewayStatus.serverVersion || '—'}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-400">Sessions</dt>
					<dd class="mt-0.5 text-sm font-medium text-slate-200">
						{$gatewayStatus.sessionCount}
					</dd>
				</div>
			</div>
		</section>

		<!-- Usage Section -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-4 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Token Usage</h2>
			</div>
			<div class="p-4">
				{#if $usageStats.providers.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-slate-700 text-left text-xs text-slate-400">
									<th class="pb-2 pr-4">Provider</th>
									<th class="pb-2 pr-4 text-right">Input</th>
									<th class="pb-2 pr-4 text-right">Output</th>
									<th class="pb-2 pr-4 text-right">Cache</th>
									{#if $usageStats.totalEstimatedCost != null}
										<th class="pb-2 text-right">Est. Cost</th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each $usageStats.providers as provider (provider.provider)}
									<tr class="border-b border-slate-700/50">
										<td class="py-2 pr-4 text-slate-200">{provider.provider}</td>
										<td class="py-2 pr-4 text-right text-slate-300">
											{formatTokens(provider.inputTokens)}
										</td>
										<td class="py-2 pr-4 text-right text-slate-300">
											{formatTokens(provider.outputTokens)}
										</td>
										<td class="py-2 pr-4 text-right text-slate-300">
											{formatTokens(provider.cacheTokens)}
										</td>
										{#if $usageStats.totalEstimatedCost != null}
											<td class="py-2 text-right text-slate-300">
												{provider.estimatedCost != null
													? `$${provider.estimatedCost.toFixed(4)}`
													: '—'}
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="font-medium">
									<td class="pt-2 pr-4 text-slate-200">Total</td>
									<td class="pt-2 pr-4 text-right text-slate-200">
										{formatTokens($usageStats.totalInputTokens)}
									</td>
									<td class="pt-2 pr-4 text-right text-slate-200">
										{formatTokens($usageStats.totalOutputTokens)}
									</td>
									<td class="pt-2 pr-4 text-right text-slate-200">
										{formatTokens($usageStats.totalCacheTokens)}
									</td>
									{#if $usageStats.totalEstimatedCost != null}
										<td class="pt-2 text-right text-slate-200">
											${$usageStats.totalEstimatedCost.toFixed(4)}
										</td>
									{/if}
								</tr>
							</tfoot>
						</table>
					</div>
				{:else}
					<p class="text-sm text-slate-500">No usage data available yet.</p>
				{/if}
			</div>
		</section>

		<!-- Nodes Section -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-4 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Paired Nodes</h2>
			</div>
			<div class="p-4">
				{#if $nodes.length > 0}
					<div class="space-y-3">
						{#each $nodes as node (node.id)}
							<div
								class="flex items-start justify-between rounded border border-slate-700/50 bg-slate-800 px-4 py-3"
							>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-2 w-2 flex-shrink-0 rounded-full {nodeStatusColor(
												node.status
											)}"
										></span>
										<span class="text-sm font-medium text-slate-200">{node.name}</span>
										<span class="text-xs capitalize text-slate-400">{node.status}</span>
									</div>
									{#if node.capabilities.models && node.capabilities.models.length > 0}
										<p class="mt-1 text-xs text-slate-400">
											Models: {node.capabilities.models.join(', ')}
										</p>
									{/if}
									{#if node.capabilities.tools && node.capabilities.tools.length > 0}
										<p class="mt-0.5 text-xs text-slate-500">
											Tools: {node.capabilities.tools.length} available
										</p>
									{/if}
								</div>
								<div class="ml-4 flex-shrink-0 text-right">
									{#if node.version}
										<p class="text-xs text-slate-400">v{node.version}</p>
									{/if}
									{#if node.lastSeen}
										<p class="mt-0.5 text-xs text-slate-500">
											{formatRelativeTime(node.lastSeen, now)}
										</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-slate-500">No paired nodes.</p>
				{/if}
			</div>
		</section>

		<!-- Sub-Agents Section -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-4 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Sub-Agent Runs
				</h2>
			</div>
			<div class="p-4">
				{#if activeRuns.length > 0}
					<div class="mb-4">
						<h3 class="mb-2 text-xs font-medium text-slate-400">Active</h3>
						<div class="space-y-2">
							{#each activeRuns as run (run.runId)}
								<div
									class="flex items-center justify-between rounded border border-blue-800/30 bg-blue-900/10 px-3 py-2"
								>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-slate-200">{run.task}</p>
										<p class="mt-0.5 text-xs text-slate-400">
											{run.model || 'default'}
											{#if run.startedAt}
												&middot; started {formatRelativeTime(run.startedAt, now)}
											{/if}
										</p>
									</div>
									<span class="ml-3 flex-shrink-0 text-xs {runStatusColor(run.status)}">
										{run.status}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if completedRuns.length > 0}
					<div>
						<h3 class="mb-2 text-xs font-medium text-slate-400">Recent</h3>
						<div class="space-y-2">
							{#each completedRuns.slice(0, 10) as run (run.runId)}
								<div
									class="flex items-center justify-between rounded border border-slate-700/50 px-3 py-2"
								>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-slate-200">{run.task}</p>
										<p class="mt-0.5 text-xs text-slate-400">
											{run.model || 'default'}
											{#if run.durationMs}
												&middot; {(run.durationMs / 1000).toFixed(1)}s
											{/if}
										</p>
									</div>
									<span class="ml-3 flex-shrink-0 text-xs {runStatusColor(run.status)}">
										{run.status}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{:else if activeRuns.length === 0}
					<p class="text-sm text-slate-500">No sub-agent runs recorded.</p>
				{/if}
			</div>
		</section>

		<!-- Live Logs Section -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-4 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Live Logs</h2>
			</div>
			<div class="h-80">
				<LogsViewer />
			</div>
		</section>
	{/if}
</div>

<ConfirmDialog
	title="Restart Gateway"
	message="This will restart the OpenClaw gateway. Active connections will be briefly interrupted."
	confirmLabel="Restart"
	open={showRestartConfirm}
	on:confirm={handleRestart}
	on:cancel={() => (showRestartConfirm = false)}
/>
