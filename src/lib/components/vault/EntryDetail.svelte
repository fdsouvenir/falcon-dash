<script lang="ts">
	import { fetchEntry, deleteEntry, type VaultEntry } from '$lib/stores/vault.js';
	import { addToast } from '$lib/stores/toast.js';

	interface Props {
		entryPath: string;
		onClose?: () => void;
		onDeleted?: () => void;
	}

	let { entryPath, onClose, onDeleted }: Props = $props();

	let entry = $state<VaultEntry | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let showPassword = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	async function loadEntry() {
		loading = true;
		error = null;
		showPassword = false;
		confirmDelete = false;
		try {
			entry = await fetchEntry(entryPath);
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void entryPath;
		loadEntry();
	});

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose?.();
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose?.();
	}

	async function copyToClipboard(value: string, label: string) {
		try {
			await navigator.clipboard.writeText(value);
			addToast(`${label} copied`, 'success');
		} catch {
			addToast('Failed to copy', 'error');
		}
	}

	async function handleDelete() {
		deleting = true;
		try {
			await deleteEntry(entryPath);
			addToast('Entry deleted', 'success');
			onDeleted?.();
		} catch (err) {
			addToast(`Delete failed: ${(err as Error).message}`, 'error');
		} finally {
			deleting = false;
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={handleBackdropClick}
	onkeydown={handleBackdropKeydown}
>
	<div
		class="flex h-full w-full flex-col overflow-hidden bg-gray-900 shadow-xl md:h-auto md:max-h-[90vh] md:w-auto md:max-w-xl md:rounded-lg"
	>
		<!-- Header -->
		<div class="border-b border-gray-700 bg-gray-800 px-3 py-2">
			<div class="flex min-h-[36px] items-center gap-2">
				<button
					onclick={onClose}
					class="min-h-[36px] min-w-[36px] shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white"
					title="Back"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<span class="flex-1 text-sm font-semibold text-white">
					{#if loading}Loading...{:else if entry}{entry.title}{:else}Entry{/if}
				</span>
				{#if !confirmDelete}
					<button
						onclick={() => (confirmDelete = true)}
						class="rounded p-1.5 text-gray-500 hover:bg-gray-700 hover:text-red-400"
						title="Delete entry"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</button>
				{/if}
			</div>

			<!-- Delete confirmation -->
			{#if confirmDelete}
				<div class="mt-2 flex items-center gap-2 rounded-lg bg-red-900/20 px-3 py-2 text-xs text-red-400">
					<span class="flex-1">Delete this entry permanently?</span>
					<button
						onclick={handleDelete}
						disabled={deleting}
						class="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-500 disabled:opacity-50"
					>
						{deleting ? 'Deleting…' : 'Delete'}
					</button>
					<button
						onclick={() => (confirmDelete = false)}
						class="rounded px-2 py-1 text-gray-400 hover:bg-gray-700 hover:text-white"
					>
						Cancel
					</button>
				</div>
			{/if}
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			{#if loading}
				<div class="flex items-center gap-2 p-6 text-sm text-gray-400">
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
					Loading entry…
				</div>
			{:else if error}
				<div class="m-4 rounded-lg border border-red-600/30 bg-red-900/10 p-3">
					<p class="text-sm text-red-400">{error}</p>
				</div>
			{:else if entry}
				<div class="divide-y divide-gray-800">
					<!-- Path -->
					<div class="px-4 py-3">
						<div class="mb-0.5 text-xs font-medium text-gray-500">Path</div>
						<div class="font-mono text-xs text-gray-400">{entry.path}</div>
					</div>

					<!-- Username -->
					{#if entry.username}
						<div class="flex items-center px-4 py-3">
							<div class="flex-1">
								<div class="mb-0.5 text-xs font-medium text-gray-500">Username</div>
								<div class="text-sm text-gray-200">{entry.username}</div>
							</div>
							<button
								onclick={() => copyToClipboard(entry!.username, 'Username')}
								class="ml-3 rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
								title="Copy username"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							</button>
						</div>
					{/if}

					<!-- Password -->
					{#if entry.password}
						<div class="flex items-center px-4 py-3">
							<div class="min-w-0 flex-1">
								<div class="mb-0.5 text-xs font-medium text-gray-500">Password</div>
								<div class="font-mono text-sm text-gray-200">
									{showPassword ? entry.password : '•'.repeat(Math.min(entry.password.length, 20))}
								</div>
							</div>
							<div class="ml-3 flex items-center gap-1">
								<button
									onclick={() => (showPassword = !showPassword)}
									class="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
									title={showPassword ? 'Hide password' : 'Show password'}
								>
									{#if showPassword}
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
										</svg>
									{:else}
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
										</svg>
									{/if}
								</button>
								<button
									onclick={() => copyToClipboard(entry!.password, 'Password')}
									class="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
									title="Copy password"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
									</svg>
								</button>
							</div>
						</div>
					{/if}

					<!-- URL -->
					{#if entry.url}
						<div class="flex items-center px-4 py-3">
							<div class="min-w-0 flex-1">
								<div class="mb-0.5 text-xs font-medium text-gray-500">URL</div>
								<a
									href={entry.url}
									target="_blank"
									rel="noopener noreferrer"
									class="truncate text-sm text-blue-400 hover:underline"
								>
									{entry.url}
								</a>
							</div>
							<button
								onclick={() => copyToClipboard(entry!.url, 'URL')}
								class="ml-3 rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
								title="Copy URL"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							</button>
						</div>
					{/if}

					<!-- Notes -->
					{#if entry.notes}
						<div class="px-4 py-3">
							<div class="mb-1 text-xs font-medium text-gray-500">Notes</div>
							<pre class="whitespace-pre-wrap text-xs text-gray-400">{entry.notes}</pre>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
