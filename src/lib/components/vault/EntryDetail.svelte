<script lang="ts">
	import { fetchEntry, editEntry, deleteEntry, type VaultEntry } from '$lib/stores/vault.js';
	import { addToast } from '$lib/stores/toast.js';

	interface Props {
		entryPath: string;
		onClose?: () => void;
		onDeleted?: () => void;
		onUpdated?: (newPath: string) => void;
	}

	let { entryPath, onClose, onDeleted, onUpdated }: Props = $props();

	let entry = $state<VaultEntry | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let showPassword = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	// Edit mode state
	let editing = $state(false);
	let saving = $state(false);
	let editTitle = $state('');
	let editUsername = $state('');
	let editPassword = $state('');
	let editUrl = $state('');
	let editNotes = $state('');
	let showEditPassword = $state(false);

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
		if (e.key === 'Escape') {
			if (editing) cancelEdit();
			else onClose?.();
		}
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

	function startEdit() {
		if (!entry) return;
		editTitle = entry.title;
		editUsername = entry.username ?? '';
		editPassword = entry.password ?? '';
		editUrl = entry.url ?? '';
		editNotes = entry.notes ?? '';
		showEditPassword = false;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	async function handleSave() {
		if (!editTitle.trim()) return;
		saving = true;
		try {
			await editEntry(entryPath, {
				title: editTitle.trim(),
				username: editUsername.trim() || undefined,
				password: editPassword || undefined,
				url: editUrl.trim() || undefined,
				notes: editNotes.trim() || undefined
			});
			addToast('Entry saved', 'success');
			editing = false;

			// Compute new path in case title changed
			const parts = entryPath.split('/');
			parts[parts.length - 1] = editTitle.trim();
			const newPath = parts.join('/');
			onUpdated?.(newPath);

			// Reload entry data (uses updated entryPath prop if parent updated it)
			entry = await fetchEntry(newPath);
		} catch (err) {
			addToast(`Save failed: ${(err as Error).message}`, 'error');
		} finally {
			saving = false;
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
		class="flex h-full w-full flex-col overflow-hidden bg-surface-1 shadow-xl md:h-auto md:max-h-[90vh] md:w-auto md:max-w-xl md:rounded-lg"
	>
		<!-- Header -->
		<div class="border-b border-surface-border bg-surface-2 px-3 py-2">
			<div class="flex min-h-[36px] items-center gap-2">
				<button
					onclick={onClose}
					class="min-h-[36px] min-w-[36px] shrink-0 rounded p-1.5 text-status-muted hover:bg-surface-3 hover:text-white"
					title="Back"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 19l-7-7 7-7"
						/>
					</svg>
				</button>
				<span class="flex-1 text-[length:var(--text-card-title)] font-medium text-white">
					{#if loading}Loading...{:else if editing}Edit Entry{:else if entry}{entry.title}{:else}Entry{/if}
				</span>
				{#if !confirmDelete && !editing}
					<button
						onclick={startEdit}
						class="rounded p-1.5 text-status-muted hover:bg-surface-3 hover:text-status-info"
						title="Edit entry"
					>
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
							/>
						</svg>
					</button>
					<button
						onclick={() => (confirmDelete = true)}
						class="rounded p-1.5 text-status-muted hover:bg-surface-3 hover:text-status-danger"
						title="Delete entry"
					>
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
					</button>
				{/if}
			</div>

			<!-- Delete confirmation -->
			{#if confirmDelete}
				<div
					class="mt-2 flex items-center gap-2 rounded-lg bg-status-danger-bg px-3 py-2 text-[length:var(--text-badge)] text-status-danger"
				>
					<span class="flex-1">Delete this entry permanently?</span>
					<button
						onclick={handleDelete}
						disabled={deleting}
						class="rounded bg-status-danger px-2 py-1 text-white hover:opacity-80 disabled:opacity-50"
					>
						{deleting ? 'Deleting…' : 'Delete'}
					</button>
					<button
						onclick={() => (confirmDelete = false)}
						class="rounded px-2 py-1 text-status-muted hover:bg-surface-3 hover:text-white"
					>
						Cancel
					</button>
				</div>
			{/if}
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			{#if loading}
				<div class="flex items-center gap-2 p-6 text-[length:var(--text-body)] text-status-muted">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-surface-border border-t-status-info"
					></div>
					Loading entry…
				</div>
			{:else if error}
				<div class="m-4 rounded-lg border border-status-danger/30 bg-status-danger-bg p-3">
					<p class="text-[length:var(--text-body)] text-status-danger">{error}</p>
				</div>
			{:else if editing}
				<!-- Edit form -->
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSave();
					}}
					class="space-y-4 p-4"
				>
					<!-- Title -->
					<div>
						<label
							for="edit-title"
							class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted"
							>Title *</label
						>
						<input
							id="edit-title"
							type="text"
							bind:value={editTitle}
							required
							class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
						/>
					</div>

					<!-- Username -->
					<div>
						<label
							for="edit-username"
							class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted"
							>Username</label
						>
						<input
							id="edit-username"
							type="text"
							bind:value={editUsername}
							placeholder="user@example.com"
							class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
						/>
					</div>

					<!-- Password -->
					<div>
						<label
							for="edit-password"
							class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted"
							>Password</label
						>
						<div class="relative">
							<input
								id="edit-password"
								type={showEditPassword ? 'text' : 'password'}
								bind:value={editPassword}
								placeholder="Leave blank to keep existing"
								class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 pr-9 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
							/>
							<button
								type="button"
								onclick={() => (showEditPassword = !showEditPassword)}
								class="absolute right-2 top-1/2 -translate-y-1/2 text-status-muted hover:text-white"
							>
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									{#if showEditPassword}
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
										/>
									{:else}
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									{/if}
								</svg>
							</button>
						</div>
					</div>

					<!-- URL -->
					<div>
						<label
							for="edit-url"
							class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted"
							>URL</label
						>
						<input
							id="edit-url"
							type="url"
							bind:value={editUrl}
							placeholder="https://example.com"
							class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
						/>
					</div>

					<!-- Notes -->
					<div>
						<label
							for="edit-notes"
							class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted"
							>Notes</label
						>
						<textarea
							id="edit-notes"
							bind:value={editNotes}
							rows="3"
							placeholder="Optional notes"
							class="w-full resize-none rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
						></textarea>
					</div>

					<!-- Actions -->
					<div class="flex justify-end gap-2">
						<button
							type="button"
							onclick={cancelEdit}
							class="rounded-lg px-4 py-2 text-[length:var(--text-body)] text-status-muted hover:bg-surface-3 hover:text-white"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={saving || !editTitle.trim()}
							class="rounded-lg bg-status-info px-4 py-2 text-[length:var(--text-body)] font-medium text-white hover:opacity-80 disabled:opacity-50"
						>
							{saving ? 'Saving…' : 'Save'}
						</button>
					</div>
				</form>
			{:else if entry}
				<div class="divide-y divide-surface-border">
					<!-- Path -->
					<div class="px-4 py-3">
						<div class="mb-0.5 text-[length:var(--text-label)] font-medium text-status-muted">
							Path
						</div>
						<div class="font-mono text-[length:var(--text-mono)] text-status-muted">
							{entry.path}
						</div>
					</div>

					<!-- Username -->
					{#if entry.username}
						<div class="flex items-center px-4 py-3">
							<div class="flex-1">
								<div class="mb-0.5 text-[length:var(--text-label)] font-medium text-status-muted">
									Username
								</div>
								<div class="text-[length:var(--text-body)] text-white/90">{entry.username}</div>
							</div>
							<button
								onclick={() => copyToClipboard(entry!.username, 'Username')}
								class="ml-3 rounded p-1.5 text-status-muted hover:bg-surface-3 hover:text-white"
								title="Copy username"
							>
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							</button>
						</div>
					{/if}

					<!-- Password -->
					{#if entry.password}
						<div class="flex items-center px-4 py-3">
							<div class="min-w-0 flex-1">
								<div class="mb-0.5 text-[length:var(--text-label)] font-medium text-status-muted">
									Password
								</div>
								<div class="font-mono text-[length:var(--text-mono)] text-white/90">
									{showPassword ? entry.password : '•'.repeat(Math.min(entry.password.length, 20))}
								</div>
							</div>
							<div class="ml-3 flex items-center gap-1">
								<button
									onclick={() => (showPassword = !showPassword)}
									class="rounded p-1.5 text-status-muted hover:bg-surface-3 hover:text-white"
									title={showPassword ? 'Hide password' : 'Show password'}
								>
									{#if showPassword}
										<svg
											class="h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
											/>
										</svg>
									{:else}
										<svg
											class="h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											/>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
											/>
										</svg>
									{/if}
								</button>
								<button
									onclick={() => copyToClipboard(entry!.password, 'Password')}
									class="rounded p-1.5 text-status-muted hover:bg-surface-3 hover:text-white"
									title="Copy password"
								>
									<svg
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
										/>
									</svg>
								</button>
							</div>
						</div>
					{/if}

					<!-- URL -->
					{#if entry.url}
						<div class="flex items-center px-4 py-3">
							<div class="min-w-0 flex-1">
								<div class="mb-0.5 text-[length:var(--text-label)] font-medium text-status-muted">
									URL
								</div>
								<button
									type="button"
									onclick={() => window.open(entry?.url ?? '', '_blank', 'noopener,noreferrer')}
									class="truncate text-left text-[length:var(--text-body)] text-status-info hover:underline"
								>
									{entry.url}
								</button>
							</div>
							<button
								onclick={() => copyToClipboard(entry!.url, 'URL')}
								class="ml-3 rounded p-1.5 text-status-muted hover:bg-surface-3 hover:text-white"
								title="Copy URL"
							>
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							</button>
						</div>
					{/if}

					<!-- Notes -->
					{#if entry.notes}
						<div class="px-4 py-3">
							<div class="mb-1 text-[length:var(--text-label)] font-medium text-status-muted">
								Notes
							</div>
							<pre
								class="whitespace-pre-wrap text-[length:var(--text-mono)] text-status-muted">{entry.notes}</pre>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
