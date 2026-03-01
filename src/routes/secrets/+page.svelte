<script lang="ts">
	import { gatewayEvents } from '$lib/gateway-api.js';
	import {
		secrets,
		loadSecrets,
		addProvider,
		removeProvider,
		type SecretProvider
	} from '$lib/stores/secrets.js';
	import { addToast } from '$lib/stores/toast.js';

	let connState = $state('disconnected');
	let providers = $state<SecretProvider[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Add provider form
	let showAddForm = $state(false);
	let newType = $state<'env' | 'file' | 'exec'>('env');
	let newName = $state('');
	let newPath = $state('');
	let newCommand = $state('');
	let saving = $state(false);

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
			if (newType === 'file' && newPath.trim()) {
				provider.path = newPath.trim();
			}
			if (newType === 'exec' && newCommand.trim()) {
				provider.command = newCommand.trim();
			}
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

	let isConnected = $derived(connState === 'ready');
</script>

<div class="flex flex-col gap-5 p-4 sm:p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold text-white">Secrets</h1>
			<p class="text-sm text-gray-400">Manage secret providers for API keys and credentials</p>
		</div>
		{#if isConnected}
			<button
				onclick={() => (showAddForm = !showAddForm)}
				class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
			>
				{showAddForm ? 'Cancel' : 'Add Provider'}
			</button>
		{/if}
	</div>

	{#if !isConnected}
		<div class="rounded-lg border border-gray-700/40 bg-gray-800/20 px-4 py-8 text-center">
			<p class="text-sm text-gray-500">Connect to gateway to manage secrets</p>
		</div>
	{:else}
		<!-- Add provider form -->
		{#if showAddForm}
			<div class="rounded-lg border border-blue-600/30 bg-blue-900/10 p-4">
				<h3 class="mb-3 text-sm font-semibold text-white">New Provider</h3>
				<div class="space-y-3">
					<div>
						<label for="provider-name" class="mb-1 block text-xs font-medium text-gray-400"
							>Name</label
						>
						<input
							id="provider-name"
							type="text"
							bind:value={newName}
							placeholder="my-secrets"
							class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label for="provider-type" class="mb-1 block text-xs font-medium text-gray-400"
							>Type</label
						>
						<select
							id="provider-type"
							bind:value={newType}
							class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
						>
							<option value="env">Environment Variables</option>
							<option value="file">File</option>
							<option value="exec">Executable</option>
						</select>
					</div>
					{#if newType === 'file'}
						<div>
							<label for="provider-path" class="mb-1 block text-xs font-medium text-gray-400"
								>File Path</label
							>
							<input
								id="provider-path"
								type="text"
								bind:value={newPath}
								placeholder="/path/to/secrets.json"
								class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
							/>
						</div>
					{/if}
					{#if newType === 'exec'}
						<div>
							<label for="provider-command" class="mb-1 block text-xs font-medium text-gray-400"
								>Command</label
							>
							<input
								id="provider-command"
								type="text"
								bind:value={newCommand}
								placeholder="/usr/bin/secret-tool"
								class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
							/>
						</div>
					{/if}
					<button
						onclick={handleAddProvider}
						disabled={saving || !newName.trim()}
						class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
					>
						{saving ? 'Adding...' : 'Add Provider'}
					</button>
				</div>
			</div>
		{/if}

		<!-- Provider list -->
		{#if loading}
			<div class="flex items-center gap-2 py-4">
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"
				></div>
				<span class="text-sm text-gray-400">Loading providers...</span>
			</div>
		{:else if error}
			<div class="rounded-lg border border-red-600/30 bg-red-900/10 p-3">
				<p class="text-sm text-red-400">{error}</p>
			</div>
		{:else if providers.length === 0}
			<div class="rounded-lg border border-gray-700/40 bg-gray-800/20 px-4 py-8 text-center">
				<div class="mb-2 text-3xl text-gray-600">
					<svg
						class="mx-auto h-10 w-10"
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
				</div>
				<p class="text-sm text-gray-500">No secret providers configured</p>
				<p class="mt-1 text-xs text-gray-600">Add a provider to manage API keys and credentials</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each providers as provider, i (provider.name ?? i)}
					<div
						class="flex items-center justify-between rounded-lg border border-gray-700/60 bg-gray-800/40 p-4"
					>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="rounded bg-gray-700 px-1.5 py-0.5 text-xs font-mono text-gray-300"
									>{provider.type}</span
								>
								<span class="text-sm font-medium text-white"
									>{provider.name || `Provider ${i + 1}`}</span
								>
							</div>
							<div class="mt-1 text-xs text-gray-500">
								{#if provider.type === 'env'}
									Reads secrets from environment variables
								{:else if provider.type === 'file'}
									{provider.path || 'No path configured'}
								{:else if provider.type === 'exec'}
									{provider.command || 'No command configured'}
								{/if}
							</div>
						</div>
						<button
							onclick={() => handleRemoveProvider(provider.name || '')}
							class="ml-3 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-600/30"
						>
							Remove
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Info section -->
		<div class="rounded-lg border border-gray-700/40 bg-gray-800/20 p-4">
			<h3 class="mb-2 text-xs font-semibold uppercase text-gray-500">About Secrets</h3>
			<div class="space-y-2 text-xs text-gray-500">
				<p>
					<span class="font-semibold text-gray-400">env</span> — Reads secrets from environment variables
				</p>
				<p>
					<span class="font-semibold text-gray-400">file</span> — Reads secrets from a JSON or single-value
					file
				</p>
				<p>
					<span class="font-semibold text-gray-400">exec</span> — Runs a command to fetch secrets on demand
				</p>
				<p class="mt-2">
					Providers are resolved eagerly at gateway startup. Run
					<span class="rounded bg-gray-700 px-1 py-0.5 font-mono text-gray-300"
						>openclaw secrets audit --check</span
					>
					to verify all secrets resolve correctly.
				</p>
			</div>
		</div>
	{/if}
</div>
