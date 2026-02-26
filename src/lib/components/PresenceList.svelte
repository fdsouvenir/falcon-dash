<script lang="ts">
	import { snapshot } from '$lib/stores/gateway.js';
	import type { PresenceEntry } from '$lib/gateway/snapshot-store.js';

	let presenceList = $state<PresenceEntry[]>([]);
	let now = $state(Date.now());

	// Subscribe to presence store
	$effect(() => {
		const unsub = snapshot.presence.subscribe((list) => {
			presenceList = list;
		});
		return unsub;
	});

	// Update 'now' every 30 seconds for duration calculation
	$effect(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 30000);
		return () => clearInterval(interval);
	});

	function formatDuration(connectedAt: number | undefined): string {
		if (!connectedAt) return 'unknown';
		const elapsed = now - connectedAt;
		const minutes = Math.floor(elapsed / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'just now';
	}

	function truncateId(instanceId: string | undefined): string {
		if (!instanceId) return 'unknown';
		return instanceId.length > 12 ? `${instanceId.slice(0, 12)}...` : instanceId;
	}

	function getDeviceBadge(deviceType: string | undefined): string {
		if (!deviceType) return 'unknown';
		return deviceType.toLowerCase();
	}
</script>

<div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
	<h2 class="text-lg font-semibold mb-3 text-white">Connected Clients</h2>

	{#if presenceList.length === 0}
		<p class="text-sm text-gray-400 italic">No other connections</p>
	{:else}
		<ul class="space-y-2">
			{#each presenceList as entry, i (entry.instanceId ?? entry.displayName ?? `presence-${i}`)}
				<li class="bg-gray-900 rounded p-3 border border-gray-700">
					<div class="flex items-start justify-between">
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium text-white truncate">
								{entry.displayName || truncateId(entry.instanceId)}
							</div>
							<div class="text-xs text-gray-400 mt-1">
								<span class="inline-block px-2 py-0.5 bg-gray-700 rounded text-gray-300 mr-2">
									{getDeviceBadge(entry.deviceType)}
								</span>
								<span>{formatDuration(entry.connectedAt)}</span>
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
