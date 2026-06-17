<script lang="ts">
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import { gatewayEvents } from '$lib/gateway-api.js';
	import {
		addProvider,
		loadSecrets,
		removeProvider,
		secrets,
		type SecretProvider
	} from '$lib/stores/secrets.js';
	import { addToast } from '$lib/stores/toast.js';

	let connState = $state('disconnected');
	let providers = $state<SecretProvider[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let showAddForm = $state(false);
	let newType = $state<'env' | 'file' | 'exec'>('env');
	let newName = $state('');
	let newPath = $state('');
	let newCommand = $state('');
	let saving = $state(false);

	const isConnected = $derived(connState === 'ready');

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connState = s;
			if (s === 'ready') loadSecrets();
		});
		return unsub;
	});

	$effect(() => {
		const unsub = secrets.providers.subscribe((p) => {
			providers = p;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = secrets.loading.subscribe((l) => {
			loading = l;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = secrets.error.subscribe((e) => {
			error = e;
		});
		return unsub;
	});

	async function handleAddProvider() {
		if (!newName.trim()) return;
		saving = true;
		try {
			const provider: SecretProvider = { type: newType, name: newName.trim() };
			if (newType === 'file' && newPath.trim()) provider.path = newPath.trim();
			if (newType === 'exec' && newCommand.trim()) provider.command = newCommand.trim();
			await addProvider(provider);
			addToast(`Provider "${newName}" added`, 'success');
			resetForm();
		} catch (err) {
			addToast(`Failed to add provider: ${err}`, 'error');
		} finally {
			saving = false;
		}
	}

	async function handleRemoveProvider(name: string) {
		try {
			await removeProvider(name);
			addToast(`Provider "${name}" removed`, 'success');
		} catch (err) {
			addToast(`Failed to remove: ${err}`, 'error');
		}
	}

	function resetForm() {
		showAddForm = false;
		newType = 'env';
		newName = '';
		newPath = '';
		newCommand = '';
	}
</script>

<svelte:head>
	<title>Secret Providers - Falcon Dash</title>
</svelte:head>

<FalconModuleShell
	active="Vault"
	eyebrow="Falcon Dash / Vault"
	title="Secret providers"
	description="Provider configuration for resolving SecretRefs. Provider metadata is visible; resolved secret values are not."
>
	<div class="space-y-4 p-4 sm:p-5">
		<section class="grid gap-3 sm:grid-cols-3">
			<div
				class="border p-4 {isConnected
					? 'border-status-active/40 bg-status-active-bg text-status-active'
					: 'border-status-warning/40 bg-status-warning-bg text-status-warning'}"
			>
				<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-75">
					Gateway
				</p>
				<p class="mt-2 text-xl font-semibold">{connState}</p>
			</div>
			<div class="border border-surface-border bg-surface-1 p-4">
				<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
					Providers
				</p>
				<p class="mt-2 text-xl font-semibold text-white">{providers.length}</p>
			</div>
			<div class="border border-surface-border bg-surface-1 p-4">
				<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
					Secret values
				</p>
				<p class="mt-2 text-xl font-semibold text-white">Hidden</p>
			</div>
		</section>

		{#if !isConnected}
			<div class="border border-surface-border bg-surface-1 px-4 py-10 text-center">
				<p class="text-sm text-status-muted">Connect to gateway to manage secret providers.</p>
			</div>
		{:else}
			<section class="border border-surface-border bg-surface-1">
				<div
					class="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3"
				>
					<h2 class="text-sm font-semibold text-white">Providers</h2>
					<button
						type="button"
						onclick={() => (showAddForm = !showAddForm)}
						class="border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						{showAddForm ? 'Cancel' : 'Add provider'}
					</button>
				</div>

				{#if showAddForm}
					<div class="border-b border-surface-border p-4">
						<div class="grid gap-3 md:grid-cols-3">
							<div>
								<label for="provider-name" class="mb-1 block text-xs text-status-muted">Name</label>
								<input
									id="provider-name"
									type="text"
									bind:value={newName}
									placeholder="vault-secrets"
									class="w-full border border-surface-border bg-surface-0 px-3 py-2 text-sm text-white placeholder-status-muted focus:border-white/40 focus:outline-none"
								/>
							</div>
							<div>
								<label for="provider-type" class="mb-1 block text-xs text-status-muted">Type</label>
								<select
									id="provider-type"
									bind:value={newType}
									class="w-full border border-surface-border bg-surface-0 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
								>
									<option value="env">Environment</option>
									<option value="file">File</option>
									<option value="exec">Executable</option>
								</select>
							</div>
							<div>
								{#if newType === 'exec'}
									<label for="provider-command" class="mb-1 block text-xs text-status-muted">
										Command
									</label>
									<input
										id="provider-command"
										type="text"
										bind:value={newCommand}
										placeholder="/usr/bin/secret-tool"
										class="w-full border border-surface-border bg-surface-0 px-3 py-2 text-sm text-white placeholder-status-muted focus:border-white/40 focus:outline-none"
									/>
								{:else if newType === 'file'}
									<label for="provider-path" class="mb-1 block text-xs text-status-muted"
										>Path</label
									>
									<input
										id="provider-path"
										type="text"
										bind:value={newPath}
										placeholder="/path/to/secrets.json"
										class="w-full border border-surface-border bg-surface-0 px-3 py-2 text-sm text-white placeholder-status-muted focus:border-white/40 focus:outline-none"
									/>
								{:else}
									<label for="provider-source" class="mb-1 block text-xs text-status-muted">
										Source
									</label>
									<input
										id="provider-source"
										type="text"
										value="Environment variables"
										disabled
										class="w-full border border-surface-border bg-surface-0 px-3 py-2 text-sm text-white placeholder-status-muted opacity-50"
									/>
								{/if}
							</div>
						</div>
						<button
							type="button"
							onclick={handleAddProvider}
							disabled={saving || !newName.trim()}
							class="mt-3 border border-status-active/40 bg-status-active-bg px-4 py-2 text-sm font-semibold text-status-active hover:border-status-active disabled:opacity-50"
						>
							{saving ? 'Adding...' : 'Add provider'}
						</button>
					</div>
				{/if}

				{#if loading}
					<div class="p-4 text-sm text-status-muted">Loading providers...</div>
				{:else if error}
					<div
						class="m-4 border border-status-danger/40 bg-status-danger-bg p-3 text-sm text-status-danger"
					>
						{error}
					</div>
				{:else if providers.length === 0}
					<div class="p-4 text-sm text-status-muted">No providers configured.</div>
				{:else}
					<div class="divide-y divide-surface-border">
						{#each providers as provider, i (provider.name ?? i)}
							<div class="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_auto] md:items-center">
								<span class="font-mono text-xs uppercase tracking-[0.16em] text-status-muted">
									{provider.type}
								</span>
								<div class="min-w-0">
									<p class="truncate text-sm font-semibold text-white">
										{provider.name || `Provider ${i + 1}`}
									</p>
									<p class="mt-1 truncate text-xs text-status-muted">
										{provider.type === 'env'
											? 'Environment provider'
											: provider.type === 'file'
												? provider.path || 'No path configured'
												: provider.command || 'No command configured'}
									</p>
								</div>
								<button
									type="button"
									onclick={() => handleRemoveProvider(provider.name || '')}
									class="border border-status-danger/40 bg-status-danger-bg px-3 py-2 text-sm text-status-danger hover:border-status-danger"
								>
									Remove
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</div>
</FalconModuleShell>
