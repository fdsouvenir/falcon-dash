<script lang="ts">
	import { onMount } from 'svelte';
	import { call } from '$lib/stores/gateway.js';

	interface DiscordStatus {
		state: 'not_configured' | 'configured' | 'connected' | 'error';
		serverName?: string;
		channelCount?: number;
		error?: string;
	}

	let status = $state<DiscordStatus>({ state: 'not_configured' });
	let clientId = $state('');
	let botToken = $state('');
	let loading = $state(false);
	let setupStep = $state(1);
	let showDisconnectConfirm = $state(false);

	async function loadStatus() {
		loading = true;
		try {
			const result = await call<DiscordStatus>('discord.status', {});
			status = result;
		} catch (err) {
			status = { state: 'error', error: String(err) };
		} finally {
			loading = false;
		}
	}

	async function saveConfiguration() {
		if (!clientId.trim() || !botToken.trim()) {
			alert('Please provide both Client ID and Bot Token');
			return;
		}

		loading = true;
		try {
			await call('discord.configure', { clientId, botToken });
			await loadStatus();
			clientId = '';
			botToken = '';
			setupStep = 1;
		} catch (err) {
			alert(`Configuration failed: ${err}`);
		} finally {
			loading = false;
		}
	}

	async function disconnect() {
		loading = true;
		try {
			await call('discord.disconnect', {});
			await loadStatus();
			showDisconnectConfirm = false;
		} catch (err) {
			alert(`Disconnect failed: ${err}`);
		} finally {
			loading = false;
		}
	}

	function generateOAuthUrl(): string {
		if (!clientId.trim()) return '';
		return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2048&scope=bot`;
	}

	onMount(() => {
		loadStatus();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold text-white">Discord Integration</h3>
		{#if loading}
			<span class="text-sm text-gray-400">Loading...</span>
		{/if}
	</div>

	{#if status.state === 'connected'}
		<div class="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium text-green-400">Connected</p>
					<p class="text-sm text-gray-300">Server: {status.serverName}</p>
					<p class="text-sm text-gray-400">Channels: {status.channelCount}</p>
				</div>
				<button
					onclick={() => (showDisconnectConfirm = true)}
					disabled={loading}
					class="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
				>
					Disconnect
				</button>
			</div>
		</div>

		{#if showDisconnectConfirm}
			<div class="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
				<p class="mb-3 text-sm text-gray-300">Are you sure you want to disconnect Discord?</p>
				<div class="flex gap-2">
					<button
						onclick={() => disconnect()}
						disabled={loading}
						class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
					>
						Confirm Disconnect
					</button>
					<button
						onclick={() => (showDisconnectConfirm = false)}
						disabled={loading}
						class="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}
	{:else if status.state === 'configured'}
		<div class="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
			<p class="font-medium text-blue-400">Configured</p>
			<p class="text-sm text-gray-300">Discord bot is configured but not connected.</p>
		</div>
	{:else if status.state === 'error'}
		<div class="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
			<p class="font-medium text-red-400">Error</p>
			<p class="text-sm text-gray-300">{status.error || 'Unknown error'}</p>
		</div>
	{/if}

	{#if status.state === 'not_configured' || status.state === 'configured'}
		<div class="space-y-4">
			<div class="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
				<h4 class="mb-4 font-medium text-white">Setup Discord Bot</h4>

				<div class="mb-6 space-y-3">
					<button
						onclick={() => (setupStep = 1)}
						class="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:bg-gray-700"
					>
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-white">Step 1: Create Discord Application</span>
							<span class="text-xs text-gray-400">{setupStep === 1 ? '▼' : '▶'}</span>
						</div>
					</button>
					{#if setupStep === 1}
						<div class="rounded-lg bg-gray-900/50 p-4 text-sm text-gray-300">
							<ol class="list-decimal space-y-2 pl-5">
								<li>
									Go to <a
										href="https://discord.com/developers/applications"
										target="_blank"
										class="text-blue-400 underline">Discord Developer Portal</a
									>
								</li>
								<li>Click "New Application" and give it a name</li>
								<li>Go to the "Bot" tab and click "Add Bot"</li>
								<li>Under "Privileged Gateway Intents", enable "Message Content Intent"</li>
								<li>Click "Reset Token" and copy the bot token</li>
							</ol>
						</div>
					{/if}

					<button
						onclick={() => (setupStep = 2)}
						class="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:bg-gray-700"
					>
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-white">Step 2: Enter Client ID</span>
							<span class="text-xs text-gray-400">{setupStep === 2 ? '▼' : '▶'}</span>
						</div>
					</button>
					{#if setupStep === 2}
						<div class="rounded-lg bg-gray-900/50 p-4">
							<label class="mb-2 block text-sm font-medium text-gray-300">Client ID</label>
							<input
								type="text"
								bind:value={clientId}
								placeholder="1234567890123456789"
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
							/>
							<p class="mt-2 text-xs text-gray-400">
								Find this in your Discord Application's "General Information" tab
							</p>
						</div>
					{/if}

					<button
						onclick={() => (setupStep = 3)}
						class="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:bg-gray-700"
					>
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-white">Step 3: Enter Bot Token</span>
							<span class="text-xs text-gray-400">{setupStep === 3 ? '▼' : '▶'}</span>
						</div>
					</button>
					{#if setupStep === 3}
						<div class="rounded-lg bg-gray-900/50 p-4">
							<label class="mb-2 block text-sm font-medium text-gray-300">Bot Token</label>
							<input
								type="password"
								bind:value={botToken}
								placeholder="••••••••••••••••••••••••"
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
							/>
							<p class="mt-2 text-xs text-gray-400">Found in the "Bot" tab. Keep this secret!</p>
						</div>
					{/if}

					<button
						onclick={() => (setupStep = 4)}
						class="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:bg-gray-700"
					>
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-white">Step 4: Add to Server</span>
							<span class="text-xs text-gray-400">{setupStep === 4 ? '▼' : '▶'}</span>
						</div>
					</button>
					{#if setupStep === 4}
						<div class="rounded-lg bg-gray-900/50 p-4">
							{#if clientId.trim()}
								<a
									href={generateOAuthUrl()}
									target="_blank"
									class="inline-block rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
								>
									Add to Discord Server
								</a>
								<p class="mt-2 text-xs text-gray-400">
									Click to authorize the bot with required permissions (Send Messages)
								</p>
							{:else}
								<p class="text-sm text-gray-400">Enter Client ID in Step 2 first</p>
							{/if}
						</div>
					{/if}
				</div>

				<button
					onclick={() => saveConfiguration()}
					disabled={loading || !clientId.trim() || !botToken.trim()}
					class="w-full rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
				>
					{loading ? 'Saving...' : 'Save Configuration'}
				</button>
			</div>
		</div>
	{/if}
</div>
