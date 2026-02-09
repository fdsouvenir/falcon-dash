<script lang="ts">
	import { onMount } from 'svelte';
	import {
		configSnapshot,
		configSchema,
		loadConfig,
		loadSchema,
		applyConfig,
		execAllowlist,
		loadExecAllowlist,
		addExecAllowlistEntry,
		removeExecAllowlistEntry
	} from '$lib/stores';
	import type { ConfigSchemaProperty } from '$lib/types/settings';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';

	let loading = $state(true);
	let error = $state('');
	let toastMessage = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimeout: ReturnType<typeof setTimeout> | undefined;

	// --- Exec Allowlist State ---
	let newPattern = $state('');
	let newDescription = $state('');
	let addingEntry = $state(false);
	let removeTarget = $state<string | null>(null);

	// --- Config Editor State ---
	let configJson = $state('');
	let configJsonError = $state('');
	let applying = $state(false);
	let showApplyConfirm = $state(false);

	// --- Schema Viewer State ---
	let schemaExpanded = $state(false);

	function showToast(message: string, type: 'success' | 'error'): void {
		if (toastTimeout) clearTimeout(toastTimeout);
		toastMessage = message;
		toastType = type;
		toastTimeout = setTimeout(() => {
			toastMessage = '';
		}, 3000);
	}

	function formatSchemaType(prop: ConfigSchemaProperty): string {
		let result = prop.type;
		if (prop.enum) {
			result += ` (${prop.enum.join(' | ')})`;
		}
		if (prop.items) {
			result += `<${prop.items.type}>`;
		}
		return result;
	}

	async function handleAddEntry(): Promise<void> {
		if (!newPattern.trim()) return;
		addingEntry = true;
		try {
			await addExecAllowlistEntry(newPattern.trim(), newDescription.trim() || undefined);
			newPattern = '';
			newDescription = '';
			showToast('Allowlist entry added', 'success');
		} catch (err) {
			showToast(
				`Failed to add entry: ${err instanceof Error ? err.message : 'Unknown error'}`,
				'error'
			);
		} finally {
			addingEntry = false;
		}
	}

	async function handleRemoveEntry(): Promise<void> {
		if (!removeTarget) return;
		try {
			await removeExecAllowlistEntry(removeTarget);
			showToast('Allowlist entry removed', 'success');
		} catch (err) {
			showToast(
				`Failed to remove entry: ${err instanceof Error ? err.message : 'Unknown error'}`,
				'error'
			);
		} finally {
			removeTarget = null;
		}
	}

	function syncConfigJson(): void {
		configJson = JSON.stringify($configSnapshot.payload, null, '\t');
		configJsonError = '';
	}

	function validateConfigJson(): boolean {
		try {
			JSON.parse(configJson);
			configJsonError = '';
			return true;
		} catch (err) {
			configJsonError = err instanceof Error ? err.message : 'Invalid JSON';
			return false;
		}
	}

	function handleApplyClick(): void {
		if (!validateConfigJson()) return;
		showApplyConfirm = true;
	}

	async function handleApplyConfig(): Promise<void> {
		showApplyConfirm = false;
		applying = true;
		try {
			const payload = JSON.parse(configJson);
			await applyConfig({ payload, baseHash: $configSnapshot.hash });
			showToast('Configuration applied successfully', 'success');
			syncConfigJson();
		} catch (err) {
			showToast(
				`Failed to apply config: ${err instanceof Error ? err.message : 'Unknown error'}`,
				'error'
			);
		} finally {
			applying = false;
		}
	}

	onMount(async () => {
		try {
			await Promise.all([loadConfig(), loadSchema(), loadExecAllowlist()]);
			syncConfigJson();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load settings';
		} finally {
			loading = false;
		}
	});

	let schemaProperties = $derived(Object.entries($configSchema.properties));
</script>

<!-- Toast -->
{#if toastMessage}
	<div
		class="fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg {toastType ===
		'success'
			? 'border-green-700 bg-green-900/90 text-green-200'
			: 'border-red-700 bg-red-900/90 text-red-200'}"
	>
		{toastMessage}
	</div>
{/if}

<!-- Confirm Dialogs -->
<ConfirmDialog
	title="Remove Allowlist Entry"
	message="This will remove the pattern '{removeTarget ?? ''}' from the execution allowlist."
	confirmLabel="Remove"
	open={removeTarget !== null}
	on:confirm={handleRemoveEntry}
	on:cancel={() => (removeTarget = null)}
/>

<ConfirmDialog
	title="Apply Configuration"
	message="This will overwrite the current gateway configuration and may trigger a restart. Are you sure?"
	confirmLabel="Apply"
	open={showApplyConfirm}
	on:confirm={handleApplyConfig}
	on:cancel={() => (showApplyConfirm = false)}
/>

<div class="space-y-6 overflow-y-auto p-6">
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
			/>
			<span class="ml-3 text-sm text-slate-400">Loading settings...</span>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-700 bg-red-900/30 p-4 text-sm text-red-300">
			{error}
		</div>
	{:else}
		<!-- Exec Approvals Allowlist -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-5 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Execution Approvals Allowlist
				</h2>
				<p class="mt-1 text-xs text-slate-500">
					Commands matching these patterns are auto-approved for agent execution.
				</p>
			</div>
			<div class="p-5">
				<!-- Add new entry -->
				<div class="mb-4 flex gap-2">
					<input
						bind:value={newPattern}
						placeholder="Command pattern (e.g., npm run *)"
						class="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
					/>
					<input
						bind:value={newDescription}
						placeholder="Description (optional)"
						class="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
					/>
					<button
						onclick={handleAddEntry}
						disabled={!newPattern.trim() || addingEntry}
						class="whitespace-nowrap rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{addingEntry ? 'Adding...' : 'Add'}
					</button>
				</div>

				<!-- Entries list -->
				{#if $execAllowlist.length === 0}
					<p class="py-4 text-center text-sm text-slate-500">
						No allowlist entries configured. All exec commands require manual approval.
					</p>
				{:else}
					<div class="space-y-2">
						{#each $execAllowlist as entry (entry.pattern)}
							<div
								class="flex items-center justify-between rounded border border-slate-700 bg-slate-900/50 px-4 py-3"
							>
								<div>
									<code class="text-sm text-blue-400">{entry.pattern}</code>
									{#if entry.description}
										<p class="mt-0.5 text-xs text-slate-500">{entry.description}</p>
									{/if}
								</div>
								<button
									onclick={() => (removeTarget = entry.pattern)}
									class="ml-4 text-xs text-red-400 transition-colors hover:text-red-300"
								>
									Remove
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<!-- Raw Config Editor -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<div class="border-b border-slate-700 px-5 py-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
					Raw Configuration
				</h2>
				<p class="mt-1 text-xs text-slate-500">
					Edit the gateway configuration JSON directly. Changes require confirmation.
				</p>
			</div>
			<div class="p-5">
				<textarea
					bind:value={configJson}
					oninput={() => validateConfigJson()}
					spellcheck="false"
					class="h-64 w-full resize-y rounded border bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200 focus:outline-none {configJsonError
						? 'border-red-500'
						: 'border-slate-600 focus:border-blue-500'}"
				/>
				{#if configJsonError}
					<p class="mt-2 text-xs text-red-400">JSON Error: {configJsonError}</p>
				{/if}
				<div class="mt-3 flex items-center gap-3">
					<button
						onclick={handleApplyClick}
						disabled={!!configJsonError || applying}
						class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{applying ? 'Applying...' : 'Apply Configuration'}
					</button>
					<button
						onclick={syncConfigJson}
						class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
					>
						Reset
					</button>
				</div>
			</div>
		</section>

		<!-- Config Schema Reference -->
		<section class="rounded-lg border border-slate-700 bg-slate-800/50">
			<button
				onclick={() => (schemaExpanded = !schemaExpanded)}
				class="flex w-full items-center justify-between border-b border-slate-700 px-5 py-3 text-left"
			>
				<div>
					<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
						Configuration Schema
					</h2>
					<p class="mt-1 text-xs text-slate-500">
						Reference for available configuration keys and types.
					</p>
				</div>
				<svg
					class="h-5 w-5 text-slate-400 transition-transform {schemaExpanded ? 'rotate-180' : ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
			{#if schemaExpanded}
				<div class="p-5">
					{#if schemaProperties.length === 0}
						<p class="py-4 text-center text-sm text-slate-500">No schema available.</p>
					{:else}
						<div class="space-y-3">
							{#each schemaProperties as [key, prop] (key)}
								<div class="rounded border border-slate-700 bg-slate-900/50 px-4 py-3">
									<div class="flex items-baseline gap-2">
										<code class="text-sm text-blue-400">{key}</code>
										<span class="text-xs text-slate-500">{formatSchemaType(prop)}</span>
									</div>
									{#if prop.description}
										<p class="mt-1 text-xs text-slate-400">
											{prop.description}
										</p>
									{/if}
									{#if prop.default !== undefined}
										<p class="mt-1 text-xs text-slate-500">
											Default: <code class="text-slate-400">{JSON.stringify(prop.default)}</code>
										</p>
									{/if}
									{#if prop.properties}
										<div class="ml-4 mt-2 space-y-1">
											{#each Object.entries(prop.properties) as [subKey, subProp] (subKey)}
												<div class="text-xs">
													<code class="text-slate-300">{key}.{subKey}</code>
													<span class="ml-1 text-slate-500">{formatSchemaType(subProp)}</span>
													{#if subProp.description}
														<span class="ml-1 text-slate-500"> &mdash; {subProp.description}</span>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>
