<script lang="ts">
	import EntryList from '$lib/components/vault/EntryList.svelte';
	import EntryDetail from '$lib/components/vault/EntryDetail.svelte';
	import AddEntryForm from '$lib/components/vault/AddEntryForm.svelte';
	import AddGroupForm from '$lib/components/vault/AddGroupForm.svelte';

	import {
		vaultAvailable,
		vaultChecked,
		checkVaultAvailability,
		loadEntries,
		loadGroups
	} from '$lib/stores/vault.js';

	let selectedEntryPath = $state<string | null>(null);
	let showAddForm = $state(false);
	let showAddGroupForm = $state(false);
	let available = $derived($vaultAvailable);
	let checked = $derived($vaultChecked);

	$effect(() => {
		checkVaultAvailability().then(() => {
			if ($vaultAvailable) {
				loadEntries();
				loadGroups();
			}
		});
	});

	function openEntry(path: string) {
		selectedEntryPath = path;
		history.pushState({ vaultEntry: path }, '');
	}

	function closeEntry() {
		history.back();
	}

	$effect(() => {
		function handlePopState(e: PopStateEvent) {
			const state = e.state as { vaultEntry?: string } | null;
			selectedEntryPath = state?.vaultEntry ?? null;
		}
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	});

	function handleCreated(path: string) {
		showAddForm = false;
		loadEntries();
		loadGroups();
		// Auto-open the newly created entry
		openEntry(path);
	}

	function handleDeleted() {
		selectedEntryPath = null;
		loadEntries();
		loadGroups();
	}
</script>

<svelte:head>
	<title>Passwords - Falcon Dash</title>
</svelte:head>

{#if !checked}
	<div class="flex h-full items-center justify-center bg-gray-900 text-base text-gray-400">
		Loading...
	</div>
{:else if !available}
	<div class="flex h-full items-center justify-center bg-gray-900 text-white">
		<div class="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center">
			<svg
				class="mx-auto mb-4 h-12 w-12 text-gray-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
				/>
			</svg>
			<h2 class="mb-2 text-xl font-semibold">Vault Not Available</h2>
			<p class="text-base text-gray-400">
				KeePassXC vault not found or cannot be unlocked.
			</p>
			<p class="mt-1 text-xs text-gray-600">
				Expected: ~/.openclaw/passwords.kdbx with ~/.openclaw/vault.key
			</p>
		</div>
	</div>
{:else}
	<div class="flex h-full overflow-hidden bg-gray-900 text-white">
		<div class="flex-1 overflow-hidden">
			<EntryList onselect={openEntry} onadd={() => (showAddForm = true)} onaddgroup={() => (showAddGroupForm = true)} />
		</div>

		{#if selectedEntryPath !== null}
			<EntryDetail
				entryPath={selectedEntryPath}
				onClose={closeEntry}
				onDeleted={handleDeleted}
				onUpdated={(newPath) => (selectedEntryPath = newPath)}
			/>
		{/if}
	</div>

	{#if showAddForm}
		<AddEntryForm
			onCancel={() => (showAddForm = false)}
			onCreated={handleCreated}
		/>
	{/if}

	{#if showAddGroupForm}
		<AddGroupForm
			onCancel={() => (showAddGroupForm = false)}
			onCreated={() => {
				showAddGroupForm = false;
				loadEntries();
				loadGroups();
			}}
		/>
	{/if}
{/if}
