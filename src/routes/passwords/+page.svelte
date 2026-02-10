<script lang="ts">
	import { vaultState, checkVaultStatus, type VaultState } from '$lib/stores/passwords.js';
	import VaultSetup from '$lib/components/VaultSetup.svelte';
	import VaultUnlock from '$lib/components/VaultUnlock.svelte';

	let state = $state<VaultState>('checking');

	$effect(() => {
		const u = vaultState.subscribe((v) => {
			state = v;
		});
		return u;
	});

	$effect(() => {
		checkVaultStatus();
	});
</script>

<div class="h-full">
	{#if state === 'checking'}
		<div class="flex h-full items-center justify-center text-sm text-gray-500">
			Checking vault...
		</div>
	{:else if state === 'no-vault'}
		<VaultSetup />
	{:else if state === 'locked'}
		<VaultUnlock />
	{:else}
		<div class="flex h-full items-center justify-center text-sm text-gray-500">
			Vault unlocked. Password manager coming soon.
		</div>
	{/if}
</div>
