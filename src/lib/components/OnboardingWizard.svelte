<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		onComplete: () => void;
	}

	let { onComplete }: Props = $props();

	let currentStep = $state(1);
	let gatewayUrl = $state('ws://127.0.0.1:18789');
	let token = $state('');
	let connectionStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
	let errorMessage = $state('');

	const STORAGE_KEY = 'falcon-dash-onboarded';

	async function testConnection() {
		connectionStatus = 'testing';
		errorMessage = '';
		try {
			const ws = new WebSocket(gatewayUrl);
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					ws.close();
					reject(new Error('Connection timeout'));
				}, 5000);
				ws.onopen = () => {
					clearTimeout(timeout);
					ws.close();
					resolve();
				};
				ws.onerror = () => {
					clearTimeout(timeout);
					reject(new Error('Connection failed'));
				};
			});
			connectionStatus = 'success';
		} catch (err) {
			connectionStatus = 'error';
			errorMessage = err instanceof Error ? err.message : 'Connection failed';
		}
	}

	function nextStep() {
		if (currentStep < 6) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	function finish() {
		localStorage.setItem(STORAGE_KEY, 'true');
		localStorage.setItem('falcon-dash-gateway-url', gatewayUrl);
		if (token) {
			localStorage.setItem('falcon-dash-token', token);
		}
		onComplete();
	}
</script>

<div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
	<div class="bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full p-8">
		{#if currentStep === 1}
			<div class="text-center">
				<div class="text-6xl mb-4">🦅</div>
				<h1 class="text-3xl font-bold mb-4">Welcome to Falcon Dash</h1>
				<p class="text-gray-400 mb-8">
					The control center for your OpenClaw AI platform. Let's get you set up in just a few
					steps.
				</p>
				<button
					onclick={nextStep}
					class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium"
				>
					Get Started
				</button>
			</div>
		{:else if currentStep === 2}
			<h2 class="text-2xl font-bold mb-4">Gateway Connection</h2>
			<p class="text-gray-400 mb-6">Enter your OpenClaw Gateway WebSocket URL.</p>
			<div class="mb-4">
				<label class="block text-sm font-medium mb-2">Gateway URL</label>
				<input
					type="text"
					bind:value={gatewayUrl}
					placeholder="ws://127.0.0.1:18789"
					class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<button
				onclick={testConnection}
				disabled={connectionStatus === 'testing'}
				class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded mb-4 disabled:opacity-50"
			>
				{connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
			</button>
			{#if connectionStatus === 'success'}
				<p class="text-green-500 mb-4">✓ Connection successful</p>
			{:else if connectionStatus === 'error'}
				<p class="text-red-500 mb-4">✗ {errorMessage}</p>
			{/if}
			<div class="flex gap-4">
				<button onclick={prevStep} class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg">
					Back
				</button>
				<button
					onclick={nextStep}
					disabled={connectionStatus !== 'success'}
					class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
				>
					Next
				</button>
			</div>
		{:else if currentStep === 3}
			<h2 class="text-2xl font-bold mb-4">Authentication</h2>
			<p class="text-gray-400 mb-6">Paste your authentication token to connect.</p>
			<div class="mb-4">
				<label class="block text-sm font-medium mb-2">Token</label>
				<textarea
					bind:value={token}
					placeholder="Paste your token here..."
					class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
				></textarea>
			</div>
			<div class="flex gap-4">
				<button onclick={prevStep} class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg">
					Back
				</button>
				<button
					onclick={nextStep}
					disabled={!token}
					class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
				>
					Next
				</button>
			</div>
		{:else if currentStep === 4}
			<h2 class="text-2xl font-bold mb-4">Discord Integration</h2>
			<p class="text-gray-400 mb-6">
				Connect your Discord bot to receive notifications and interact with agents.
			</p>
			<p class="text-sm text-gray-500 mb-6">You can configure this later in Settings.</p>
			<div class="flex gap-4">
				<button onclick={prevStep} class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg">
					Back
				</button>
				<button onclick={nextStep} class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg">
					Skip for Now
				</button>
				<button
					onclick={() => {
						/* TODO: open Discord settings */
						nextStep();
					}}
					class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium"
				>
					Configure Discord
				</button>
			</div>
		{:else if currentStep === 5}
			<h2 class="text-2xl font-bold mb-4">Password Vault</h2>
			<p class="text-gray-400 mb-6">
				Create a secure vault for storing passwords and sensitive data.
			</p>
			<p class="text-sm text-gray-500 mb-6">You can set this up later in Settings.</p>
			<div class="flex gap-4">
				<button onclick={prevStep} class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg">
					Back
				</button>
				<button onclick={nextStep} class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg">
					Skip for Now
				</button>
				<button
					onclick={() => {
						/* TODO: open vault creation */
						nextStep();
					}}
					class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium"
				>
					Create Vault
				</button>
			</div>
		{:else if currentStep === 6}
			<div class="text-center">
				<div class="text-6xl mb-4">✓</div>
				<h2 class="text-3xl font-bold mb-4">You're All Set!</h2>
				<p class="text-gray-400 mb-8">
					Falcon Dash is ready to go. Start managing your agents and conversations.
				</p>
				<button
					onclick={finish}
					class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium"
				>
					Get Started
				</button>
			</div>
		{/if}

		<div class="mt-8 flex justify-center gap-2">
			{#each [1, 2, 3, 4, 5, 6] as step}
				<div
					class="w-2 h-2 rounded-full {step === currentStep
						? 'bg-blue-600'
						: step < currentStep
							? 'bg-blue-800'
							: 'bg-gray-700'}"
				></div>
			{/each}
		</div>
	</div>
</div>
