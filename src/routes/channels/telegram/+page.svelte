<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		deriveTelegramWizardInitialStep,
		deriveTelegramWizardMode,
		validateTelegramToken,
		type TelegramTokenErrors
	} from '$lib/channels/telegram-wizard.js';
	import WizardShell from '$lib/components/wizard/WizardShell.svelte';
	import { rpc, gatewayEvents } from '$lib/gateway-api.js';
	import {
		channelReadiness,
		channelReadinessLoading,
		refreshChannelReadiness,
		startChannelReadiness,
		type ChannelReadiness
	} from '$lib/stores/channel-readiness.js';
	import { addToast } from '$lib/stores/toast.js';
	import { derived } from 'svelte/store';

	const steps = [
		{ label: 'Status' },
		{ label: 'Create Bot' },
		{ label: 'Bot Token' },
		{ label: 'Configure' },
		{ label: 'Connect' },
		{ label: 'Verify' }
	];

	const defaultReadiness: ChannelReadiness = {
		id: 'telegram',
		label: 'Telegram',
		state: 'not_configured',
		summary: 'Not configured',
		detail: 'Telegram is not configured yet',
		href: '/channels/telegram',
		ctaLabel: 'Set up',
		configured: false,
		running: false
	};

	let currentStep = $state(0);
	let connState = $state('disconnected');
	let readiness = $state<ChannelReadiness>(defaultReadiness);
	let readinessLoading = $state(false);
	let botToken = $state('');
	let saving = $state(false);
	let checking = $state(false);
	let hasTelegramRpc = $state(false);
	let saveError = $state('');
	let tokenErrors = $state<TelegramTokenErrors>({});
	let lastAutoStepKey = '';

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connState = s;
			if (s === 'ready') {
				startChannelReadiness();
				void checkStatus(true);
			}
		});
		return unsub;
	});

	$effect(() => {
		const unsub = channelReadiness.subscribe((value) => {
			readiness = value.telegram;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = channelReadinessLoading.subscribe((value) => {
			readinessLoading = value;
		});
		return unsub;
	});

	$effect(() => {
		const hasMethodStore = derived(
			gatewayEvents.snapshot,
			($snap) => $snap?.features?.methods?.includes('telegram.status') ?? false
		);
		const unsub = hasMethodStore.subscribe((v) => {
			hasTelegramRpc = v;
		});
		return unsub;
	});

	$effect(() => {
		if (connState !== 'ready' || readinessLoading || saving) return;
		if (botToken.trim()) return;

		const autoStepKey = `${readiness.state}:${readiness.detail}`;
		if (autoStepKey === lastAutoStepKey) return;

		const nextStep = deriveTelegramWizardInitialStep(readiness);
		if (nextStep > currentStep || readiness.state === 'ready') {
			currentStep = nextStep;
		}
		lastAutoStepKey = autoStepKey;
	});

	let isConnected = $derived(connState === 'ready');
	let mode = $derived(deriveTelegramWizardMode(readiness));
	let title = $derived(
		mode === 'repair'
			? 'Telegram Repair'
			: mode === 'reconnect'
				? 'Telegram Reconnect'
				: 'Telegram Setup'
	);
	let canProceed = $derived.by(() => {
		if (currentStep === 0) return isConnected;
		if (currentStep === 2) {
			const validation = validateTelegramToken(botToken);
			return Object.keys(validation).length === 0;
		}
		if (currentStep === 4) return false;
		return true;
	});

	function stateTone(state: ChannelReadiness['state']): string {
		if (state === 'ready') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
		if (state === 'degraded') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
		if (state === 'misconfigured') return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
		if (state === 'needs_input') return 'border-sky-500/30 bg-sky-500/10 text-sky-100';
		return 'border-surface-border bg-surface-1/70 text-white/80';
	}

	function stateBadge(state: ChannelReadiness['state']): string {
		if (state === 'ready') return 'Ready';
		if (state === 'degraded') return 'Reconnect';
		if (state === 'misconfigured') return 'Repair';
		if (state === 'needs_input') return 'Needs input';
		return 'Not configured';
	}

	function statusHeading(): string {
		if (mode === 'ready') return 'Telegram is already healthy';
		if (mode === 'reconnect') return 'Reconnect the configured Telegram bot';
		if (mode === 'repair') return 'Repair the current Telegram setup';
		if (readiness.state === 'needs_input') return 'Finish the missing Telegram token';
		return 'Set up Telegram for operator chat';
	}

	function statusIntro(): string {
		if (mode === 'ready') {
			return 'Falcon Dash sees Telegram as ready. Review the current state or complete the wizard to return to channels.';
		}
		if (mode === 'reconnect') {
			return 'Telegram is configured but not currently running. Walk through the reconnect path and verify the bot comes back online.';
		}
		if (mode === 'repair') {
			return 'The shared readiness model found a repairable Telegram problem. Update the token or bot settings, then re-run verification.';
		}
		if (readiness.state === 'needs_input') {
			return 'Telegram is configured without a usable token. Add the full BotFather token to continue.';
		}
		return 'Telegram is the secondary guided chat channel. This flow covers first-time setup, validation, and the final readiness check.';
	}

	async function checkStatus(force = false) {
		if (connState !== 'ready') return;
		checking = true;
		try {
			await refreshChannelReadiness(force);
		} finally {
			checking = false;
		}
	}

	async function saveAndConnect() {
		tokenErrors = validateTelegramToken(botToken);
		if (Object.keys(tokenErrors).length > 0) return;

		saving = true;
		saveError = '';
		try {
			if (hasTelegramRpc) {
				await rpc('telegram.configure', { botToken: botToken.trim() });
			} else {
				const configResult = await rpc<{ raw: string; hash: string }>('config.get', {});
				const config = JSON.parse(configResult.raw);
				if (!config.channels) config.channels = {};
				config.channels.telegram = { botToken: botToken.trim() };
				await rpc('config.apply', {
					raw: JSON.stringify(config, null, 2),
					baseHash: configResult.hash
				});
			}
			addToast(
				mode === 'reconnect' ? 'Telegram reconnect requested' : 'Telegram configuration saved',
				'success'
			);
		} catch (error) {
			saveError = error instanceof Error ? error.message : String(error);
			addToast(`Telegram configuration failed: ${saveError}`, 'error');
		} finally {
			saving = false;
			await checkStatus(true);
			currentStep = 5;
		}
	}

	function openTokenStep() {
		currentStep = 2;
	}

	function handleComplete() {
		goto(resolve('/channels'));
	}
</script>

<WizardShell {title} {steps} bind:currentStep {canProceed} onComplete={handleComplete}>
	{#if currentStep === 0}
		<div class="space-y-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div class="space-y-2">
					<h3 class="text-sm font-semibold text-white">{statusHeading()}</h3>
					<p class="max-w-2xl text-sm leading-6 text-white/70">{statusIntro()}</p>
				</div>
				<span
					class="inline-flex rounded-full border px-3 py-1 text-xs font-semibold {stateTone(
						readiness.state
					)}"
				>
					{stateBadge(readiness.state)}
				</span>
			</div>

			<div class="rounded-2xl border px-4 py-4 {stateTone(readiness.state)}">
				<p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Shared readiness</p>
				<p class="mt-2 text-base font-semibold">{readiness.summary}</p>
				<p class="mt-1 text-sm leading-6 opacity-90">{readiness.detail}</p>
				<div class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
					<div class="rounded-2xl bg-black/10 px-3 py-3">
						<p class="text-xs uppercase tracking-[0.18em] opacity-65">Configured</p>
						<p class="mt-1 font-medium">{readiness.configured ? 'Yes' : 'No'}</p>
					</div>
					<div class="rounded-2xl bg-black/10 px-3 py-3">
						<p class="text-xs uppercase tracking-[0.18em] opacity-65">Running</p>
						<p class="mt-1 font-medium">{readiness.running ? 'Yes' : 'No'}</p>
					</div>
				</div>
			</div>

			<div
				class="grid gap-3 rounded-2xl border border-surface-border bg-surface-1/40 p-4 sm:grid-cols-2"
			>
				<div class="rounded-2xl bg-surface-2/80 px-4 py-3">
					<p class="text-xs uppercase tracking-[0.18em] text-white/45">Gateway</p>
					<p class="mt-1 text-sm font-medium text-white">
						{isConnected ? 'Connected' : 'Disconnected'}
					</p>
				</div>
				<div class="rounded-2xl bg-surface-2/80 px-4 py-3">
					<p class="text-xs uppercase tracking-[0.18em] text-white/45">Configure method</p>
					<p class="mt-1 text-sm font-medium text-white">
						{hasTelegramRpc ? 'telegram.configure RPC' : 'config.apply fallback'}
					</p>
				</div>
			</div>

			{#if !hasTelegramRpc}
				<p class="text-xs leading-5 text-status-muted">
					Telegram-specific RPCs are unavailable on this gateway, so Falcon Dash will write the bot
					token through the live config API.
				</p>
			{/if}
			{#if !isConnected}
				<p class="text-xs leading-5 text-status-muted">
					Connect to the live gateway first. The shared readiness model only refreshes when the
					gateway is ready.
				</p>
			{/if}
		</div>
	{:else if currentStep === 1}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Create a Telegram Bot</h3>
			<p class="text-sm leading-6 text-white/70">
				Create a new bot for first-time setup, or confirm the existing bot still has a valid token
				before attempting repair.
			</p>
			<ol class="list-decimal space-y-3 pl-5 text-sm text-white/70">
				<li>
					Open Telegram and search for <a
						href="https://t.me/BotFather"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-400 underline">@BotFather</a
					>
				</li>
				<li>
					Send <span class="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-white"
						>/newbot</span
					>
				</li>
				<li>Choose a <span class="font-semibold text-white">display name</span> for your bot</li>
				<li>
					Choose a <span class="font-semibold text-white">username</span> (must end in
					<span class="font-mono text-status-muted">bot</span>)
				</li>
				<li>
					BotFather will reply with your <span class="font-semibold text-white">bot token</span> — copy
					it
				</li>
			</ol>
			<div class="rounded border border-surface-border bg-surface-1/40 p-3">
				<p class="text-xs text-status-muted">
					If you already have a bot, send <span
						class="rounded bg-surface-3 px-1 py-0.5 font-mono text-xs text-white/70">/mybots</span
					> to @BotFather to find your token.
				</p>
			</div>
		</div>
	{:else if currentStep === 2}
		<div class="space-y-4">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 class="text-sm font-semibold text-white">Enter Bot Token</h3>
					<p class="mt-1 text-sm text-white/70">
						Use the same field for first-time setup, reconnect, and repair.
					</p>
				</div>
				<span
					class="rounded-full border px-3 py-1 text-xs font-semibold {stateTone(readiness.state)}"
				>
					{readiness.ctaLabel}
				</span>
			</div>
			<div>
				<label for="telegram-bot-token" class="mb-1 block text-sm font-medium text-white/70"
					>Bot Token</label
				>
				<input
					id="telegram-bot-token"
					type="password"
					bind:value={botToken}
					oninput={() => {
						tokenErrors = { ...tokenErrors, botToken: undefined };
					}}
					placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
					aria-invalid={tokenErrors.botToken ? 'true' : 'false'}
					class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-sm text-white placeholder-status-muted focus:border-status-info focus:outline-none"
				/>
				{#if tokenErrors.botToken}
					<p class="mt-2 text-sm text-rose-300">{tokenErrors.botToken}</p>
				{/if}
				<p class="mt-1 text-xs text-status-muted">
					The token from @BotFather (format: <span class="font-mono">number:alphanumeric</span>)
				</p>
			</div>
		</div>
	{:else if currentStep === 3}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Configure Bot Settings</h3>
			<p class="text-sm text-white/70">
				Optionally configure your bot in @BotFather before connecting. If Telegram is in repair
				mode, confirm these settings still match the current operator workflow:
			</p>
			<div class="space-y-2 text-sm text-status-muted">
				<div class="rounded border border-surface-border bg-surface-1/40 p-3 space-y-2">
					<div class="flex items-start gap-2">
						<span class="mt-0.5 font-mono text-xs text-blue-400">/setdescription</span>
						<span class="text-status-muted">— What users see before starting a chat</span>
					</div>
					<div class="flex items-start gap-2">
						<span class="mt-0.5 font-mono text-xs text-blue-400">/setabouttext</span>
						<span class="text-status-muted">— Shown in the bot's profile</span>
					</div>
					<div class="flex items-start gap-2">
						<span class="mt-0.5 font-mono text-xs text-blue-400">/setuserpic</span>
						<span class="text-status-muted">— Set the bot's avatar</span>
					</div>
					<div class="flex items-start gap-2">
						<span class="mt-0.5 font-mono text-xs text-blue-400">/setcommands</span>
						<span class="text-status-muted">— Define slash commands for users</span>
					</div>
				</div>
			</div>
			<p class="text-xs text-status-muted">
				These are optional — you can always change them later.
			</p>
		</div>
	{:else if currentStep === 4}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Save & Connect</h3>
			<div class="rounded border border-surface-border bg-surface-1/40 p-3">
				<div class="space-y-1 text-xs">
					<div class="flex justify-between">
						<span class="text-status-muted">Bot Token</span><span class="font-mono text-white/80"
							>{botToken ? '••••••••' : '--'}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="text-status-muted">Current state</span><span
							class="font-mono text-white/80">{readiness.summary}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="text-status-muted">Method</span><span class="font-mono text-white/80"
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
			{#if saveError}
				<p class="text-sm text-rose-300">{saveError}</p>
			{/if}
		</div>
	{:else if currentStep === 5}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Verification</h3>
			{#if checking}
				<div class="flex items-center gap-2">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-surface-border border-t-status-info"
					></div>
					<span class="text-sm text-status-muted">Checking...</span>
				</div>
			{:else if readiness.state === 'ready'}
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
					<p class="mt-2 text-sm text-white/70">{readiness.detail}</p>
				</div>
			{:else if readiness.state === 'degraded'}
				<div class="rounded border border-amber-600/30 bg-amber-900/20 p-4">
					<p class="text-sm text-amber-200">
						Telegram is configured but not healthy yet. {readiness.detail}
					</p>
					<button
						onclick={openTokenStep}
						class="mt-3 rounded-lg bg-surface-3 px-3 py-1.5 text-xs text-white/80 hover:bg-surface-3"
					>
						Return to bot token
					</button>
				</div>
			{:else if readiness.state === 'misconfigured' || readiness.state === 'needs_input'}
				<div class="rounded border border-rose-600/30 bg-rose-900/20 p-4">
					<p class="text-sm text-rose-200">{readiness.detail}</p>
					<button
						onclick={openTokenStep}
						class="mt-3 rounded-lg bg-surface-3 px-3 py-1.5 text-xs text-white/80 hover:bg-surface-3"
					>
						Update token
					</button>
				</div>
			{:else}
				<div class="rounded border border-amber-600/30 bg-amber-900/20 p-3">
					<p class="text-sm text-amber-400">
						Telegram is not configured yet. Start with the bot token step.
					</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<button
						onclick={openTokenStep}
						class="rounded-lg bg-surface-3 px-3 py-1.5 text-xs text-white/80 hover:bg-surface-3"
					>
						Add token
					</button>
					<button
						onclick={() => checkStatus(true)}
						class="rounded-lg bg-surface-3 px-3 py-1.5 text-xs text-white/70 hover:bg-surface-3"
					>
						Refresh
					</button>
				</div>
			{/if}
			{#if readiness.state !== 'ready'}
				<p class="text-xs leading-5 text-status-muted">
					Expected end state: shared readiness shows <span class="font-mono">ready</span> and the channels
					overview links back here with an open-wizard CTA instead of repair.
				</p>
			{/if}
		</div>
	{/if}
</WizardShell>
