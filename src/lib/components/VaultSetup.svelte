<script lang="ts">
	import {
		initVault,
		validatePasswordStrength,
		passwordError,
		passwordLoading
	} from '$lib/stores/passwords.js';

	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let showValidation = $state(false);

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

	let strength = $derived(validatePasswordStrength(password));
	let passwordsMatch = $derived(password === confirmPassword && password.length > 0);

	async function handleCreate() {
		showValidation = true;
		if (!strength.valid || !passwordsMatch) return;
		await initVault(password);
	}
</script>

<div class="flex h-full items-center justify-center">
	<div class="w-96 rounded-lg border border-gray-700 bg-gray-800 p-6">
		<div class="mb-1 flex items-center gap-2">
			<svg class="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
			<h2 class="text-base font-medium text-white">Create Password Vault</h2>
		</div>
		<p class="mb-5 text-xs text-gray-400">
			Your vault will use KDBX4 format with AES-256 encryption and Argon2 key derivation.
		</p>

		{#if error}
			<div class="mb-4 rounded border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-300">
				{error}
			</div>
		{/if}

		<div class="space-y-3">
			<div>
				<label class="mb-1 block text-xs text-gray-400">Master Password</label>
				<input
					type="password"
					bind:value={password}
					placeholder="Enter master password"
					class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleCreate();
					}}
				/>
			</div>

			{#if showValidation && !strength.valid}
				<ul class="space-y-0.5">
					{#each strength.errors as err, i (i)}
						<li class="text-[10px] text-red-400">- {err}</li>
					{/each}
				</ul>
			{/if}

			{#if password.length > 0}
				<div class="flex gap-1">
					{#each [0, 1, 2, 3] as i (i)}
						<div
							class="h-1 flex-1 rounded-full {i <
							(strength.valid
								? 4
								: strength.errors.length <= 1
									? 3
									: strength.errors.length <= 2
										? 2
										: 1)
								? strength.valid
									? 'bg-green-500'
									: 'bg-yellow-500'
								: 'bg-gray-700'}"
						></div>
					{/each}
				</div>
			{/if}

			<div>
				<label class="mb-1 block text-xs text-gray-400">Confirm Password</label>
				<input
					type="password"
					bind:value={confirmPassword}
					placeholder="Confirm master password"
					class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleCreate();
					}}
				/>
			</div>

			{#if showValidation && confirmPassword && !passwordsMatch}
				<p class="text-[10px] text-red-400">Passwords do not match</p>
			{/if}
		</div>

		<button
			onclick={handleCreate}
			disabled={loading}
			class="mt-5 w-full rounded bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
		>
			{loading ? 'Creating Vault...' : 'Create Vault'}
		</button>
	</div>
</div>
