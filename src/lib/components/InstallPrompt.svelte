<script lang="ts">
	import { installPromptAvailable, triggerInstall } from '$lib/pwa/service-worker-registration.js';

	const DISMISS_KEY = 'falcon-install-prompt-dismissed';

	let available = $state(false);
	let dismissed = $state(false);
	let isStandalone = $state(false);
	let isIOS = $state(false);
	let showIOSTip = $state(false);

	$effect(() => {
		// Check if already running as installed app
		isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as unknown as Record<string, unknown>).standalone === true;

		// Check previous dismissal
		dismissed = localStorage.getItem(DISMISS_KEY) === 'true';

		// Detect iOS
		const ua = navigator.userAgent;
		isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);

		// Show iOS tip if on iOS, not standalone, and not dismissed
		showIOSTip = isIOS && !isStandalone && !dismissed;
	});

	$effect(() => {
		const unsub = installPromptAvailable.subscribe((v) => {
			available = v;
		});
		return unsub;
	});

	let visible = $derived((available || showIOSTip) && !dismissed && !isStandalone);

	async function handleInstall() {
		await triggerInstall();
	}

	function handleDismiss() {
		dismissed = true;
		localStorage.setItem(DISMISS_KEY, 'true');
	}
</script>

{#if visible}
	<div
		class="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-lg sm:left-auto sm:right-4"
	>
		<img src="/icon-192.png" alt="Falcon" class="h-10 w-10 rounded-lg" />
		<div class="flex-1">
			{#if isIOS}
				<p class="text-sm font-medium text-gray-100">Install Falcon Dashboard</p>
				<p class="text-xs text-gray-400">
					Tap <svg
						class="inline h-4 w-4 align-text-bottom text-blue-400"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
						/>
					</svg> then "Add to Home Screen"
				</p>
			{:else}
				<p class="text-sm font-medium text-gray-100">Install Falcon Dashboard</p>
				<p class="text-xs text-gray-400">Add to your home screen for quick access</p>
			{/if}
		</div>
		{#if !isIOS}
			<button
				onclick={handleInstall}
				class="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
			>
				Install
			</button>
		{/if}
		<button onclick={handleDismiss} class="text-gray-500 hover:text-gray-300" aria-label="Dismiss">
			<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>
{/if}
