<script lang="ts">
	import {
		vaultState,
		checkVaultStatus,
		lockVault,
		getToken,
		type VaultState
	} from '$lib/stores/passwords.js';
	import VaultSetup from '$lib/components/VaultSetup.svelte';
	import VaultUnlock from '$lib/components/VaultUnlock.svelte';
	import PasswordList from '$lib/components/PasswordList.svelte';
	import PasswordForm from '$lib/components/PasswordForm.svelte';
	import PasswordDetail from '$lib/components/PasswordDetail.svelte';
	import SecretsMigration from '$lib/components/SecretsMigration.svelte';

	let vaultStatus = $state<VaultState>('checking');
	let showForm = $state(false);
	let showMigration = $state(false);
	let editPath = $state<string | null>(null);
	let selectedPath = $state<string | null>(null);
	let refreshKey = $state(0);

	$effect(() => {
		const u = vaultState.subscribe((v) => {
			vaultStatus = v;
		});
		return u;
	});

	$effect(() => {
		checkVaultStatus();
	});

	function handleAddEntry() {
		editPath = null;
		showForm = true;
	}

	function handleEditEntry(path: string) {
		editPath = path;
		selectedPath = null;
		showForm = true;
	}

	function handleCloseForm() {
		showForm = false;
		editPath = null;
	}

	function handleSaved() {
		refreshKey++;
	}

	function handleImportSecrets() {
		showMigration = true;
	}

	function handleCloseMigration() {
		showMigration = false;
		refreshKey++;
	}

	function handleSelectEntry(path: string) {
		selectedPath = path;
	}

	function handleCloseDetail() {
		selectedPath = null;
	}

	function handleDeleted() {
		selectedPath = null;
		refreshKey++;
	}

	async function handleLock() {
		await lockVault();
	}
</script>

<div class="flex h-full flex-col">
	{#if vaultStatus === 'checking'}
		<div class="flex h-full items-center justify-center text-sm text-gray-500">
			Checking vault...
		</div>
	{:else if vaultStatus === 'no-vault'}
		<VaultSetup />
	{:else if vaultStatus === 'locked'}
		<VaultUnlock />
	{:else}
		<div class="flex h-full flex-col">
			<div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
				<h1 class="text-sm font-medium text-white">Password Manager</h1>
				<div class="flex gap-2">
					<button
						onclick={handleImportSecrets}
						class="rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-500"
					>
						Import Secrets
					</button>
					<button
						onclick={handleAddEntry}
						class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
					>
						+ Add Entry
					</button>
					<button
						onclick={handleLock}
						class="rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
					>
						Lock
					</button>
				</div>
			</div>

			<div class="flex flex-1 overflow-hidden">
				{#if showMigration}
					<div class="flex-1 overflow-hidden">
						<SecretsMigration sessionToken={getToken() ?? ''} />
						<div class="border-t border-gray-800 px-4 py-3">
							<button
								onclick={handleCloseMigration}
								class="rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
							>
								Back to Passwords
							</button>
						</div>
					</div>
				{:else if selectedPath}
					<PasswordDetail
						sessionToken={getToken() ?? ''}
						path={selectedPath}
						onclose={handleCloseDetail}
						onedit={handleEditEntry}
						ondeleted={handleDeleted}
					/>
				{:else}
					<div class="flex-1 overflow-y-auto p-4">
						{#key refreshKey}
							<PasswordList sessionToken={getToken() ?? ''} onselect={handleSelectEntry} />
						{/key}
					</div>
				{/if}
			</div>
		</div>

		{#if showForm}
			<PasswordForm
				sessionToken={getToken() ?? ''}
				{editPath}
				onclose={handleCloseForm}
				onsaved={handleSaved}
			/>
		{/if}
	{/if}
</div>
