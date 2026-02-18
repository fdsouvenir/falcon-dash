<script lang="ts">
	import {
		vaultState,
		checkVaultStatus,
		lockVault,
		getToken,
		type VaultState
	} from '$lib/stores/passwords.js';
	import MobileVaultSetup from './MobileVaultSetup.svelte';
	import MobileVaultUnlock from './MobileVaultUnlock.svelte';
	import MobilePasswordList from './MobilePasswordList.svelte';
	import MobilePasswordDetail from './MobilePasswordDetail.svelte';
	import MobilePasswordForm from './MobilePasswordForm.svelte';

	let vaultStatus = $state<VaultState>('checking');
	let view = $state<'list' | 'detail' | 'form'>('list');
	let selectedPath = $state<string | null>(null);
	let editPath = $state<string | null>(null);
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

	function handleSelect(path: string) {
		selectedPath = path;
		view = 'detail';
	}

	function handleAdd() {
		editPath = null;
		view = 'form';
	}

	function handleEdit(path: string) {
		editPath = path;
		selectedPath = null;
		view = 'form';
	}

	function handleBack() {
		view = 'list';
		selectedPath = null;
		editPath = null;
	}

	function handleSaved() {
		refreshKey++;
		view = 'list';
	}

	function handleDeleted() {
		selectedPath = null;
		refreshKey++;
		view = 'list';
	}

	async function handleLock() {
		await lockVault();
	}
</script>

{#if vaultStatus === 'checking'}
	<div class="flex h-full items-center justify-center bg-gray-950 text-sm text-gray-500">
		Checking vault...
	</div>
{:else if vaultStatus === 'no-vault'}
	<MobileVaultSetup />
{:else if vaultStatus === 'locked'}
	<MobileVaultUnlock />
{:else if view === 'detail' && selectedPath}
	<MobilePasswordDetail
		sessionToken={getToken() ?? ''}
		path={selectedPath}
		onback={handleBack}
		onedit={handleEdit}
		ondeleted={handleDeleted}
	/>
{:else if view === 'form'}
	<MobilePasswordForm
		sessionToken={getToken() ?? ''}
		{editPath}
		onback={handleBack}
		onsaved={handleSaved}
	/>
{:else}
	{#key refreshKey}
		<MobilePasswordList
			sessionToken={getToken() ?? ''}
			onselect={handleSelect}
			onadd={handleAdd}
			onlock={handleLock}
		/>
	{/key}
{/if}
