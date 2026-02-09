<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { gateway } from '$lib/gateway';
	import { ConnectionState } from '$lib/gateway/types';
	import { getGatewayUrl, getToken, setGatewayUrl, setToken } from '$lib/gateway/auth';
	import { connectionState, connId, gatewayUrl, serverVersion } from '$lib/stores';

	interface Props {
		oncomplete?: () => void;
		onskip?: () => void;
	}

	let { oncomplete, onskip }: Props = $props();

	let step = $state(0);
	let url = $state(getGatewayUrl());
	let token = $state(getToken() || '');
	let connecting = $state(false);
	let connectionError = $state('');
	let connectionSuccess = $state(false);
	let pairingRequired = $state(false);
	let tourStep = $state(0);

	const totalSteps = 6;

	const tourHighlights = [
		{
			title: 'Sidebar Navigation',
			description:
				'Access your chat sessions, custom apps, and navigate between modules from the sidebar. On mobile, use the bottom tab bar.'
		},
		{
			title: 'Chat',
			description:
				'Converse with your OpenClaw AI agents. Create sessions, send messages, and monitor agent thinking and tool usage.'
		},
		{
			title: 'Projects',
			description:
				'Manage your projects with domains, tasks, and milestones. Use the Kanban board or list view to organize work.'
		},
		{
			title: 'Settings',
			description:
				'Configure your gateway connection, manage devices, view system status, and customize your dashboard preferences.'
		}
	];

	function next() {
		if (step < totalSteps - 1) {
			step += 1;
		}
	}

	function prev() {
		if (step > 0) {
			step -= 1;
		}
	}

	function skip() {
		markComplete();
		onskip?.();
	}

	function finish() {
		markComplete();
		oncomplete?.();
	}

	function markComplete() {
		try {
			localStorage.setItem('falcon-dash:onboarding-completed', 'true');
		} catch {
			// localStorage unavailable
		}
	}

	async function testConnection() {
		connectionError = '';
		connectionSuccess = false;
		pairingRequired = false;
		connecting = true;

		setGatewayUrl(url);
		setToken(token);

		try {
			const payload = await gateway.connect({ url, token });
			gatewayUrl.set(url);
			connId.set(payload.server.connId);
			serverVersion.set(payload.server.version);
			connectionSuccess = true;
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Connection failed';
			if ($connectionState === ConnectionState.PAIRING_REQUIRED) {
				pairingRequired = true;
			} else {
				connectionError = msg;
			}
		} finally {
			connecting = false;
		}
	}

	function nextTourStep() {
		if (tourStep < tourHighlights.length - 1) {
			tourStep += 1;
		} else {
			next();
		}
	}

	function prevTourStep() {
		if (tourStep > 0) {
			tourStep -= 1;
		}
	}

	function setTourStep(i: number) {
		tourStep = i;
	}

	let canProceedFromUrl = $derived(url.startsWith('ws://') || url.startsWith('wss://'));
	let canProceedFromToken = $derived(token.length > 0);
	let progressPercent = $derived(Math.round(((step + 1) / totalSteps) * 100));
</script>

<div
	class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/95 p-4"
	transition:fade={{ duration: 200 }}
>
	<div
		class="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-label="Onboarding wizard"
	>
		<!-- Progress bar -->
		<div class="h-1 rounded-t-xl bg-slate-700">
			<div
				class="h-full rounded-tl-xl bg-blue-500 transition-all duration-300"
				style="width: {progressPercent}%"
				role="progressbar"
				aria-valuenow={progressPercent}
				aria-valuemin={0}
				aria-valuemax={100}
			/>
		</div>

		<!-- Skip button -->
		<button
			onclick={skip}
			class="absolute right-4 top-4 text-sm text-slate-500 hover:text-slate-300"
			aria-label="Skip onboarding wizard"
		>
			Skip
		</button>

		<!-- Step content -->
		<div class="p-8">
			{#if step === 0}
				<!-- Step 1: Welcome -->
				<div in:fly={{ x: 50, duration: 200 }}>
					<div class="mb-6 text-center">
						<div
							class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/20"
						>
							<svg
								class="h-8 w-8 text-blue-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 10V3L4 14h7v7l9-11h-7z"
								/>
							</svg>
						</div>
						<h2 class="text-2xl font-bold text-slate-100">Welcome to Falcon Dash</h2>
						<p class="mt-2 text-sm text-slate-400">
							Your control center for the OpenClaw AI platform. Let's get you connected in a few
							quick steps.
						</p>
					</div>
					<div class="space-y-3 text-sm text-slate-400">
						<div class="flex items-start gap-3">
							<span
								class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs text-blue-400"
								>1</span
							>
							<span>Configure your gateway connection</span>
						</div>
						<div class="flex items-start gap-3">
							<span
								class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs text-blue-400"
								>2</span
							>
							<span>Test the connection to your OpenClaw instance</span>
						</div>
						<div class="flex items-start gap-3">
							<span
								class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs text-blue-400"
								>3</span
							>
							<span>Take a quick tour of the dashboard</span>
						</div>
					</div>
				</div>
			{:else if step === 1}
				<!-- Step 2: Gateway URL -->
				<div in:fly={{ x: 50, duration: 200 }}>
					<h2 class="mb-1 text-xl font-bold text-slate-100">Gateway URL</h2>
					<p class="mb-6 text-sm text-slate-400">
						Enter the WebSocket URL of your OpenClaw Gateway. Most users can keep the default.
					</p>
					<div>
						<label for="wizard-gateway-url" class="block text-sm font-medium text-slate-300">
							Gateway URL
						</label>
						<input
							id="wizard-gateway-url"
							type="text"
							bind:value={url}
							placeholder="ws://127.0.0.1:18789"
							class="mt-1 block w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
						{#if url && !canProceedFromUrl}
							<p class="mt-1 text-xs text-amber-400">URL must start with ws:// or wss://</p>
						{/if}
					</div>
				</div>
			{:else if step === 2}
				<!-- Step 3: Token -->
				<div in:fly={{ x: 50, duration: 200 }}>
					<h2 class="mb-1 text-xl font-bold text-slate-100">Gateway Token</h2>
					<p class="mb-6 text-sm text-slate-400">
						Paste the authentication token from your OpenClaw Gateway CLI.
					</p>
					<div>
						<label for="wizard-gateway-token" class="block text-sm font-medium text-slate-300">
							Token
						</label>
						<input
							id="wizard-gateway-token"
							type="password"
							bind:value={token}
							placeholder="Paste your gateway token"
							class="mt-1 block w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
						<p class="mt-2 text-xs text-slate-500">
							You can find this token in your gateway configuration or by running the CLI setup
							command.
						</p>
					</div>
				</div>
			{:else if step === 3}
				<!-- Step 4: Connection Test -->
				<div in:fly={{ x: 50, duration: 200 }}>
					<h2 class="mb-1 text-xl font-bold text-slate-100">Test Connection</h2>
					<p class="mb-6 text-sm text-slate-400">
						Let's verify that Falcon Dash can reach your gateway.
					</p>

					{#if !connectionSuccess && !pairingRequired}
						<div class="text-center">
							{#if connecting}
								<div class="flex items-center justify-center gap-3 py-4">
									<div
										class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
									/>
									<span class="text-sm text-slate-300">Connecting to gateway...</span>
								</div>
							{:else}
								<button
									onclick={testConnection}
									class="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
								>
									Test Connection
								</button>
							{/if}

							{#if connectionError}
								<div
									class="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3"
									role="alert"
									aria-live="assertive"
								>
									<p class="text-sm text-red-400">{connectionError}</p>
									<button
										onclick={testConnection}
										class="mt-2 text-sm text-blue-400 hover:text-blue-300"
									>
										Try again
									</button>
								</div>
							{/if}
						</div>
					{:else if pairingRequired}
						<!-- Pairing Required -->
						<div class="rounded border border-amber-500/30 bg-amber-500/10 p-4">
							<h3 class="mb-2 font-semibold text-amber-400">Device Pairing Required</h3>
							<p class="mb-3 text-sm text-slate-300">
								Your gateway requires device approval. Follow these steps:
							</p>
							<ol class="space-y-2 text-sm text-slate-400">
								<li class="flex gap-2">
									<span class="font-mono text-amber-400">1.</span>
									Open a terminal on the machine running your gateway
								</li>
								<li class="flex gap-2">
									<span class="font-mono text-amber-400">2.</span>
									Run the gateway CLI and look for the pending device approval
								</li>
								<li class="flex gap-2">
									<span class="font-mono text-amber-400">3.</span>
									Approve this device, then click "Retry" below
								</li>
							</ol>
							<button
								onclick={testConnection}
								class="mt-4 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
							>
								Retry Connection
							</button>
						</div>
					{:else}
						<div class="rounded border border-green-500/30 bg-green-500/10 p-4 text-center">
							<svg
								class="mx-auto h-8 w-8 text-green-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
							<h3 class="mt-2 font-semibold text-green-400">Connected Successfully</h3>
							<p class="mt-1 text-sm text-slate-400">
								Gateway v{$serverVersion} &middot; {$connId}
							</p>
						</div>
					{/if}
				</div>
			{:else if step === 4}
				<!-- Step 5: Quick Tour -->
				<div in:fly={{ x: 50, duration: 200 }}>
					<h2 class="mb-1 text-xl font-bold text-slate-100">Quick Tour</h2>
					<p class="mb-6 text-sm text-slate-400">
						Here's a quick overview of what you can do with Falcon Dash.
					</p>

					<div class="rounded-lg border border-slate-600 bg-slate-700/50 p-5">
						<div class="mb-3 flex items-center gap-2">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
							>
								{tourStep + 1}
							</span>
							<h3 class="font-semibold text-slate-100">
								{tourHighlights[tourStep].title}
							</h3>
						</div>
						<p class="text-sm text-slate-300">
							{tourHighlights[tourStep].description}
						</p>

						<!-- Tour dots -->
						<div class="mt-4 flex items-center justify-center gap-2">
							{#each tourHighlights as highlight, i (i)}
								<button
									onclick={() => setTourStep(i)}
									class="h-2 w-2 rounded-full transition-colors {i === tourStep
										? 'bg-blue-400'
										: 'bg-slate-600'}"
									aria-label="Go to tour item {i + 1}: {highlight.title}"
								/>
							{/each}
						</div>
					</div>

					<div class="mt-4 flex justify-between">
						<button
							onclick={prevTourStep}
							disabled={tourStep === 0}
							class="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
						>
							Previous
						</button>
						<button
							onclick={nextTourStep}
							class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
						>
							{tourStep === tourHighlights.length - 1 ? 'Continue' : 'Next'}
						</button>
					</div>
				</div>
			{:else if step === 5}
				<!-- Final: All done -->
				<div in:fly={{ x: 50, duration: 200 }}>
					<div class="text-center">
						<div
							class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600/20"
						>
							<svg
								class="h-8 w-8 text-green-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<h2 class="text-2xl font-bold text-slate-100">You're All Set!</h2>
						<p class="mt-2 text-sm text-slate-400">
							Falcon Dash is ready to use. Head to the Chat tab to start interacting with your AI
							agents.
						</p>
						<button
							onclick={finish}
							class="mt-6 rounded bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
						>
							Get Started
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Navigation footer (not shown on tour or final step) -->
		{#if step < 4}
			<div class="flex items-center justify-between border-t border-slate-700 px-8 py-4">
				<button
					onclick={prev}
					disabled={step === 0}
					class="text-sm text-slate-400 hover:text-slate-200 disabled:invisible"
				>
					Back
				</button>

				<span class="text-xs text-slate-500">
					Step {step + 1} of {totalSteps}
				</span>

				{#if step === 0}
					<button
						onclick={next}
						class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
					>
						Get Started
					</button>
				{:else if step === 1}
					<button
						onclick={next}
						disabled={!canProceedFromUrl}
						class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Continue
					</button>
				{:else if step === 2}
					<button
						onclick={next}
						disabled={!canProceedFromToken}
						class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Continue
					</button>
				{:else if step === 3}
					<button
						onclick={next}
						class="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
					>
						{connectionSuccess ? 'Continue' : 'Skip for Now'}
					</button>
				{/if}
			</div>
		{:else if step === 5}
			<!-- No footer on final step -->
		{/if}
	</div>
</div>
