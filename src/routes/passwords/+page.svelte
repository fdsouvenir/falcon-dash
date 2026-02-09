<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { PasswordEntry, PasswordEntryFull } from '$lib/types';
	import {
		vaultState,
		passwordEntries,
		checkVault,
		unlockVault,
		lockVault,
		initVault,
		getEntry,
		createEntry,
		editEntry,
		deleteEntry
	} from '$lib/stores';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';

	// --- State ---
	let loading = $state(true);
	let errorMessage = $state('');

	// Unlock / Init form
	let masterPassword = $state('');
	let confirmPassword = $state('');
	let authLoading = $state(false);
	let authError = $state('');

	// Entry list
	let searchQuery = $state('');
	let selectedEntry = $state<PasswordEntryFull | null>(null);
	let selectedEntryTitle = $state('');
	let entryLoading = $state(false);

	// Password reveal
	let passwordRevealed = $state(false);
	let revealTimer: ReturnType<typeof setTimeout> | null = null;

	// Clipboard auto-clear
	let clipboardTimers: ReturnType<typeof setTimeout>[] = [];

	// Create/Edit form
	let formOpen = $state(false);
	let formMode = $state<'create' | 'edit'>('create');
	let formTitle = $state('');
	let formUsername = $state('');
	let formPassword = $state('');
	let formUrl = $state('');
	let formNotes = $state('');
	let formLoading = $state(false);
	let formError = $state('');

	// Delete confirmation
	let deleteConfirmOpen = $state(false);
	let deleteTarget = $state<PasswordEntry | null>(null);

	// Idle timeout (15 minutes)
	const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
	let idleTimer: ReturnType<typeof setTimeout> | null = null;

	// --- Computed ---
	let filteredEntries = $derived(
		searchQuery
			? $passwordEntries.filter((e) => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
			: $passwordEntries
	);

	// --- Idle timeout ---
	function resetIdle(): void {
		if ($vaultState.status !== 'unlocked') return;
		if (idleTimer) clearTimeout(idleTimer);
		idleTimer = setTimeout(() => {
			handleLock();
		}, IDLE_TIMEOUT_MS);
	}

	function handleActivity(): void {
		resetIdle();
	}

	// --- Init / Unlock ---
	async function handleUnlock(): Promise<void> {
		if (!masterPassword) return;
		authLoading = true;
		authError = '';
		try {
			await unlockVault(masterPassword);
			masterPassword = '';
			resetIdle();
		} catch (err) {
			authError = err instanceof Error ? err.message : 'Failed to unlock vault';
		} finally {
			authLoading = false;
		}
	}

	async function handleInit(): Promise<void> {
		if (!masterPassword || !confirmPassword) return;
		if (masterPassword !== confirmPassword) {
			authError = 'Passwords do not match';
			return;
		}
		if (masterPassword.length < 8) {
			authError = 'Password must be at least 8 characters';
			return;
		}
		authLoading = true;
		authError = '';
		try {
			await initVault(masterPassword);
			masterPassword = '';
			confirmPassword = '';
			resetIdle();
		} catch (err) {
			authError = err instanceof Error ? err.message : 'Failed to create vault';
		} finally {
			authLoading = false;
		}
	}

	async function handleLock(): Promise<void> {
		if (idleTimer) clearTimeout(idleTimer);
		idleTimer = null;
		selectedEntry = null;
		selectedEntryTitle = '';
		passwordRevealed = false;
		if (revealTimer) clearTimeout(revealTimer);
		revealTimer = null;
		clipboardTimers.forEach((t) => clearTimeout(t));
		clipboardTimers = [];
		try {
			await lockVault();
		} catch {
			// Lock is best-effort
		}
	}

	// --- Entry selection ---
	async function handleSelectEntry(entry: PasswordEntry): Promise<void> {
		resetIdle();
		if (selectedEntryTitle === entry.title) {
			selectedEntry = null;
			selectedEntryTitle = '';
			passwordRevealed = false;
			if (revealTimer) clearTimeout(revealTimer);
			return;
		}
		entryLoading = true;
		selectedEntryTitle = entry.title;
		passwordRevealed = false;
		if (revealTimer) clearTimeout(revealTimer);
		try {
			selectedEntry = await getEntry(entry.title);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load entry';
			selectedEntry = null;
			selectedEntryTitle = '';
		} finally {
			entryLoading = false;
		}
	}

	// --- Password reveal ---
	function toggleReveal(): void {
		resetIdle();
		if (passwordRevealed) {
			passwordRevealed = false;
			if (revealTimer) {
				clearTimeout(revealTimer);
				revealTimer = null;
			}
		} else {
			passwordRevealed = true;
			revealTimer = setTimeout(() => {
				passwordRevealed = false;
				revealTimer = null;
			}, 30000);
		}
	}

	// --- Clipboard ---
	async function copyToClipboard(text: string): Promise<void> {
		resetIdle();
		try {
			await navigator.clipboard.writeText(text);
			const timer = setTimeout(async () => {
				try {
					await navigator.clipboard.writeText('');
				} catch {
					// Clipboard clear is best-effort
				}
			}, 30000);
			clipboardTimers.push(timer);
		} catch {
			errorMessage = 'Failed to copy to clipboard';
		}
	}

	// --- Create / Edit form ---
	function openCreateForm(): void {
		resetIdle();
		formMode = 'create';
		formTitle = '';
		formUsername = '';
		formPassword = '';
		formUrl = '';
		formNotes = '';
		formError = '';
		formOpen = true;
	}

	function openEditForm(): void {
		if (!selectedEntry) return;
		resetIdle();
		formMode = 'edit';
		formTitle = selectedEntry.title;
		formUsername = selectedEntry.username || '';
		formPassword = '';
		formUrl = selectedEntry.url || '';
		formNotes = selectedEntry.notes || '';
		formError = '';
		formOpen = true;
	}

	function closeForm(): void {
		formOpen = false;
		formError = '';
	}

	async function handleFormSubmit(): Promise<void> {
		resetIdle();
		if (formMode === 'create' && !formTitle.trim()) {
			formError = 'Title is required';
			return;
		}
		formLoading = true;
		formError = '';
		try {
			const fields: { username?: string; password?: string; url?: string; notes?: string } = {};
			if (formUsername) fields.username = formUsername;
			if (formPassword) fields.password = formPassword;
			if (formUrl) fields.url = formUrl;
			if (formNotes) fields.notes = formNotes;

			if (formMode === 'create') {
				await createEntry(formTitle.trim(), fields);
			} else {
				await editEntry(selectedEntry!.title, fields);
				// Reload entry to reflect changes
				selectedEntry = await getEntry(selectedEntry!.title);
			}
			formOpen = false;
			await checkVault();
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Failed to save entry';
		} finally {
			formLoading = false;
		}
	}

	function handleFormKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			closeForm();
		}
	}

	function handleFormBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			closeForm();
		}
	}

	// --- Delete ---
	function requestDeleteEntry(entry: PasswordEntry): void {
		resetIdle();
		deleteTarget = entry;
		deleteConfirmOpen = true;
	}

	async function confirmDeleteEntry(): Promise<void> {
		deleteConfirmOpen = false;
		if (!deleteTarget) return;
		const title = deleteTarget.title;
		deleteTarget = null;
		try {
			await deleteEntry(title);
			if (selectedEntryTitle === title) {
				selectedEntry = null;
				selectedEntryTitle = '';
				passwordRevealed = false;
			}
			await checkVault();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to delete entry';
		}
	}

	function cancelDeleteEntry(): void {
		deleteConfirmOpen = false;
		deleteTarget = null;
	}

	// --- Auth form keydown ---
	function handleUnlockKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleUnlock();
		}
	}

	function handleInitKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleInit();
		}
	}

	// --- Generate password ---
	function generatePassword(): void {
		const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
		const array = new Uint8Array(24);
		crypto.getRandomValues(array);
		formPassword = Array.from(array, (b) => chars[b % chars.length]).join('');
	}

	// --- Lifecycle ---
	onMount(() => {
		checkVault()
			.catch((err) => {
				errorMessage = err instanceof Error ? err.message : 'Failed to check vault status';
			})
			.finally(() => {
				loading = false;
			});
	});

	onDestroy(() => {
		if (idleTimer) clearTimeout(idleTimer);
		if (revealTimer) clearTimeout(revealTimer);
		clipboardTimers.forEach((t) => clearTimeout(t));
	});
</script>

<svelte:window onmousemove={handleActivity} onkeydown={handleActivity} onclick={handleActivity} />

<div class="flex h-full flex-col">
	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-sm text-slate-400">Checking vault status...</p>
		</div>
	{:else if $vaultState.status === 'unavailable'}
		<!-- Unavailable state: keepassxc-cli not installed -->
		<div class="flex flex-1 items-center justify-center p-8">
			<div class="max-w-md space-y-4 text-center">
				<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
					<svg
						class="h-8 w-8 text-slate-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
						/>
					</svg>
				</div>
				<h2 class="text-lg font-semibold text-slate-200">Password Vault Unavailable</h2>
				<p class="text-sm text-slate-400">
					The password vault requires <code
						class="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">keepassxc-cli</code
					> to be installed.
				</p>
				<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left">
					<p class="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
						Install Instructions
					</p>
					<div class="space-y-1 text-sm text-slate-300">
						<p>
							<strong>Ubuntu/Debian:</strong>
							<code class="text-xs">sudo apt install keepassxc</code>
						</p>
						<p><strong>macOS:</strong> <code class="text-xs">brew install keepassxc</code></p>
						<p><strong>Arch:</strong> <code class="text-xs">sudo pacman -S keepassxc</code></p>
					</div>
				</div>
				<button
					onclick={() => {
						loading = true;
						errorMessage = '';
						checkVault()
							.catch((err) => {
								errorMessage = err instanceof Error ? err.message : 'Failed to check vault';
							})
							.finally(() => {
								loading = false;
							});
					}}
					class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
				>
					Recheck
				</button>
			</div>
		</div>
	{:else if $vaultState.status === 'first-run'}
		<!-- First-run state: create vault -->
		<div class="flex flex-1 items-center justify-center p-8">
			<div class="w-full max-w-sm space-y-6">
				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-900/30"
					>
						<svg
							class="h-8 w-8 text-blue-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
							/>
						</svg>
					</div>
					<h2 class="text-lg font-semibold text-slate-200">Create Password Vault</h2>
					<p class="mt-1 text-sm text-slate-400">Set a master password to encrypt your vault.</p>
				</div>

				{#if authError}
					<div
						class="rounded border border-red-800 bg-red-900/30 px-4 py-2"
						role="alert"
						aria-live="assertive"
					>
						<p class="text-sm text-red-400">{authError}</p>
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label for="init-password" class="block text-sm font-medium text-slate-300"
							>Master Password</label
						>
						<input
							id="init-password"
							type="password"
							bind:value={masterPassword}
							onkeydown={handleInitKeydown}
							placeholder="Enter master password"
							class="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
							disabled={authLoading}
						/>
					</div>
					<div>
						<label for="init-confirm" class="block text-sm font-medium text-slate-300"
							>Confirm Password</label
						>
						<input
							id="init-confirm"
							type="password"
							bind:value={confirmPassword}
							onkeydown={handleInitKeydown}
							placeholder="Confirm master password"
							class="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
							disabled={authLoading}
						/>
					</div>
					<button
						onclick={handleInit}
						disabled={authLoading || !masterPassword || !confirmPassword}
						class="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{authLoading ? 'Creating...' : 'Create Vault'}
					</button>
				</div>
			</div>
		</div>
	{:else if $vaultState.status === 'locked'}
		<!-- Locked state: unlock form -->
		<div class="flex flex-1 items-center justify-center p-8">
			<div class="w-full max-w-sm space-y-6">
				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-900/30"
					>
						<svg
							class="h-8 w-8 text-amber-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
							/>
						</svg>
					</div>
					<h2 class="text-lg font-semibold text-slate-200">Vault Locked</h2>
					<p class="mt-1 text-sm text-slate-400">Enter your master password to unlock.</p>
				</div>

				{#if authError}
					<div
						class="rounded border border-red-800 bg-red-900/30 px-4 py-2"
						role="alert"
						aria-live="assertive"
					>
						<p class="text-sm text-red-400">{authError}</p>
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label for="unlock-password" class="block text-sm font-medium text-slate-300"
							>Master Password</label
						>
						<input
							id="unlock-password"
							type="password"
							bind:value={masterPassword}
							onkeydown={handleUnlockKeydown}
							placeholder="Enter master password"
							class="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
							disabled={authLoading}
						/>
					</div>
					<button
						onclick={handleUnlock}
						disabled={authLoading || !masterPassword}
						class="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{authLoading ? 'Unlocking...' : 'Unlock'}
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Unlocked state: entry list + detail -->
		<div class="flex h-full flex-col">
			<!-- Toolbar -->
			<div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
				<div class="flex items-center space-x-3">
					<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
						Password Vault
					</h2>
					<span class="rounded bg-green-600/20 px-2 py-0.5 text-xs font-medium text-green-400"
						>Unlocked</span
					>
				</div>
				<div class="flex items-center space-x-2">
					<button
						onclick={openCreateForm}
						class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500"
					>
						New Entry
					</button>
					<button
						onclick={handleLock}
						class="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-600"
					>
						Lock
					</button>
				</div>
			</div>

			{#if errorMessage}
				<div
					class="border-b border-red-800 bg-red-900/30 px-4 py-2"
					role="alert"
					aria-live="assertive"
				>
					<p class="text-sm text-red-400">{errorMessage}</p>
				</div>
			{/if}

			<!-- Search -->
			<div class="border-b border-slate-700 px-4 py-2">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search entries..."
					aria-label="Search password entries"
					class="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<!-- Content area -->
			<div class="flex flex-1 flex-col overflow-hidden md:flex-row">
				<!-- Entry list (left) -->
				<div class="flex-1 overflow-y-auto border-b border-slate-700 md:border-b-0 md:border-r">
					{#if filteredEntries.length === 0}
						<div class="flex items-center justify-center p-8">
							<p class="text-sm text-slate-400">
								{searchQuery
									? 'No matching entries'
									: 'No entries yet. Click "New Entry" to add one.'}
							</p>
						</div>
					{:else}
						<!-- Column headers -->
						<div
							class="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-slate-700 px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-400"
						>
							<span>Title</span>
							<span class="w-32 text-right">Username</span>
							<span class="w-8"></span>
						</div>
						{#each filteredEntries as entry (entry.title)}
							<div
								class="group grid cursor-pointer grid-cols-[1fr_auto_auto] gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-slate-700/50 focus-visible:ring-2 focus-visible:ring-blue-500 {selectedEntryTitle ===
								entry.title
									? 'bg-slate-700/30'
									: ''}"
								role="button"
								tabindex="0"
								onclick={() => handleSelectEntry(entry)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleSelectEntry(entry);
									}
								}}
							>
								<span class="flex items-center space-x-2 truncate">
									<svg
										class="h-4 w-4 flex-shrink-0 text-slate-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
										/>
									</svg>
									<span class="truncate text-slate-200">{entry.title}</span>
								</span>
								<span class="w-32 truncate text-right text-xs text-slate-500">
									{entry.username || ''}
								</span>
								<span class="flex w-8 items-center justify-center">
									<button
										onclick={(e) => {
											e.stopPropagation();
											requestDeleteEntry(entry);
										}}
										class="rounded p-1 text-slate-500 opacity-0 transition-all hover:bg-red-900/30 hover:text-red-400 group-hover:opacity-100"
										title="Delete {entry.title}"
									>
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</span>
							</div>
						{/each}
					{/if}
				</div>

				<!-- Entry detail (right) -->
				<div class="flex flex-1 flex-col overflow-y-auto">
					{#if entryLoading}
						<div class="flex flex-1 items-center justify-center">
							<p class="text-sm text-slate-400">Loading entry...</p>
						</div>
					{:else if selectedEntry}
						<div class="space-y-4 p-5">
							<div class="flex items-center justify-between">
								<h3 class="text-lg font-medium text-slate-100">{selectedEntry.title}</h3>
								<button
									onclick={openEditForm}
									class="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-600"
								>
									Edit
								</button>
							</div>

							<!-- Username -->
							{#if selectedEntry.username}
								<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
									<div class="flex items-center justify-between">
										<div>
											<p class="text-xs font-medium uppercase tracking-wider text-slate-400">
												Username
											</p>
											<p class="mt-1 text-sm text-slate-200">{selectedEntry.username}</p>
										</div>
										<button
											onclick={() => copyToClipboard(selectedEntry?.username || '')}
											class="rounded bg-slate-700 p-2 text-slate-300 transition-colors hover:bg-slate-600"
											title="Copy username"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
												/>
											</svg>
										</button>
									</div>
								</div>
							{/if}

							<!-- Password -->
							<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
								<div class="flex items-center justify-between">
									<div class="min-w-0 flex-1">
										<p class="text-xs font-medium uppercase tracking-wider text-slate-400">
											Password
										</p>
										<p class="mt-1 font-mono text-sm text-slate-200">
											{#if passwordRevealed}
												{selectedEntry.password}
											{:else}
												{'*'.repeat(16)}
											{/if}
										</p>
									</div>
									<div class="ml-3 flex items-center space-x-1">
										<button
											onclick={toggleReveal}
											class="rounded bg-slate-700 p-2 text-slate-300 transition-colors hover:bg-slate-600"
											title={passwordRevealed ? 'Hide password' : 'Show password'}
										>
											{#if passwordRevealed}
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
													/>
												</svg>
											{:else}
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
													/>
												</svg>
											{/if}
										</button>
										<button
											onclick={() => copyToClipboard(selectedEntry?.password || '')}
											class="rounded bg-slate-700 p-2 text-slate-300 transition-colors hover:bg-slate-600"
											title="Copy password"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
												/>
											</svg>
										</button>
									</div>
								</div>
							</div>

							<!-- URL -->
							{#if selectedEntry.url}
								<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
									<p class="text-xs font-medium uppercase tracking-wider text-slate-400">URL</p>
									<p class="mt-1 text-sm text-blue-400">{selectedEntry.url}</p>
								</div>
							{/if}

							<!-- Notes -->
							{#if selectedEntry.notes}
								<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
									<p class="text-xs font-medium uppercase tracking-wider text-slate-400">Notes</p>
									<p class="mt-1 whitespace-pre-wrap text-sm text-slate-300">
										{selectedEntry.notes}
									</p>
								</div>
							{/if}

							<!-- Group -->
							{#if selectedEntry.group}
								<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
									<p class="text-xs font-medium uppercase tracking-wider text-slate-400">Group</p>
									<p class="mt-1 text-sm text-slate-300">{selectedEntry.group}</p>
								</div>
							{/if}
						</div>
					{:else}
						<div class="flex flex-1 items-center justify-center">
							<p class="text-sm text-slate-400">Select an entry to view details</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Create/Edit Entry Form Modal -->
{#if formOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onclick={handleFormBackdropClick}
	>
		<div
			class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="entry-form-title"
		>
			<h3 id="entry-form-title" class="text-lg font-medium text-slate-100">
				{formMode === 'create' ? 'New Entry' : 'Edit Entry'}
			</h3>

			{#if formError}
				<div
					class="mt-3 rounded border border-red-800 bg-red-900/30 px-3 py-2"
					role="alert"
					aria-live="assertive"
				>
					<p class="text-sm text-red-400">{formError}</p>
				</div>
			{/if}

			<div class="mt-4 space-y-4">
				{#if formMode === 'create'}
					<div>
						<label for="entry-title" class="block text-sm font-medium text-slate-300">Title</label>
						<input
							id="entry-title"
							type="text"
							bind:value={formTitle}
							onkeydown={handleFormKeydown}
							placeholder="e.g. GitHub"
							class="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
							disabled={formLoading}
						/>
					</div>
				{/if}
				<div>
					<label for="entry-username" class="block text-sm font-medium text-slate-300"
						>Username</label
					>
					<input
						id="entry-username"
						type="text"
						bind:value={formUsername}
						onkeydown={handleFormKeydown}
						placeholder="Username or email"
						class="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
						disabled={formLoading}
					/>
				</div>
				<div>
					<label for="entry-password" class="block text-sm font-medium text-slate-300">
						Password
						{#if formMode === 'edit'}
							<span class="text-xs text-slate-500">(leave blank to keep unchanged)</span>
						{/if}
					</label>
					<div class="mt-1 flex space-x-2">
						<input
							id="entry-password"
							type="password"
							bind:value={formPassword}
							onkeydown={handleFormKeydown}
							placeholder={formMode === 'edit' ? 'Unchanged' : 'Password'}
							class="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
							disabled={formLoading}
						/>
						<button
							onclick={generatePassword}
							type="button"
							class="rounded bg-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-600"
							title="Generate password"
							disabled={formLoading}
						>
							Generate
						</button>
					</div>
				</div>
				<div>
					<label for="entry-url" class="block text-sm font-medium text-slate-300">URL</label>
					<input
						id="entry-url"
						type="text"
						bind:value={formUrl}
						onkeydown={handleFormKeydown}
						placeholder="https://example.com"
						class="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
						disabled={formLoading}
					/>
				</div>
				<div>
					<label for="entry-notes" class="block text-sm font-medium text-slate-300">Notes</label>
					<textarea
						id="entry-notes"
						bind:value={formNotes}
						placeholder="Additional notes"
						rows="3"
						class="mt-1 w-full resize-none rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
						disabled={formLoading}
					></textarea>
				</div>
			</div>

			<div class="mt-6 flex justify-end space-x-3">
				<button
					onclick={closeForm}
					class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
					disabled={formLoading}
				>
					Cancel
				</button>
				<button
					onclick={handleFormSubmit}
					disabled={formLoading || (formMode === 'create' && !formTitle.trim())}
					class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if formLoading}
						Saving...
					{:else}
						{formMode === 'create' ? 'Create' : 'Save'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete confirmation -->
<ConfirmDialog
	title="Delete Entry"
	message="Are you sure you want to delete &quot;{deleteTarget?.title ??
		''}&quot;? This action cannot be undone."
	confirmLabel="Delete"
	open={deleteConfirmOpen}
	on:confirm={confirmDeleteEntry}
	on:cancel={cancelDeleteEntry}
/>
