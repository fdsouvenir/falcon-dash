<script lang="ts">
	import { unlockVault, passwordError, passwordLoading } from '$lib/stores/passwords.js';

	let password = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const u = passwordLoading.subscribe((v) => {
			loading = v;
		});
		return u;
	});
	$effect(() => {
		const u = passwordError.subscribe((v) => {
			error = v;
		});
		return u;
	});

	async function handleUnlock() {
		if (!password) return;
		await unlockVault(password);
	}
</script>

<div class="flex h-full flex-col items-center justify-center bg-gray-950 px-6">
	<div class="w-full max-w-sm">
		<div class="mb-4 flex items-center gap-3">
			<svg class="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
			<h2 class="text-lg font-semibold text-white">Unlock Vault</h2>
		</div>

		{#if error}
			<div
				class="mb-4 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300"
			>
				{error}
			</div>
		{/if}

		<div>
			<label class="mb-1.5 block text-sm text-gray-400">Master Password</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="password"
				bind:value={password}
				placeholder="Enter master password"
				autofocus
				class="min-h-[44px] w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
				onkeydown={(e) => {
					if (e.key === 'Enter') handleUnlock();
				}}
			/>
		</div>

		<button
			onclick={handleUnlock}
			disabled={loading || !password}
			class="mt-5 min-h-[44px] w-full rounded-lg bg-blue-600 text-sm font-medium text-white active:bg-blue-700 disabled:opacity-50"
		>
			{loading ? 'Unlocking...' : 'Unlock'}
		</button>
	</div>
</div>
