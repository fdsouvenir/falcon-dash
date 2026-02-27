<script lang="ts">
	import WizardShell from '$lib/components/wizard/WizardShell.svelte';
	import { call, connection, snapshot } from '$lib/stores/gateway.js';
	import { addToast } from '$lib/stores/toast.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ConnectionState } from '$lib/gateway/types.js';

	interface TelegramStatus {
		state: 'not_configured' | 'configured' | 'connected' | 'error';
		botUsername?: string;
		error?: string;
	}

	const steps = [
		{ label: 'Prerequisites' },
		{ label: 'Create Bot' },
		{ label: 'Bot Token' },
		{ label: 'Configure' },
		{ label: 'Connect' },
		{ label: 'Verify' }
	];

	let currentStep = $state(0);
	let connState = $state<ConnectionState>('DISCONNECTED');
	let status = $state<TelegramStatus>({ state: 'not_configured' });
	let botToken = $state('');
	let saving = $state(false);
	let checking = $state(false);
	let hasTelegramRpc = $state(false);

	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connState = s;
			if (s === 'READY') checkStatus();
		});
		return unsub;
	});

	$effect(() => {
		const unsub = snapshot.hasMethod('telegram.status').subscribe((v) => {
			hasTelegramRpc = v;
		});
		return unsub;
	});

	async function checkStatus() {
		checking = true;
		try {
			if (hasTelegramRpc) {
				status = await call<TelegramStatus>('telegram.status', {});
			} else {
				// Fallback: check config directly
				const cfg = await call<{ channels?: { telegram?: Record<string, unknown> } }>(
					'config.get',
					{ path: 'channels.telegram' }
				);
				if (cfg?.channels?.telegram) {
					status = { state: 'configured' };
				} else {
					status = { state: 'not_configured' };
				}
			}
		} catch {
			status = { state: 'not_configured' };
		} finally {
			checking = false;
		}
	}

	async function saveAndConnect() {
		if (!botToken.trim()) return;
		saving = true;
		try {
			if (hasTelegramRpc) {
				await call('telegram.configure', { botToken });
			} else {
				// Fallback: write config directly via config.apply
				const configResult = await call<{ raw: string; hash: string }>('config.get', {});
				const config = JSON.parse(configResult.raw);
				if (!config.channels) config.channels = {};
				config.channels.telegram = { botToken };
				await call('config.apply', {
					raw: JSON.stringify(config, null, 2),
					baseHash: configResult.hash
				});
			}
			addToast('Telegram configured successfully', 'success');
			await checkStatus();
			currentStep = 5;
		} catch (err) {
			addToast(`Configuration failed: ${err}`, 'error');
		} finally {
			saving = false;
		}
	}

	let isConnected = $derived(connState === 'READY');
	let canProceed = $derived.by(() => {
		if (currentStep === 0) return isConnected;
		if (currentStep === 2) return botToken.trim().length > 0;
		if (currentStep === 4) return false;
		return true;
	});

	function handleComplete() {
		goto(resolve('/channels'));
	}
</script>

<WizardShell
	title="Telegram Setup"
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
						Telegram: <span class="font-mono text-gray-400">{status.state}</span>
					</span>
				</div>
				{#if !hasTelegramRpc}
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-amber-400"></span>
						<span class="text-sm text-gray-300">
							No <span class="font-mono text-gray-400">telegram.*</span> RPCs — will use config fallback
						</span>
					</div>
				{/if}
			</div>
			{#if status.state === 'connected'}
				<div class="rounded border border-emerald-600/30 bg-emerald-900/20 p-3">
					<p class="text-sm text-emerald-400">
						Already connected{status.botUsername ? ` as @${status.botUsername}` : ''}.
					</p>
				</div>
			{/if}
			{#if !isConnected}
				<p class="text-xs text-gray-500">Connect to the gateway first to proceed.</p>
			{/if}
		</div>
	{:else if currentStep === 1}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Create a Telegram Bot</h3>
			<ol class="list-decimal space-y-3 pl-5 text-sm text-gray-300">
				<li>
					Open Telegram and search for <a
						href="https://t.me/BotFather"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-400 underline">@BotFather</a
					>
				</li>
				<li>
					Send <span class="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-xs text-white"
						>/newbot</span
					>
				</li>
				<li>Choose a <span class="font-semibold text-white">display name</span> for your bot</li>
				<li>
					Choose a <span class="font-semibold text-white">username</span> (must end in
					<span class="font-mono text-gray-400">bot</span>)
				</li>
				<li>
					BotFather will reply with your <span class="font-semibold text-white">bot token</span> — copy
					it
				</li>
			</ol>
			<div class="rounded border border-gray-700/60 bg-gray-900/40 p-3">
				<p class="text-xs text-gray-500">
					If you already have a bot, send <span
						class="rounded bg-gray-700 px-1 py-0.5 font-mono text-xs text-gray-300">/mybots</span
					> to @BotFather to find your token.
				</p>
			</div>
		</div>
	{:else if currentStep === 2}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Enter Bot Token</h3>
			<div>
				<label for="telegram-bot-token" class="mb-1 block text-sm font-medium text-gray-300"
					>Bot Token</label
				>
				<input
					id="telegram-bot-token"
					type="password"
					bind:value={botToken}
					placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
					class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-xs text-gray-500">
					The token from @BotFather (format: <span class="font-mono">number:alphanumeric</span>)
				</p>
			</div>
		</div>
	{:else if currentStep === 3}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Configure Bot Settings</h3>
			<p class="text-sm text-gray-300">
				Optionally configure your bot in @BotFather before connecting:
			</p>
			<div class="space-y-2 text-sm text-gray-400">
				<div class="rounded border border-gray-700/60 bg-gray-900/40 p-3 space-y-2">
					<div class="flex items-start gap-2">
						<span class="mt-0.5 font-mono text-xs text-blue-400">/setdescription</span>
						<span class="text-gray-500">— What users see before starting a chat</span>
					</div>
					<div class="flex items-start gap-2">
						<span class="mt-0.5 font-mono text-xs text-blue-400">/setabouttext</span>
						<span class="text-gray-500">— Shown in the bot's profile</span>
					</div>
					<div class="flex items-start gap-2">
						<span class="mt-0.5 font-mono text-xs text-blue-400">/setuserpic</span>
						<span class="text-gray-500">— Set the bot's avatar</span>
					</div>
					<div class="flex items-start gap-2">
						<span class="mt-0.5 font-mono text-xs text-blue-400">/setcommands</span>
						<span class="text-gray-500">— Define slash commands for users</span>
					</div>
				</div>
			</div>
			<p class="text-xs text-gray-500">These are optional — you can always change them later.</p>
		</div>
	{:else if currentStep === 4}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Save & Connect</h3>
			<div class="rounded border border-gray-700/60 bg-gray-900/40 p-3">
				<div class="space-y-1 text-xs">
					<div class="flex justify-between">
						<span class="text-gray-400">Bot Token</span><span class="font-mono text-gray-200"
							>{botToken ? '••••••••' : '--'}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-400">Method</span><span class="font-mono text-gray-200"
							>{hasTelegramRpc ? 'telegram.configure RPC' : 'config.apply fallback'}</span
						>
					</div>
				</div>
			</div>
			<button
				onclick={saveAndConnect}
				disabled={saving || !botToken.trim()}
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
						<span class="font-medium">Telegram connected!</span>
					</div>
					{#if status.botUsername}<p class="mt-2 text-sm text-gray-300">
							Bot: @{status.botUsername}
						</p>{/if}
				</div>
			{:else if status.state === 'configured'}
				<div class="rounded border border-amber-600/30 bg-amber-900/20 p-3">
					<p class="text-sm text-amber-400">
						Configuration saved. The bot will connect on next gateway restart.
					</p>
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
