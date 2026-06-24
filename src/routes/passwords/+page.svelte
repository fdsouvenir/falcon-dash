<script lang="ts">
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import EntryList from '$lib/components/vault/EntryList.svelte';
	import EntryDetail from '$lib/components/vault/EntryDetail.svelte';
	import AddEntryForm from '$lib/components/vault/AddEntryForm.svelte';
	import AddGroupForm from '$lib/components/vault/AddGroupForm.svelte';

	import {
		vaultAvailable,
		vaultChecked,
		vaultEntries,
		vaultGroups,
		checkVaultAvailability,
		loadEntries,
		loadGroups
	} from '$lib/stores/vault.js';

	let selectedEntryPath = $state<string | null>(null);
	let showAddForm = $state(false);
	let showAddGroupForm = $state(false);
	let available = $derived($vaultAvailable);
	let checked = $derived($vaultChecked);
	let entryCount = $derived($vaultEntries.length);
	let groupCount = $derived($vaultGroups.length);

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

<FalconModuleShell
	active="Vault"
	eyebrow="Falcon Dash / Vault"
	title="Password vault"
	description="KeePassXC-backed credential inventory and SecretRef source. Secret material stays hidden in the operator UI."
>
	{#if !checked}
		<div
			class="flex h-full min-h-80 items-center justify-center text-[length:var(--text-body)] text-status-muted"
		>
			Loading vault...
		</div>
	{:else if !available}
		<div class="flex h-full min-h-80 items-center justify-center text-white">
			<div class="border border-surface-border bg-surface-2 p-8 text-center">
				<svg
					class="mx-auto mb-4 h-12 w-12 text-status-muted"
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
				<h2 class="mb-2 text-[length:var(--text-page-title)] font-bold">Vault not available</h2>
				<p class="text-[length:var(--text-body)] text-status-muted">
					KeePassXC vault not found or cannot be unlocked.
				</p>
				<p class="mt-1 text-[length:var(--text-label)] text-status-muted/60">
					Expected: ~/.openclaw/passwords.kdbx with ~/.openclaw/vault.key
				</p>
			</div>
		</div>
	{:else}
		<div class="grid h-full min-h-0 grid-rows-[auto_1fr] bg-surface-0 text-white">
			<section class="grid gap-3 border-b border-surface-border p-4 sm:grid-cols-3 sm:p-5">
				<div class="border border-status-active/40 bg-status-active-bg p-4 text-status-active">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-75">
						KeePassXC
					</p>
					<p class="mt-2 text-xl font-semibold">Available</p>
				</div>
				<div class="border border-surface-border bg-surface-1 p-4">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
						Entries
					</p>
					<p class="mt-2 text-xl font-semibold text-white">{entryCount}</p>
				</div>
				<div class="border border-surface-border bg-surface-1 p-4">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
						Groups
					</p>
					<p class="mt-2 text-xl font-semibold text-white">{groupCount}</p>
				</div>
			</section>

			<div class="min-h-0 overflow-hidden">
				<EntryList
					onselect={openEntry}
					onadd={() => (showAddForm = true)}
					onaddgroup={() => (showAddGroupForm = true)}
				/>
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
			<AddEntryForm onCancel={() => (showAddForm = false)} onCreated={handleCreated} />
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
</FalconModuleShell>
