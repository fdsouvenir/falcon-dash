<script lang="ts">
	import { gatewayToken, gatewayUrl } from '$lib/stores/token.js';
	import { connection, pairingState } from '$lib/stores/gateway.js';
	import { ensureDeviceIdentity } from '$lib/gateway/device-identity.js';
	import type { ConnectionState } from '$lib/gateway/types.js';
	import type { PairingState } from '$lib/stores/gateway.js';

	let token = $state('');
	let url = $state('ws://127.0.0.1:18789');
	let error = $state('');
	let copiedAgent = $state(false);
	let copiedTroubleshoot = $state(false);
	let deviceId = $state<string | null>(null);
	let connectionState = $state<ConnectionState>('DISCONNECTED');
	let pairing = $state<PairingState>({ status: 'idle', retryCount: 0, maxRetries: 10 });

	// Initialize url from store
	$effect(() => {
		const unsub = gatewayUrl.subscribe((v) => {
			url = v;
		});
		return unsub;
	});

	$effect(() => {
		ensureDeviceIdentity().then((id) => {
			deviceId = id.deviceId;
		});
	});

	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = pairingState.subscribe((s) => {
			pairing = s;
		});
		return unsub;
	});

	let wsWarning = $state('');

	function isLoopback(hostname: string): boolean {
		return (
			hostname === '127.0.0.1' ||
			hostname === 'localhost' ||
			hostname === '::1' ||
			hostname === '[::1]'
		);
	}

	function validateWsUrl(rawUrl: string): string | null {
		try {
			const parsed = new URL(rawUrl);
			if (parsed.protocol === 'ws:' && !isLoopback(parsed.hostname)) {
				return `Plaintext ws:// to non-loopback host "${parsed.hostname}" will be rejected by OpenClaw v2026.2.19+. Use wss:// for remote connections.`;
			}
		} catch {
			// Invalid URL — let the WebSocket constructor handle the error
		}
		return null;
	}

	function handleSubmit() {
		const trimmed = token.trim();
		if (!trimmed) {
			error = 'Please enter a gateway token';
			return;
		}
		error = '';
		const finalUrl = url.trim() || 'ws://127.0.0.1:18789';
		wsWarning = validateWsUrl(finalUrl) ?? '';
		gatewayUrl.set(finalUrl);
		gatewayToken.set(trimmed);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	}

	const agentMessage =
		'I need a gateway token for the Falcon Dashboard control UI. ' +
		'Please generate one with operator.read and operator.write scopes.';
	const troubleshootMessage =
		"I'm having trouble connecting the Falcon Dashboard. " +
		'Please check that gateway.controlUi.allowInsecureAuth is set to true ' +
		'and the gateway is running on the expected port.';

	async function copyText(text: string, which: 'agent' | 'troubleshoot') {
		try {
			await navigator.clipboard.writeText(text);
			if (which === 'agent') {
				copiedAgent = true;
				setTimeout(() => (copiedAgent = false), 2000);
			} else {
				copiedTroubleshoot = true;
				setTimeout(() => (copiedTroubleshoot = false), 2000);
			}
		} catch {
			// Clipboard API may fail in insecure contexts
		}
	}

	let shortDeviceId = $derived(deviceId ? deviceId.slice(0, 12) + '...' : null);
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-8">
	<div class="w-full max-w-md space-y-6">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-2xl font-bold text-white">Self-Hosted</h1>
			<p class="mt-1 text-sm text-gray-400">Connect to your OpenClaw Gateway</p>
		</div>

		<!-- Connection form -->
		<div class="space-y-4">
			<div>
				<label for="gateway-url" class="mb-1.5 block text-sm font-medium text-gray-300">
					Gateway URL
				</label>
				<input
					id="gateway-url"
					type="text"
					bind:value={url}
					placeholder="ws://127.0.0.1:18789"
					class="w-full rounded-xl border border-gray-700 bg-gray-800/80 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="gateway-token" class="mb-1.5 block text-sm font-medium text-gray-300">
					Gateway Token
				</label>
				<input
					id="gateway-token"
					type="password"
					bind:value={token}
					onkeydown={handleKeydown}
					placeholder="Paste your gateway token"
					class="w-full rounded-xl border border-gray-700 bg-gray-800/80 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}

			{#if wsWarning}
				<div class="flex gap-2 rounded-xl border border-yellow-500/20 bg-yellow-950/30 px-4 py-3">
					<svg
						class="mt-0.5 h-4 w-4 shrink-0 text-yellow-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
						/>
					</svg>
					<p class="text-xs text-yellow-300">{wsWarning}</p>
				</div>
			{/if}

			<button
				onclick={handleSubmit}
				class="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 transition-colors"
			>
				Connect
			</button>

			<!-- Connection state feedback -->
			{#if connectionState === 'CONNECTING' || connectionState === 'AUTHENTICATING'}
				<div
					class="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-3"
				>
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"
					></div>
					<span class="text-sm text-blue-300">Connecting to gateway...</span>
				</div>
			{:else if connectionState === 'PAIRING_REQUIRED'}
				<div class="rounded-xl border border-yellow-500/20 bg-yellow-950/30 px-4 py-3">
					<div class="flex items-center gap-3">
						<div class="h-4 w-4 animate-pulse rounded-full bg-yellow-400"></div>
						<span class="text-sm text-yellow-300">Waiting for device approval...</span>
					</div>
					<p class="mt-2 text-xs text-yellow-200/70">
						Attempt {pairing.retryCount}/{pairing.maxRetries}
					</p>
					{#if shortDeviceId}
						<p class="mt-2 text-xs text-gray-400">
							Device ID: <code class="font-mono text-yellow-300">{shortDeviceId}</code>
						</p>
					{/if}
					<p class="mt-2 text-xs text-gray-400">
						Run <code class="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-yellow-300"
							>openclaw devices approve</code
						> in your terminal
					</p>
				</div>
			{/if}
		</div>

		<!-- What is device pairing? -->
		<details class="rounded-xl border border-gray-800 bg-gray-900/60">
			<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-300 hover:text-white">
				What is device pairing?
			</summary>
			<div class="px-4 pb-3 text-xs leading-relaxed text-gray-400">
				<p>
					Device pairing ensures only authorized devices can connect to your gateway. When you
					connect for the first time, the gateway requires approval.
				</p>
				<p class="mt-2">
					To approve this device, run <code
						class="rounded bg-gray-800 px-1 py-0.5 font-mono text-teal-300"
						>openclaw devices approve</code
					> in your terminal, or ask your agent to approve it.
				</p>
			</div>
		</details>

		<!-- Ask your agent card -->
		<div class="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
			<div class="mb-2 flex items-center gap-2">
				<div class="h-1 w-1 rounded-full bg-teal-500"></div>
				<span class="text-sm font-medium text-teal-400">Ask your agent</span>
			</div>
			<p class="mb-3 text-xs leading-relaxed text-gray-400">
				Copy this message and send it to your OpenClaw agent to get a token:
			</p>
			<div
				class="rounded-lg border border-teal-500/20 bg-teal-950/30 px-3 py-2 text-xs text-gray-300"
			>
				{agentMessage}
			</div>
			<button
				onclick={() => copyText(agentMessage, 'agent')}
				class="mt-2 flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors"
			>
				{#if copiedAgent}
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
					Copied!
				{:else}
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
					Copy to clipboard
				{/if}
			</button>
		</div>

		<!-- Troubleshooting card -->
		<div class="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
			<div class="mb-2 flex items-center gap-2">
				<div class="h-1 w-1 rounded-full bg-orange-500"></div>
				<span class="text-sm font-medium text-orange-400">Troubleshooting</span>
			</div>
			<p class="mb-3 text-xs leading-relaxed text-gray-400">
				Having trouble connecting? Send this to your agent for help:
			</p>
			<div
				class="rounded-lg border border-orange-500/20 bg-orange-950/30 px-3 py-2 text-xs text-gray-300"
			>
				{troubleshootMessage}
			</div>
			<button
				onclick={() => copyText(troubleshootMessage, 'troubleshoot')}
				class="mt-2 flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
			>
				{#if copiedTroubleshoot}
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
					Copied!
				{:else}
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
					Copy to clipboard
				{/if}
			</button>
		</div>
	</div>
</div>
