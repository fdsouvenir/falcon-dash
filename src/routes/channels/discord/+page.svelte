<script lang="ts">
	import WizardShell from '$lib/components/wizard/WizardShell.svelte';
	import { call, connection } from '$lib/stores/gateway.js';
	import { addToast } from '$lib/stores/toast.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ConnectionState } from '$lib/gateway/types.js';

	interface DiscordStatus {
		state: 'not_configured' | 'configured' | 'connected' | 'error';
		serverName?: string;
		channelCount?: number;
		error?: string;
	}

	const steps = [
		{ label: 'Prerequisites' },
		{ label: 'Create App' },
		{ label: 'Credentials' },
		{ label: 'Invite Bot' },
		{ label: 'Connect' },
		{ label: 'Verify' }
	];

	let currentStep = $state(0);
	let connState = $state<ConnectionState>('DISCONNECTED');
	let status = $state<DiscordStatus>({ state: 'not_configured' });
	let clientId = $state('');
	let botToken = $state('');
	let saving = $state(false);
	let checking = $state(false);

	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connState = s;
			if (s === 'READY') checkStatus();
		});
		return unsub;
	});

	async function checkStatus() {
		checking = true;
		try {
			status = await call<DiscordStatus>('discord.status', {});
		} catch {
			status = { state: 'not_configured' };
		} finally {
			checking = false;
		}
	}

	async function saveAndConnect() {
		if (!clientId.trim() || !botToken.trim()) return;
		saving = true;
		try {
			await call('discord.configure', { clientId, botToken });
			addToast('Discord configured successfully', 'success');
			await checkStatus();
			currentStep = 5;
		} catch (err) {
			addToast(`Configuration failed: ${err}`, 'error');
		} finally {
			saving = false;
		}
	}

	function generateOAuthUrl(): string {
		if (!clientId.trim()) return '';
		return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2048&scope=bot`;
	}

	let isConnected = $derived(connState === 'READY');
	let canProceed = $derived.by(() => {
		if (currentStep === 0) return isConnected;
		if (currentStep === 2) return clientId.trim().length > 0 && botToken.trim().length > 0;
		if (currentStep === 4) return false;
		return true;
	});

	function handleComplete() {
		goto(resolve('/channels'));
	}
</script>

<WizardShell
	title="Discord Setup"
	{steps}
	bind:currentStep
	{canProceed}
	onComplete={handleComplete}
>
	{#if currentStep === 0}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Prerequisites</h3>
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full {isConnected ? 'bg-emerald-400' : 'bg-red-400'}"></span>
					<span class="text-sm text-gray-300">Gateway connected</span>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="h-2 w-2 rounded-full {status.state !== 'not_configured'
							? 'bg-emerald-400'
							: 'bg-gray-500'}"
					></span>
					<span class="text-sm text-gray-300">
						Discord: <span class="font-mono text-gray-400">{status.state}</span>
					</span>
				</div>
			</div>
			{#if status.state === 'connected'}
				<div class="rounded border border-emerald-600/30 bg-emerald-900/20 p-3">
					<p class="text-sm text-emerald-400">
						Already connected{status.serverName ? ` to ${status.serverName}` : ''}.
					</p>
				</div>
			{/if}
			{#if !isConnected}
				<p class="text-xs text-gray-500">Connect to the gateway first to proceed.</p>
			{/if}
		</div>
	{:else if currentStep === 1}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Create a Discord Application</h3>
			<ol class="list-decimal space-y-3 pl-5 text-sm text-gray-300">
				<li>
					Go to the <a
						href="https://discord.com/developers/applications"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-400 underline">Discord Developer Portal</a
					>
				</li>
				<li>Click <span class="font-semibold text-white">"New Application"</span></li>
				<li>Go to <span class="font-semibold text-white">"Bot"</span> tab and add a bot</li>
				<li>
					Enable <span class="font-semibold text-white">"Message Content Intent"</span> under Privileged
					Intents
				</li>
				<li>
					Click <span class="font-semibold text-white">"Reset Token"</span> and copy the bot token
				</li>
			</ol>
		</div>
	{:else if currentStep === 2}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Enter Credentials</h3>
			<div>
				<label for="discord-client-id" class="mb-1 block text-sm font-medium text-gray-300"
					>Client ID</label
				>
				<input
					id="discord-client-id"
					type="text"
					bind:value={clientId}
					placeholder="1234567890123456789"
					class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-xs text-gray-500">Found in "General Information" tab</p>
			</div>
			<div>
				<label for="discord-bot-token" class="mb-1 block text-sm font-medium text-gray-300"
					>Bot Token</label
				>
				<input
					id="discord-bot-token"
					type="password"
					bind:value={botToken}
					placeholder="Enter your bot token"
					class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-xs text-gray-500">Keep this secret!</p>
			</div>
		</div>
	{:else if currentStep === 3}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Add Bot to Server</h3>
			{#if clientId.trim()}
				<p class="text-sm text-gray-300">
					Click below to invite your bot with the required permissions.
				</p>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external Discord OAuth URL -->
				<a
					href={generateOAuthUrl()}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4752C4]"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"
						><path
							d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z"
						/></svg
					>
					Add to Discord Server
				</a>
			{:else}
				<div class="rounded border border-amber-600/30 bg-amber-900/20 p-3">
					<p class="text-sm text-amber-400">Go back and enter your Client ID first.</p>
				</div>
			{/if}
		</div>
	{:else if currentStep === 4}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Save & Connect</h3>
			<div class="rounded border border-gray-700/60 bg-gray-900/40 p-3">
				<div class="space-y-1 text-xs">
					<div class="flex justify-between">
						<span class="text-gray-400">Client ID</span><span class="font-mono text-gray-200"
							>{clientId || '--'}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-400">Bot Token</span><span class="font-mono text-gray-200"
							>{botToken ? '••••••••' : '--'}</span
						>
					</div>
				</div>
			</div>
			<button
				onclick={saveAndConnect}
				disabled={saving || !clientId.trim() || !botToken.trim()}
				class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
			>
				{saving ? 'Connecting...' : 'Save & Connect'}
			</button>
		</div>
	{:else if currentStep === 5}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Verification</h3>
			{#if checking}
				<div class="flex items-center gap-2">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"
					></div>
					<span class="text-sm text-gray-400">Checking...</span>
				</div>
			{:else if status.state === 'connected'}
				<div class="rounded border border-emerald-600/30 bg-emerald-900/20 p-4">
					<div class="flex items-center gap-2 text-emerald-400">
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/></svg
						>
						<span class="font-medium">Discord connected!</span>
					</div>
					{#if status.serverName}<p class="mt-2 text-sm text-gray-300">
							Server: {status.serverName}
						</p>{/if}
					{#if status.channelCount}<p class="text-sm text-gray-400">
							{status.channelCount} channels
						</p>{/if}
				</div>
			{:else}
				<div class="rounded border border-amber-600/30 bg-amber-900/20 p-3">
					<p class="text-sm text-amber-400">Not yet connected. This may take a moment.</p>
				</div>
				<button
					onclick={checkStatus}
					class="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
					>Refresh</button
				>
			{/if}
		</div>
	{/if}
</WizardShell>
