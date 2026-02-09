<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		devices,
		loadDevices,
		approveDevice,
		rejectDevice,
		revokeDevice,
		channelStatus,
		loadChannelStatus,
		initSettingsListeners,
		destroySettingsListeners
	} from '$lib/stores';
	import type { DeviceEntry, ChannelStatusEntry } from '$lib/types/settings';
	import { formatRelativeTime } from '$lib/utils/time';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';

	let loading = true;
	let error = '';
	let now = Date.now();
	let toastMessage = '';
	let toastType: 'success' | 'error' = 'success';
	let toastTimeout: ReturnType<typeof setTimeout> | undefined;
	let revokeTarget: DeviceEntry | null = null;

	let refreshInterval: ReturnType<typeof setInterval> | undefined;
	let nowInterval: ReturnType<typeof setInterval> | undefined;

	function showToast(message: string, type: 'success' | 'error'): void {
		if (toastTimeout) clearTimeout(toastTimeout);
		toastMessage = message;
		toastType = type;
		toastTimeout = setTimeout(() => {
			toastMessage = '';
		}, 3000);
	}

	function deviceStatusColor(status: DeviceEntry['status']): string {
		switch (status) {
			case 'approved':
				return 'bg-green-500';
			case 'pending':
				return 'bg-yellow-500';
			case 'rejected':
				return 'bg-red-500';
			case 'revoked':
				return 'bg-slate-500';
			default:
				return 'bg-slate-500';
		}
	}

	function channelStatusColor(status: ChannelStatusEntry['status']): string {
		switch (status) {
			case 'connected':
				return 'bg-green-500';
			case 'disconnected':
				return 'bg-red-500';
			case 'connecting':
				return 'bg-yellow-500';
			case 'error':
				return 'bg-red-500';
			default:
				return 'bg-slate-500';
		}
	}

	function platformLabel(platform: string): string {
		switch (platform) {
			case 'discord':
				return 'Discord';
			case 'slack':
				return 'Slack';
			case 'whatsapp':
				return 'WhatsApp';
			default:
				return platform.charAt(0).toUpperCase() + platform.slice(1);
		}
	}

	async function handleApprove(device: DeviceEntry): Promise<void> {
		try {
			await approveDevice(device.id);
			showToast(`${device.name} approved`, 'success');
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to approve device';
			showToast(msg, 'error');
		}
	}

	async function handleReject(device: DeviceEntry): Promise<void> {
		try {
			await rejectDevice(device.id);
			showToast(`${device.name} rejected`, 'success');
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to reject device';
			showToast(msg, 'error');
		}
	}

	async function handleRevoke(): Promise<void> {
		if (!revokeTarget) return;
		const device = revokeTarget;
		revokeTarget = null;
		try {
			await revokeDevice(device.id);
			showToast(`${device.name} revoked`, 'success');
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to revoke device';
			showToast(msg, 'error');
		}
	}

	$: pendingDevices = $devices.filter((d) => d.status === 'pending');
	$: pairedDevices = $devices.filter((d) => d.status === 'approved');
	$: otherDevices = $devices.filter((d) => d.status === 'rejected' || d.status === 'revoked');

	onMount(async () => {
		initSettingsListeners();
		try {
			await Promise.all([loadDevices(), loadChannelStatus()]);
		} catch {
			error = 'Failed to load security data';
		} finally {
			loading = false;
		}

		refreshInterval = setInterval(() => {
			loadDevices();
			loadChannelStatus();
		}, 30_000);

		nowInterval = setInterval(() => {
			now = Date.now();
		}, 30_000);
	});

	onDestroy(() => {
		destroySettingsListeners();
		if (refreshInterval) clearInterval(refreshInterval);
		if (nowInterval) clearInterval(nowInterval);
		if (toastTimeout) clearTimeout(toastTimeout);
	});
</script>

<div class="space-y-6 overflow-y-auto p-6">
	{#if toastMessage}
		<div
			class="fixed right-4 top-4 z-50 rounded-lg px-4 py-2 text-sm shadow-lg {toastType ===
			'success'
				? 'bg-green-600 text-white'
				: 'bg-red-600 text-white'}"
		>
			{toastMessage}
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<p class="text-sm text-slate-400">Loading security settings...</p>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-800/50 bg-red-900/20 p-4">
			<p class="text-sm text-red-400">{error}</p>
		</div>
	{:else}
		<!-- Pending Requests Section -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-4 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Pending Requests
					{#if pendingDevices.length > 0}
						<span class="ml-1.5 rounded-full bg-yellow-600 px-1.5 py-0.5 text-xs text-white">
							{pendingDevices.length}
						</span>
					{/if}
				</h2>
			</div>
			<div class="p-4">
				{#if pendingDevices.length > 0}
					<div class="space-y-3">
						{#each pendingDevices as device (device.id)}
							<div
								class="flex items-center justify-between rounded border border-yellow-800/30 bg-yellow-900/10 px-4 py-3"
							>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-2 w-2 flex-shrink-0 rounded-full {deviceStatusColor(
												device.status
											)}"
										></span>
										<span class="text-sm font-medium text-slate-200">
											{device.name}
										</span>
										<span class="text-xs text-slate-400">{device.role}</span>
									</div>
									<p class="mt-0.5 text-xs text-slate-500">
										Requested {formatRelativeTime(device.createdAt, now)}
									</p>
								</div>
								<div class="ml-4 flex flex-shrink-0 gap-2">
									<button
										on:click={() => handleApprove(device)}
										class="rounded bg-green-700 px-3 py-1 text-xs text-white transition-colors hover:bg-green-600"
									>
										Approve
									</button>
									<button
										on:click={() => handleReject(device)}
										class="rounded bg-red-700 px-3 py-1 text-xs text-white transition-colors hover:bg-red-600"
									>
										Reject
									</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-slate-500">No pending pairing requests.</p>
				{/if}
			</div>
		</section>

		<!-- Paired Devices Section -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-4 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Paired Devices
				</h2>
			</div>
			<div class="p-4">
				{#if pairedDevices.length > 0}
					<div class="space-y-3">
						{#each pairedDevices as device (device.id)}
							<div
								class="flex items-start justify-between rounded border border-slate-700/50 bg-slate-800 px-4 py-3"
							>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-2 w-2 flex-shrink-0 rounded-full {deviceStatusColor(
												device.status
											)}"
										></span>
										<span class="text-sm font-medium text-slate-200">
											{device.name}
										</span>
										<span class="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
											{device.role}
										</span>
									</div>
									{#if device.lastSeen}
										<p class="mt-0.5 text-xs text-slate-500">
											Last seen {formatRelativeTime(device.lastSeen, now)}
										</p>
									{/if}
								</div>
								<div class="ml-4 flex-shrink-0">
									<button
										on:click={() => (revokeTarget = device)}
										class="rounded bg-slate-700 px-3 py-1 text-xs text-slate-200 transition-colors hover:bg-red-700 hover:text-white"
									>
										Revoke
									</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-slate-500">No paired devices.</p>
				{/if}
			</div>
		</section>

		<!-- Previously Rejected/Revoked -->
		{#if otherDevices.length > 0}
			<section class="rounded-lg border border-slate-700 bg-slate-800/50">
				<div class="border-b border-slate-700 px-4 py-3">
					<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
						Rejected / Revoked
					</h2>
				</div>
				<div class="p-4">
					<div class="space-y-2">
						{#each otherDevices as device (device.id)}
							<div
								class="flex items-center justify-between rounded border border-slate-700/50 px-4 py-2"
							>
								<div class="flex items-center gap-2">
									<span
										class="inline-block h-2 w-2 flex-shrink-0 rounded-full {deviceStatusColor(
											device.status
										)}"
									></span>
									<span class="text-sm text-slate-400">{device.name}</span>
									<span class="text-xs capitalize text-slate-500">
										{device.status}
									</span>
								</div>
								<span class="text-xs text-slate-500">{device.role}</span>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- Channel Status Section -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-4 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Channel Status
				</h2>
			</div>
			<div class="p-4">
				{#if $channelStatus.length > 0}
					<div class="space-y-3">
						{#each $channelStatus as channel (channel.id)}
							<div
								class="flex items-start justify-between rounded border border-slate-700/50 bg-slate-800 px-4 py-3"
							>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-2 w-2 flex-shrink-0 rounded-full {channelStatusColor(
												channel.status
											)}"
										></span>
										<span class="text-sm font-medium text-slate-200">
											{channel.label || platformLabel(channel.platform)}
										</span>
										<span class="text-xs capitalize text-slate-400">
											{channel.status}
										</span>
									</div>
									{#if channel.serverName}
										<p class="mt-0.5 text-xs text-slate-400">
											Server: {channel.serverName}
										</p>
									{/if}
									{#if channel.workspaceName}
										<p class="mt-0.5 text-xs text-slate-400">
											Workspace: {channel.workspaceName}
										</p>
									{/if}
									{#if channel.error}
										<p class="mt-0.5 text-xs text-red-400">{channel.error}</p>
									{/if}
									{#if channel.platform === 'whatsapp' && channel.status === 'disconnected'}
										<p class="mt-1 text-xs text-slate-500">
											QR login may be required. Configure via the gateway.
										</p>
									{/if}
								</div>
								<div class="ml-4 flex-shrink-0 text-right">
									{#if channel.inviteLink}
										<a
											href={channel.inviteLink}
											target="_blank"
											rel="noopener noreferrer"
											class="text-xs text-blue-400 hover:text-blue-300"
										>
											Invite Link
										</a>
									{/if}
									{#if channel.lastSeen}
										<p class="mt-0.5 text-xs text-slate-500">
											{formatRelativeTime(channel.lastSeen, now)}
										</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-slate-500">No channels configured.</p>
					<p class="mt-1 text-xs text-slate-500">
						Connect Discord, Slack, or WhatsApp through the gateway configuration.
					</p>
				{/if}
			</div>
		</section>
	{/if}
</div>

<ConfirmDialog
	title="Revoke Device"
	message="This will revoke pairing for {revokeTarget?.name ??
		'this device'}. The device will need to re-pair to connect again."
	confirmLabel="Revoke"
	open={revokeTarget !== null}
	on:confirm={handleRevoke}
	on:cancel={() => (revokeTarget = null)}
/>
