<script lang="ts">
	import { canvasStore } from '$lib/stores/canvas.js';
	import { diagnosticLog } from '$lib/stores/diagnostics.js';
	import { getLoadedTier } from '$lib/canvas/a2ui-bridge.js';
	import { pinnedApps } from '$lib/stores/pinned-apps.js';
	import type { CanvasSurface, BridgeStatus } from '$lib/stores/canvas.js';
	import type { DiagnosticEvent } from '$lib/stores/diagnostic-log.js';
	import type { PinnedApp } from '$lib/stores/pinned-apps.js';

	let bridgeStatus = $state<BridgeStatus>({ registered: false });
	let canvasHostUrl = $state<string | null>(null);
	let surfaces = $state<Map<string, CanvasSurface>>(new Map());
	let allDiagEntries = $state<DiagnosticEvent[]>([]);
	let pins = $state<PinnedApp[]>([]);

	// Reachability probe
	let probeStatus = $state<'idle' | 'checking' | 'ok' | 'fail'>('idle');
	let probeError = $state<string | null>(null);

	$effect(() => {
		const unsub = canvasStore.bridgeStatus.subscribe((s) => {
			bridgeStatus = s;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = canvasStore.canvasHostBaseUrl.subscribe((u) => {
			canvasHostUrl = u;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = canvasStore.surfaces.subscribe((s) => {
			surfaces = s;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = diagnosticLog.entries.subscribe((entries) => {
			allDiagEntries = entries;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = pinnedApps.subscribe((a) => {
			pins = a;
		});
		return unsub;
	});

	// Canvas events filtered from diagnostic log
	let canvasEvents = $derived(allDiagEntries.filter((e) => e.category === 'canvas').slice(-20));

	// Surface list
	let surfaceList = $derived(Array.from(surfaces.values()));

	// A2UI bundle tier
	let bundleTier = $derived(getLoadedTier());

	async function probeCanvasHost() {
		if (!canvasHostUrl) return;
		probeStatus = 'checking';
		probeError = null;
		try {
			const bundleUrl = `${canvasHostUrl}/a2ui/a2ui.bundle.js`;
			const res = await fetch(bundleUrl, { method: 'HEAD', mode: 'no-cors' });
			// no-cors means opaque response — status 0 is expected for success
			if (res.status === 0 || res.ok) {
				probeStatus = 'ok';
			} else {
				probeStatus = 'fail';
				probeError = `HTTP ${res.status}`;
			}
		} catch (err) {
			probeStatus = 'fail';
			probeError = String(err);
		}
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatDateTime(ts: number): string {
		return new Date(ts).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	function getLevelColor(level: string): string {
		switch (level) {
			case 'debug':
				return 'text-status-muted';
			case 'info':
				return 'text-blue-400';
			case 'warn':
				return 'text-yellow-400';
			case 'error':
				return 'text-red-400';
			default:
				return 'text-status-muted';
		}
	}
</script>

<div class="flex flex-col gap-6 p-6">
	<!-- Bridge Status -->
	<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Canvas Bridge</h3>
		<dl class="grid grid-cols-2 gap-4 text-sm">
			<div>
				<dt class="text-status-muted">Status</dt>
				<dd class="mt-1">
					{#if bridgeStatus.registered}
						<span
							class="inline-flex items-center gap-1.5 rounded bg-green-900/50 px-2 py-0.5 text-xs text-green-400"
						>
							<span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
							Registered
						</span>
					{:else}
						<span
							class="inline-flex items-center gap-1.5 rounded bg-surface-3 px-2 py-0.5 text-xs text-white/70"
						>
							<span class="h-1.5 w-1.5 rounded-full bg-status-muted"></span>
							Not Registered
						</span>
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-status-muted">Node ID</dt>
				<dd class="mt-1 font-mono text-xs text-white">
					{bridgeStatus.nodeId ?? 'N/A'}
				</dd>
			</div>
			{#if bridgeStatus.error}
				<div class="col-span-2">
					<dt class="text-status-muted">Error</dt>
					<dd class="mt-1 text-sm text-red-400">{bridgeStatus.error}</dd>
				</div>
			{/if}
		</dl>
	</div>

	<!-- Canvas Host & Bundle -->
	<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Canvas Host</h3>
		<dl class="grid grid-cols-2 gap-4 text-sm">
			<div>
				<dt class="text-status-muted">Host URL</dt>
				<dd class="mt-1 font-mono text-xs text-white">
					{canvasHostUrl ?? 'Not set'}
				</dd>
			</div>
			<div>
				<dt class="text-status-muted">Reachability</dt>
				<dd class="mt-1 flex items-center gap-2">
					{#if probeStatus === 'idle'}
						<button
							onclick={probeCanvasHost}
							class="rounded bg-surface-3 px-2 py-0.5 text-xs text-white/70 hover:bg-surface-3"
						>
							Check
						</button>
					{:else if probeStatus === 'checking'}
						<span class="text-xs text-status-muted">Checking...</span>
					{:else if probeStatus === 'ok'}
						<span class="text-xs text-green-400">Reachable</span>
						<button
							onclick={probeCanvasHost}
							class="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-status-muted hover:bg-surface-3"
						>
							Retry
						</button>
					{:else}
						<span class="text-xs text-red-400">Unreachable</span>
						{#if probeError}
							<span class="text-xs text-status-muted">({probeError})</span>
						{/if}
						<button
							onclick={probeCanvasHost}
							class="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-status-muted hover:bg-surface-3"
						>
							Retry
						</button>
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-status-muted">A2UI Bundle Tier</dt>
				<dd class="mt-1">
					<span
						class="inline-block rounded px-2 py-0.5 text-xs {bundleTier === 'not-loaded'
							? 'bg-surface-3 text-white/70'
							: bundleTier === 'placeholder'
								? 'bg-yellow-900/50 text-yellow-400'
								: 'bg-green-900/50 text-green-400'}"
					>
						{bundleTier}
					</span>
				</dd>
			</div>
		</dl>
	</div>

	<!-- Surface Registry -->
	<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">
			Surfaces
			<span class="text-sm font-normal text-status-muted">({surfaceList.length})</span>
		</h3>
		{#if surfaceList.length === 0}
			<div class="text-sm text-status-muted">No active surfaces</div>
		{:else}
			<div class="space-y-2">
				{#each surfaceList as surface (surface.surfaceId)}
					<div class="rounded border border-surface-border bg-surface-1 p-3">
						<div class="flex items-start justify-between">
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium text-white">
									{surface.title ?? 'Untitled'}
								</div>
								<div class="mt-1 font-mono text-xs text-status-muted">
									{surface.surfaceId}
								</div>
							</div>
							<span
								class="inline-block rounded px-2 py-0.5 text-xs {surface.visible
									? 'bg-green-900/50 text-green-400'
									: 'bg-surface-3 text-white/70'}"
							>
								{surface.visible ? 'visible' : 'hidden'}
							</span>
						</div>
						<div class="mt-2 flex flex-wrap gap-3 text-xs text-status-muted">
							<span>Messages: {surface.messages.length}</span>
							<span>Created: {formatDateTime(surface.createdAt)}</span>
							{#if surface.url}
								<span class="truncate">URL: {surface.url}</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Pinned Apps -->
	<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">
			Pinned Apps
			<span class="text-sm font-normal text-status-muted">({pins.length})</span>
		</h3>
		{#if pins.length === 0}
			<div class="text-sm text-status-muted">No pinned apps</div>
		{:else}
			<div class="space-y-2">
				{#each pins as pin (pin.id)}
					<div class="flex items-center gap-3 rounded border border-surface-border bg-surface-1 p-3">
						<div class="min-w-0 flex-1">
							<div class="text-sm font-medium text-white">{pin.name}</div>
							<div class="mt-0.5 font-mono text-xs text-status-muted">{pin.surfaceId}</div>
						</div>
						<span class="text-xs text-status-muted">
							{formatDateTime(pin.pinnedAt)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Canvas Event Log -->
	<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">
			Canvas Events
			<span class="text-sm font-normal text-status-muted">
				(last {canvasEvents.length})
			</span>
		</h3>
		{#if canvasEvents.length === 0}
			<div class="text-sm text-status-muted">No canvas events recorded</div>
		{:else}
			<div class="max-h-64 overflow-y-auto font-mono text-xs">
				<div class="space-y-1">
					{#each canvasEvents as event (event.ts + event.message)}
						<div class="flex gap-3">
							<span class="flex-shrink-0 text-status-muted/60">
								{formatTime(event.ts)}
							</span>
							<span class="w-10 flex-shrink-0 font-semibold uppercase {getLevelColor(event.level)}">
								{event.level}
							</span>
							<span class="flex-1 text-white/70">{event.message}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
