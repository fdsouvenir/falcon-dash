<script lang="ts">
	import { call, eventBus, connection } from '$lib/stores/gateway.js';

	interface PairingRequest {
		requestId: string;
		deviceName: string;
		deviceType: string;
		requestedAt: string;
	}

	interface PairedDevice {
		deviceId: string;
		deviceName: string;
		deviceType: string;
		pairedAt: string;
		lastSeen?: string;
	}

	let pendingRequests = $state<PairingRequest[]>([]);
	let pairedDevices = $state<PairedDevice[]>([]);
	let loading = $state(false);
	let confirmAction = $state<{
		type: 'rotate' | 'revoke';
		deviceId: string;
		deviceName: string;
	} | null>(null);

	async function loadPendingRequests() {
		try {
			const result = await call<{ requests: PairingRequest[] }>('device-pair.list', {
				status: 'pending'
			});
			pendingRequests = result.requests || [];
		} catch (err) {
			console.error('Failed to load pending requests:', err);
		}
	}

	async function loadPairedDevices() {
		try {
			const result = await call<{ devices: PairedDevice[] }>('device-pair.list', {
				status: 'approved'
			});
			pairedDevices = result.devices || [];
		} catch (err) {
			console.error('Failed to load paired devices:', err);
		}
	}

	async function loadAll() {
		loading = true;
		try {
			await Promise.all([loadPendingRequests(), loadPairedDevices()]);
		} finally {
			loading = false;
		}
	}

	async function approveRequest(requestId: string) {
		loading = true;
		try {
			await call('device-pair.approve', { requestId });
			await loadAll();
		} catch (err) {
			alert(`Failed to approve device: ${err}`);
		} finally {
			loading = false;
		}
	}

	async function rejectRequest(requestId: string) {
		loading = true;
		try {
			await call('device-pair.reject', { requestId });
			await loadAll();
		} catch (err) {
			alert(`Failed to reject device: ${err}`);
		} finally {
			loading = false;
		}
	}

	async function rotateToken(deviceId: string) {
		loading = true;
		try {
			await call('device-token.rotate', { deviceId });
			confirmAction = null;
			await loadPairedDevices();
		} catch (err) {
			alert(`Failed to rotate token: ${err}`);
		} finally {
			loading = false;
		}
	}

	async function revokeToken(deviceId: string) {
		loading = true;
		try {
			await call('device-token.revoke', { deviceId });
			confirmAction = null;
			await loadAll();
		} catch (err) {
			alert(`Failed to revoke device: ${err}`);
		} finally {
			loading = false;
		}
	}

	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	let connectionState = $state('DISCONNECTED');
	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		if (connectionState === 'READY') loadAll();
	});

	$effect(() => {
		const unsubRequested = eventBus.on('device-pair.requested', () => {
			loadPendingRequests();
		});
		const unsubResolved = eventBus.on('device-pair.resolved', () => {
			loadAll();
		});
		return () => {
			unsubRequested();
			unsubResolved();
		};
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold text-white">Device Management</h3>
		{#if loading}
			<span class="text-sm text-gray-400">Loading...</span>
		{/if}
	</div>

	{#if pendingRequests.length > 0}
		<div class="space-y-3">
			<h4 class="text-sm font-medium text-gray-300">Pending Pairing Requests</h4>
			{#each pendingRequests as request}
				<div class="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<p class="font-medium text-yellow-400">{request.deviceName}</p>
							<p class="text-sm text-gray-400">Type: {request.deviceType}</p>
							<p class="text-xs text-gray-500">Requested {formatTimestamp(request.requestedAt)}</p>
						</div>
						<div class="flex gap-2">
							<button
								onclick={() => approveRequest(request.requestId)}
								disabled={loading}
								class="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
							>
								Approve
							</button>
							<button
								onclick={() => rejectRequest(request.requestId)}
								disabled={loading}
								class="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
							>
								Reject
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<div class="space-y-3">
		<h4 class="text-sm font-medium text-gray-300">Paired Devices</h4>
		{#if pairedDevices.length === 0}
			<p class="text-sm text-gray-500">No paired devices</p>
		{:else}
			{#each pairedDevices as device}
				<div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<p class="font-medium text-white">{device.deviceName}</p>
							<p class="text-sm text-gray-400">Type: {device.deviceType}</p>
							<div class="mt-1 flex gap-4 text-xs text-gray-500">
								<span>Paired {formatTimestamp(device.pairedAt)}</span>
								{#if device.lastSeen}
									<span>Last seen {formatTimestamp(device.lastSeen)}</span>
								{/if}
							</div>
						</div>
						<div class="flex gap-2">
							<button
								onclick={() =>
									(confirmAction = {
										type: 'rotate',
										deviceId: device.deviceId,
										deviceName: device.deviceName
									})}
								disabled={loading}
								class="rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
							>
								Rotate Token
							</button>
							<button
								onclick={() =>
									(confirmAction = {
										type: 'revoke',
										deviceId: device.deviceId,
										deviceName: device.deviceName
									})}
								disabled={loading}
								class="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
							>
								Revoke
							</button>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	{#if confirmAction}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div class="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-6">
				<h4 class="mb-3 text-lg font-semibold text-white">
					{confirmAction.type === 'rotate' ? 'Rotate Token' : 'Revoke Device'}
				</h4>
				<p class="mb-4 text-sm text-gray-300">
					{#if confirmAction.type === 'rotate'}
						Are you sure you want to rotate the token for <strong>{confirmAction.deviceName}</strong
						>? The device will need to authenticate with the new token.
					{:else}
						Are you sure you want to revoke access for <strong>{confirmAction.deviceName}</strong>?
						This will permanently remove the device.
					{/if}
				</p>
				<div class="flex gap-2">
					<button
						onclick={() => {
							if (confirmAction?.type === 'rotate') {
								rotateToken(confirmAction.deviceId);
							} else if (confirmAction?.type === 'revoke') {
								revokeToken(confirmAction.deviceId);
							}
						}}
						disabled={loading}
						class="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
					>
						Confirm
					</button>
					<button
						onclick={() => (confirmAction = null)}
						disabled={loading}
						class="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
