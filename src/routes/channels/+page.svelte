<script lang="ts">
	import { gatewayEvents } from '$lib/gateway-api.js';
	import {
		discordStatus,
		initDiscordStatus,
		subscribeToDiscordEvents
	} from '$lib/stores/discord.js';
	import { resolve } from '$app/paths';
	import { derived } from 'svelte/store';

	let connectionState = $state('disconnected');
	let discord = $state<{ connected: boolean; guildName?: string }>({ connected: false });
	let hasDiscordRpc = $state(false);

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connectionState = s;
			if (s === 'ready') {
				initDiscordStatus();
				subscribeToDiscordEvents();
			}
		});
		return unsub;
	});

	$effect(() => {
		const unsub = discordStatus.subscribe((s) => {
			discord = s;
		});
		return unsub;
	});

	$effect(() => {
		const hasMethodStore = derived(
			gatewayEvents.snapshot,
			($snap) => $snap?.features?.methods?.includes('discord.status') ?? false
		);
		const unsub = hasMethodStore.subscribe((v) => {
			hasDiscordRpc = v;
		});
		return unsub;
	});

	let isConnected = $derived(connectionState === 'ready');

	const channelTypes = [
		{
			id: 'discord',
			name: 'Discord',
			description: 'Connect your Discord server',
			icon: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z',
			available: hasDiscordRpc,
			connected: discord.connected,
			statusText: discord.connected
				? `Connected${discord.guildName ? ` to ${discord.guildName}` : ''}`
				: 'Not connected',
			href: '/channels/discord'
		},
		{
			id: 'telegram',
			name: 'Telegram',
			description: 'Connect your Telegram bot',
			icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
			available: true,
			connected: false,
			statusText: 'Not configured',
			href: '/channels/telegram'
		}
	] as const;
</script>

<div class="flex flex-col gap-5 p-4 sm:p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold text-white">Channels</h1>
			<p class="text-sm text-gray-400">Connect your agent to messaging platforms</p>
		</div>
	</div>

	{#if !isConnected}
		<div class="rounded-lg border border-gray-700/40 bg-gray-800/20 px-4 py-8 text-center">
			<p class="text-sm text-gray-500">Connect to gateway to manage channels</p>
		</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each channelTypes as channel (channel.id)}
				<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
					<div class="mb-3 flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700/50">
							<svg class="h-5 w-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
								<path d={channel.icon} />
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="text-sm font-semibold text-gray-100">{channel.name}</h3>
							<p class="text-xs text-gray-500">{channel.description}</p>
						</div>
						{#if channel.connected}
							<span class="h-2 w-2 rounded-full bg-emerald-400"></span>
						{/if}
					</div>

					<p class="mb-3 text-xs {channel.connected ? 'text-emerald-400/80' : 'text-gray-500'}">
						{channel.statusText}
					</p>

					<a
						href={resolve(channel.href)}
						class="inline-flex items-center rounded-md {channel.connected
							? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
							: 'bg-blue-600/80 text-white hover:bg-blue-600'} px-3 py-1.5 text-xs font-medium transition-colors"
					>
						{channel.connected ? 'Configure' : 'Set Up'}
					</a>
				</div>
			{/each}
		</div>
	{/if}
</div>
