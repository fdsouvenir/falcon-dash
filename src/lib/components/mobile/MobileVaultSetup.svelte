<script lang="ts">
	import { initVault, passwordError, passwordLoading } from '$lib/stores/passwords.js';

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

	async function handleCreate() {
		await initVault();
	}
</script>

<div class="flex h-full flex-col items-center justify-center bg-gray-950 px-6">
	<div class="w-full max-w-sm">
		<div class="mb-2 flex items-center gap-3">
			<svg class="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
			<h2 class="text-lg font-semibold text-white">Create Password Vault</h2>
		</div>
		<p class="mb-6 text-sm text-gray-400">
			A KDBX4 vault will be created with a randomly generated keyfile at ~/.openclaw/vault.key
		</p>

		{#if error}
			<div
				class="mb-4 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300"
			>
				{error}
			</div>
		{/if}

		<button
			onclick={handleCreate}
			disabled={loading}
			class="min-h-[44px] w-full rounded-lg bg-blue-600 text-sm font-medium text-white active:bg-blue-700 disabled:opacity-50"
		>
			{loading ? 'Creating Vault...' : 'Create Vault'}
		</button>
	</div>
</div>
