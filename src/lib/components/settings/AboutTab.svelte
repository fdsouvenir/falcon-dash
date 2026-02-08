<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { gatewayStatus, loadGatewayStatus, serverVersion } from '$lib/stores';

	let loading = true;
	let now = Date.now();
	let nowInterval: ReturnType<typeof setInterval> | undefined;

	const dashboardVersion = '0.1.0';

	function formatUptime(ms: number): string {
		if (ms <= 0) return '\u2014';
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	}

	onMount(async () => {
		try {
			await loadGatewayStatus();
		} catch {
			// Status unavailable
		} finally {
			loading = false;
		}
		nowInterval = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (nowInterval) clearInterval(nowInterval);
	});
</script>

<div class="space-y-6 overflow-y-auto p-6">
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
			/>
			<span class="ml-3 text-sm text-slate-400">Loading...</span>
		</div>
	{:else}
		<!-- Agent Identity -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-5 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Agent Identity
				</h2>
			</div>
			<div class="p-5">
				<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-xs font-medium uppercase tracking-wider text-slate-500">Agent Name</dt>
						<dd class="mt-1 text-sm text-slate-200">
							{$gatewayStatus.model ?? 'OpenClaw Agent'}
						</dd>
					</div>
					<div>
						<dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
							Connection ID
						</dt>
						<dd class="mt-1 font-mono text-sm text-slate-200">
							{$gatewayStatus.connId || '\u2014'}
						</dd>
					</div>
				</dl>
			</div>
		</section>

		<!-- Version Information -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-5 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Version Information
				</h2>
			</div>
			<div class="p-5">
				<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
							Dashboard Version
						</dt>
						<dd class="mt-1 text-sm text-slate-200">
							v{dashboardVersion}
						</dd>
					</div>
					<div>
						<dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
							Gateway Version
						</dt>
						<dd class="mt-1 text-sm text-slate-200">
							{$serverVersion || $gatewayStatus.serverVersion || '\u2014'}
						</dd>
					</div>
					<div>
						<dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
							Protocol Version
						</dt>
						<dd class="mt-1 text-sm text-slate-200">3</dd>
					</div>
				</dl>
			</div>
		</section>

		<!-- System Status -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-5 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">System Status</h2>
			</div>
			<div class="p-5">
				<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<dt class="text-xs font-medium uppercase tracking-wider text-slate-500">Uptime</dt>
						<dd class="mt-1 text-sm text-slate-200">
							{formatUptime($gatewayStatus.uptimeMs)}
						</dd>
					</div>
					<div>
						<dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
							Connection State
						</dt>
						<dd class="mt-1 flex items-center gap-2 text-sm text-slate-200">
							<span
								class="inline-block h-2 w-2 rounded-full {$gatewayStatus.connectionState ===
									'connected' || $gatewayStatus.connectionState === 'READY'
									? 'bg-green-500'
									: $gatewayStatus.connectionState === 'connecting' ||
										  $gatewayStatus.connectionState === 'CONNECTING'
										? 'bg-yellow-500'
										: 'bg-red-500'}"
							/>
							{$gatewayStatus.connectionState}
						</dd>
					</div>
					<div>
						<dt class="text-xs font-medium uppercase tracking-wider text-slate-500">
							Active Sessions
						</dt>
						<dd class="mt-1 text-sm text-slate-200">
							{$gatewayStatus.sessionCount}
						</dd>
					</div>
				</dl>
			</div>
		</section>

		<!-- About -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="p-5">
				<p class="text-center text-sm text-slate-400">
					<strong class="text-slate-300">Falcon Dash</strong> &mdash; OpenClaw Control UI
				</p>
				<p class="mt-1 text-center text-xs text-slate-500">
					Built with SvelteKit, Tailwind CSS, and WebSocket
				</p>
			</div>
		</section>
	{/if}
</div>
