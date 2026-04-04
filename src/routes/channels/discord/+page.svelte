<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import WizardShell from '$lib/components/wizard/WizardShell.svelte';
	import {
		deriveDiscordWizardInitialStep,
		deriveDiscordWizardMode,
		validateDiscordCredentials,
		type DiscordCredentialErrors
	} from '$lib/channels/discord-wizard.js';
	import { gatewayEvents, rpc } from '$lib/gateway-api.js';
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
		{ label: 'Create App' },
		{ label: 'Credentials' },
		{ label: 'Invite Bot' },
		{ label: 'Connect' },
		{ label: 'Verify' }
	];

	const defaultReadiness: ChannelReadiness = {
		id: 'discord',
		label: 'Discord',
		state: 'not_configured',
		summary: 'Not configured',
		detail: 'Discord is not configured yet',
		href: '/channels/discord',
		ctaLabel: 'Set up',
		configured: false,
		running: false
	};

	let currentStep = $state(0);
	let connState = $state('disconnected');
	let readiness = $state<ChannelReadiness>(defaultReadiness);
	let readinessLoading = $state(false);
	let clientId = $state('');
	let botToken = $state('');
	let saving = $state(false);
	let checking = $state(false);
	let hasDiscordRpc = $state(false);
	let saveError = $state('');
	let credentialErrors = $state<DiscordCredentialErrors>({});
	let lastAutoStepKey = '';

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((state) => {
			connState = state;
			if (state === 'ready') {
				startChannelReadiness();
				void checkStatus(true);
			}
		});
		return unsub;
	});

	$effect(() => {
		const unsub = channelReadiness.subscribe((value) => {
			readiness = value.discord;
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
			($snap) => $snap?.features?.methods?.includes('discord.status') ?? false
		);
		const unsub = hasMethodStore.subscribe((value) => {
			hasDiscordRpc = value;
		});
		return unsub;
	});

	$effect(() => {
		if (connState !== 'ready' || readinessLoading || saving) return;
		if (clientId.trim() || botToken.trim()) return;

		const autoStepKey = `${readiness.state}:${readiness.detail}`;
		if (autoStepKey === lastAutoStepKey) return;

		const nextStep = deriveDiscordWizardInitialStep(readiness);
		if (nextStep > currentStep || readiness.state === 'ready') {
			currentStep = nextStep;
		}
		lastAutoStepKey = autoStepKey;
	});

	let isConnected = $derived(connState === 'ready');
	let mode = $derived(deriveDiscordWizardMode(readiness));
	let title = $derived(
		mode === 'repair'
			? 'Discord Repair'
			: mode === 'reconnect'
				? 'Discord Reconnect'
				: 'Discord Setup'
	);
	let canProceed = $derived.by(() => {
		if (currentStep === 0) return isConnected;
		if (currentStep === 2) {
			const validation = validateDiscordCredentials(clientId, botToken);
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
		if (mode === 'ready') return 'Discord is already healthy';
		if (mode === 'reconnect') return 'Reconnect the configured bot';
		if (mode === 'repair') return 'Repair the current Discord setup';
		if (readiness.state === 'needs_input') return 'Finish the missing Discord credentials';
		return 'Set up Discord for operator chat';
	}

	function statusIntro(): string {
		if (mode === 'ready')
			return 'Falcon Dash sees Discord as ready. Review the current status or complete the wizard to return to channels.';
		if (mode === 'reconnect')
			return 'The bot configuration exists, but the gateway is not connected right now. Walk through the reconnect path and verify the bot comes back online.';
		if (mode === 'repair')
			return 'The shared readiness model found a repairable Discord error. Update credentials or bot access, then re-run verification.';
		if (readiness.state === 'needs_input')
			return 'Discord is configured without usable credentials. Add a valid client ID and bot token to continue.';
		return 'Discord is the primary guided chat channel. This flow covers first-time setup, validation, and the final readiness check.';
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
		credentialErrors = validateDiscordCredentials(clientId, botToken);
		if (Object.keys(credentialErrors).length > 0) return;

		saving = true;
		saveError = '';
		try {
			if (hasDiscordRpc) {
				await rpc('discord.configure', { clientId: clientId.trim(), botToken: botToken.trim() });
			} else {
				const configResult = await rpc<{ raw: string; hash: string }>('config.get', {});
				const config = JSON.parse(configResult.raw);
				if (!config.channels) config.channels = {};
				config.channels.discord = { token: botToken.trim() };
				await rpc('config.apply', {
					raw: JSON.stringify(config, null, 2),
					baseHash: configResult.hash
				});
			}
			addToast(
				mode === 'reconnect' ? 'Discord reconnect requested' : 'Discord configuration saved',
				'success'
			);
		} catch (error) {
			saveError = error instanceof Error ? error.message : String(error);
			addToast(`Discord configuration failed: ${saveError}`, 'error');
		} finally {
			saving = false;
			await checkStatus(true);
			currentStep = 5;
		}
	}

	function generateOAuthUrl(): string {
		if (!clientId.trim()) return '';
		return `https://discord.com/api/oauth2/authorize?client_id=${clientId.trim()}&permissions=2048&scope=bot`;
	}

	function openCredentialsStep() {
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
						{hasDiscordRpc ? 'discord.configure RPC' : 'config.apply fallback'}
					</p>
				</div>
			</div>

			{#if !hasDiscordRpc}
				<p class="text-xs leading-5 text-status-muted">
					Discord-specific RPCs are unavailable on this gateway, so Falcon Dash will write the
					channel token through the live config API.
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
			<h3 class="text-sm font-semibold text-white">Create a Discord application</h3>
			<p class="text-sm leading-6 text-white/70">
				Create a bot if this is a new setup, or confirm the existing application still has the right
				token and intents before attempting repair.
			</p>
			<ol class="list-decimal space-y-3 pl-5 text-sm text-white/70">
				<li>
					Go to the
					<a
						href="https://discord.com/developers/applications"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-400 underline"
					>
						Discord Developer Portal
					</a>
				</li>
				<li>Open your application or create a new one.</li>
				<li>In the Bot tab, confirm the bot exists and can be reset if the token was revoked.</li>
				<li>Enable Message Content Intent under Privileged Gateway Intents.</li>
				<li>
					Copy the numeric Client ID from General Information and the full bot token from Bot.
				</li>
			</ol>
		</div>
	{:else if currentStep === 2}
		<div class="space-y-4">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 class="text-sm font-semibold text-white">Enter credentials</h3>
					<p class="mt-1 text-sm text-white/70">
						Use the same fields for first-time setup, reconnect, and repair.
					</p>
				</div>
				<span
					class="rounded-full border px-3 py-1 text-xs font-semibold {stateTone(readiness.state)}"
				>
					{readiness.ctaLabel}
				</span>
			</div>
			<div>
				<label for="discord-client-id" class="mb-1 block text-sm font-medium text-white/70">
					Client ID
				</label>
				<input
					id="discord-client-id"
					type="text"
					bind:value={clientId}
					oninput={() => {
						credentialErrors = { ...credentialErrors, clientId: undefined };
					}}
					placeholder="123456789012345678"
					aria-invalid={credentialErrors.clientId ? 'true' : 'false'}
					class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-sm text-white placeholder-status-muted focus:border-status-info focus:outline-none"
				/>
				<p class="mt-1 text-xs text-status-muted">General Information → Application ID</p>
				{#if credentialErrors.clientId}
					<p class="mt-2 text-xs text-rose-300">{credentialErrors.clientId}</p>
				{/if}
			</div>
			<div>
				<label for="discord-bot-token" class="mb-1 block text-sm font-medium text-white/70">
					Bot Token
				</label>
				<input
					id="discord-bot-token"
					type="password"
					bind:value={botToken}
					oninput={() => {
						credentialErrors = { ...credentialErrors, botToken: undefined };
					}}
					placeholder="Paste the full bot token"
					aria-invalid={credentialErrors.botToken ? 'true' : 'false'}
					class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-sm text-white placeholder-status-muted focus:border-status-info focus:outline-none"
				/>
				<p class="mt-1 text-xs text-status-muted">
					Store a fresh token if the old one was rotated or rejected.
				</p>
				{#if credentialErrors.botToken}
					<p class="mt-2 text-xs text-rose-300">{credentialErrors.botToken}</p>
				{/if}
			</div>
		</div>
	{:else if currentStep === 3}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">Invite or re-authorize the bot</h3>
			<p class="text-sm leading-6 text-white/70">
				Use this step for both new installs and repair work when the bot lost server access.
			</p>
			{#if clientId.trim()}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external Discord OAuth URL -->
				<a
					href={generateOAuthUrl()}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4752C4]"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z"
						/>
					</svg>
					Open Discord authorization
				</a>
				<p class="text-xs leading-5 text-status-muted">
					Choose the server where operators should interact with the bot, then confirm the bot can
					read and respond in the intended channel.
				</p>
			{:else}
				<div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
					<p class="text-sm text-amber-100">
						Enter the Client ID first so Falcon Dash can generate the invite link.
					</p>
					<button
						onclick={openCredentialsStep}
						class="mt-3 rounded-full border border-amber-400/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/10"
					>
						Back to credentials
					</button>
				</div>
			{/if}
		</div>
	{:else if currentStep === 4}
		<div class="space-y-4">
			<h3 class="text-sm font-semibold text-white">
				{mode === 'reconnect'
					? 'Reconnect Discord'
					: mode === 'repair'
						? 'Save repair changes'
						: 'Save and connect'}
			</h3>
			<div class="rounded-2xl border border-surface-border bg-surface-1/40 p-4">
				<div class="space-y-2 text-xs text-white/70">
					<div class="flex items-center justify-between gap-3">
						<span>Client ID</span>
						<span class="font-mono text-white/85">{clientId || '--'}</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span>Bot Token</span>
						<span class="font-mono text-white/85">{botToken ? '••••••••' : '--'}</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span>Readiness action</span>
						<span class="font-mono text-white/85">{readiness.ctaLabel}</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span>Configure method</span>
						<span class="font-mono text-white/85">
							{hasDiscordRpc ? 'discord.configure RPC' : 'config.apply fallback'}
						</span>
					</div>
				</div>
			</div>
			<button
				onclick={saveAndConnect}
				disabled={saving || Object.keys(validateDiscordCredentials(clientId, botToken)).length > 0}
				class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
			>
				{saving
					? 'Applying…'
					: mode === 'reconnect'
						? 'Reconnect Discord'
						: mode === 'repair'
							? 'Save repair'
							: 'Save & Connect'}
			</button>
		</div>
	{:else if currentStep === 5}
		<div class="space-y-4">
			<div class="flex items-center justify-between gap-3">
				<h3 class="text-sm font-semibold text-white">Verification</h3>
				<button
					onclick={() => checkStatus(true)}
					class="rounded-full border border-surface-border px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-surface-2"
				>
					Refresh status
				</button>
			</div>

			{#if checking || readinessLoading}
				<div class="flex items-center gap-2 text-sm text-status-muted">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-surface-border border-t-status-info"
					></div>
					<span>Refreshing Discord readiness…</span>
				</div>
			{:else if readiness.state === 'ready'}
				<div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
					<div class="flex items-center gap-2 text-emerald-200">
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span class="font-medium">Discord is ready</span>
					</div>
					<p class="mt-2 text-sm text-white/80">{readiness.detail}</p>
				</div>
			{:else}
				<div class="rounded-2xl border px-4 py-4 {stateTone(readiness.state)}">
					<p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
						Action required
					</p>
					<p class="mt-2 text-base font-semibold">{readiness.summary}</p>
					<p class="mt-1 text-sm leading-6 opacity-90">{readiness.detail}</p>
					{#if saveError}
						<p class="mt-3 text-xs text-rose-200">Last configure error: {saveError}</p>
					{/if}
				</div>
				<div class="flex flex-col gap-3 sm:flex-row">
					<button
						onclick={openCredentialsStep}
						class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
					>
						{readiness.ctaLabel}
					</button>
					<a
						href={resolve('/channels')}
						class="rounded-full border border-surface-border px-4 py-2 text-center text-sm font-semibold text-white/75 hover:bg-surface-2"
					>
						Back to channels
					</a>
				</div>
			{/if}
		</div>
	{/if}
</WizardShell>
