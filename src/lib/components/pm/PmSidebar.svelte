<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PmDomain, PmFocus } from '$lib/types';
	import {
		pmDomains,
		pmFocuses,
		loadDomains,
		loadFocuses,
		createDomain,
		updateDomain,
		deleteDomain,
		reorderDomains,
		createFocus,
		updateFocus,
		deleteFocus,
		reorderFocuses
	} from '$lib/stores';
	import ConfirmDialog from '../files/ConfirmDialog.svelte';

	// --- Props ---

	interface Props {
		/** Currently selected domain id (null = no domain filter) */
		selectedDomainId?: string | null;
		/** Currently selected focus id (null = no focus filter) */
		selectedFocusId?: string | null;
	}

	let { selectedDomainId = null, selectedFocusId = null }: Props = $props();

	const dispatch = createEventDispatcher<{
		select: { domainId: string | null; focusId: string | null };
	}>();

	// --- State ---

	let expandedDomains: Set<string> = $state(new Set());
	let creatingDomain = $state(false);
	let newDomainId = $state('');
	let newDomainName = $state('');
	let editingDomainId: string | null = $state(null);
	let editDomainName = $state('');
	let creatingFocusForDomain: string | null = $state(null);
	let newFocusId = $state('');
	let newFocusName = $state('');
	let editingFocusId: string | null = $state(null);
	let editFocusName = $state('');

	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmAction: (() => void) | null = $state(null);

	// --- Derived ---

	let sortedDomains = $derived(
		[...$pmDomains].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
	);

	function focusesForDomain(domainId: string): PmFocus[] {
		return $pmFocuses
			.filter((f) => f.domainId === domainId)
			.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
	}

	// --- Selection ---

	function selectAll(): void {
		dispatch('select', { domainId: null, focusId: null });
	}

	function selectDomain(domainId: string): void {
		// Expand if collapsed
		expandedDomains.add(domainId);
		expandedDomains = expandedDomains;
		dispatch('select', { domainId, focusId: null });
	}

	function selectFocus(domainId: string, focusId: string): void {
		dispatch('select', { domainId, focusId });
	}

	// --- Expand/Collapse ---

	function toggleDomain(domainId: string): void {
		if (expandedDomains.has(domainId)) {
			expandedDomains.delete(domainId);
		} else {
			expandedDomains.add(domainId);
		}
		expandedDomains = expandedDomains;
	}

	// --- Domain CRUD ---

	function startCreateDomain(): void {
		creatingDomain = true;
		newDomainId = '';
		newDomainName = '';
	}

	function cancelCreateDomain(): void {
		creatingDomain = false;
		newDomainId = '';
		newDomainName = '';
	}

	async function submitCreateDomain(): Promise<void> {
		const id = newDomainId.trim();
		const name = newDomainName.trim();
		if (!id || !name) return;
		try {
			await createDomain({ id, name });
			creatingDomain = false;
			newDomainId = '';
			newDomainName = '';
		} catch {
			// Store reverts on error
		}
	}

	function startEditDomain(domain: PmDomain): void {
		editingDomainId = domain.id;
		editDomainName = domain.name;
	}

	function cancelEditDomain(): void {
		editingDomainId = null;
		editDomainName = '';
	}

	async function submitEditDomain(): Promise<void> {
		if (!editingDomainId || !editDomainName.trim()) return;
		try {
			await updateDomain({ id: editingDomainId, name: editDomainName.trim() });
			editingDomainId = null;
			editDomainName = '';
		} catch {
			// Store reverts on error
		}
	}

	function confirmDeleteDomain(domain: PmDomain): void {
		confirmTitle = 'Delete Domain';
		confirmMessage = `Delete "${domain.name}" and all its focuses? This cannot be undone.`;
		confirmAction = async () => {
			try {
				await deleteDomain(domain.id);
				if (selectedDomainId === domain.id) {
					selectAll();
				}
			} catch {
				// Ignore
			}
		};
		confirmOpen = true;
	}

	// --- Focus CRUD ---

	function startCreateFocus(domainId: string): void {
		creatingFocusForDomain = domainId;
		newFocusId = '';
		newFocusName = '';
	}

	function cancelCreateFocus(): void {
		creatingFocusForDomain = null;
		newFocusId = '';
		newFocusName = '';
	}

	async function submitCreateFocus(): Promise<void> {
		if (!creatingFocusForDomain) return;
		const id = newFocusId.trim();
		const name = newFocusName.trim();
		if (!id || !name) return;
		try {
			await createFocus({ id, domainId: creatingFocusForDomain, name });
			creatingFocusForDomain = null;
			newFocusId = '';
			newFocusName = '';
		} catch {
			// Store reverts on error
		}
	}

	function startEditFocus(focus: PmFocus): void {
		editingFocusId = focus.id;
		editFocusName = focus.name;
	}

	function cancelEditFocus(): void {
		editingFocusId = null;
		editFocusName = '';
	}

	async function submitEditFocus(): Promise<void> {
		if (!editingFocusId || !editFocusName.trim()) return;
		try {
			await updateFocus({ id: editingFocusId, name: editFocusName.trim() });
			editingFocusId = null;
			editFocusName = '';
		} catch {
			// Store reverts on error
		}
	}

	function confirmDeleteFocus(focus: PmFocus): void {
		confirmTitle = 'Delete Focus';
		confirmMessage = `Delete "${focus.name}"? All projects under this focus will need to be reassigned.`;
		confirmAction = async () => {
			try {
				await deleteFocus(focus.id);
				if (selectedFocusId === focus.id) {
					selectAll();
				}
			} catch {
				// Ignore
			}
		};
		confirmOpen = true;
	}

	// --- Reorder ---

	async function moveDomainUp(index: number): Promise<void> {
		if (index <= 0) return;
		const ids = sortedDomains.map((d) => d.id);
		const temp = ids[index];
		ids[index] = ids[index - 1];
		ids[index - 1] = temp;
		try {
			await reorderDomains({ ids });
		} catch {
			await loadDomains();
		}
	}

	async function moveDomainDown(index: number): Promise<void> {
		if (index >= sortedDomains.length - 1) return;
		const ids = sortedDomains.map((d) => d.id);
		const temp = ids[index];
		ids[index] = ids[index + 1];
		ids[index + 1] = temp;
		try {
			await reorderDomains({ ids });
		} catch {
			await loadDomains();
		}
	}

	async function moveFocusUp(domainId: string, index: number): Promise<void> {
		if (index <= 0) return;
		const focuses = focusesForDomain(domainId);
		const ids = focuses.map((f) => f.id);
		const temp = ids[index];
		ids[index] = ids[index - 1];
		ids[index - 1] = temp;
		try {
			await reorderFocuses({ domainId, ids });
		} catch {
			await loadFocuses(domainId);
		}
	}

	async function moveFocusDown(domainId: string, index: number): Promise<void> {
		const focuses = focusesForDomain(domainId);
		if (index >= focuses.length - 1) return;
		const ids = focuses.map((f) => f.id);
		const temp = ids[index];
		ids[index] = ids[index + 1];
		ids[index + 1] = temp;
		try {
			await reorderFocuses({ domainId, ids });
		} catch {
			await loadFocuses(domainId);
		}
	}

	// --- Keyboard helpers ---

	function handleDomainFormKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitCreateDomain();
		} else if (event.key === 'Escape') {
			cancelCreateDomain();
		}
	}

	function handleFocusFormKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitCreateFocus();
		} else if (event.key === 'Escape') {
			cancelCreateFocus();
		}
	}

	function handleEditDomainKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitEditDomain();
		} else if (event.key === 'Escape') {
			cancelEditDomain();
		}
	}

	function handleEditFocusKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitEditFocus();
		} else if (event.key === 'Escape') {
			cancelEditFocus();
		}
	}

	// --- Confirm dialog ---

	function handleConfirm(): void {
		if (confirmAction) confirmAction();
		confirmOpen = false;
		confirmAction = null;
	}

	function handleConfirmCancel(): void {
		confirmOpen = false;
		confirmAction = null;
	}
</script>

<div class="flex h-full flex-col border-r border-slate-700 bg-slate-900/50">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-slate-700 px-3 py-3">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</h3>
		<button
			onclick={startCreateDomain}
			class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
			title="Add Domain"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</div>

	<!-- Tree -->
	<div class="flex-1 overflow-y-auto px-2 py-2">
		<!-- All Projects -->
		<button
			onclick={selectAll}
			class="mb-1 flex w-full items-center rounded px-2 py-1.5 text-left text-sm transition-colors"
			class:bg-slate-700={selectedDomainId === null && selectedFocusId === null}
			class:text-slate-100={selectedDomainId === null && selectedFocusId === null}
			class:text-slate-300={selectedDomainId !== null || selectedFocusId !== null}
			class:hover:bg-slate-700={selectedDomainId !== null || selectedFocusId !== null}
		>
			<svg class="mr-2 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 10h16M4 14h16M4 18h16"
				/>
			</svg>
			All Projects
		</button>

		<!-- Create Domain Form -->
		{#if creatingDomain}
			<div class="mb-2 rounded border border-slate-600 bg-slate-800 p-2">
				<input
					bind:value={newDomainId}
					onkeydown={handleDomainFormKeydown}
					placeholder="Domain ID"
					class="mb-1.5 w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
				/>
				<input
					bind:value={newDomainName}
					onkeydown={handleDomainFormKeydown}
					placeholder="Domain Name"
					class="mb-1.5 w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
				/>
				<div class="flex justify-end space-x-1">
					<button
						onclick={cancelCreateDomain}
						class="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
					>
						Cancel
					</button>
					<button
						onclick={submitCreateDomain}
						class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500"
					>
						Create
					</button>
				</div>
			</div>
		{/if}

		<!-- Domain tree -->
		{#each sortedDomains as domain, domainIndex (domain.id)}
			<div class="mb-0.5">
				<!-- Domain row -->
				{#if editingDomainId === domain.id}
					<!-- Edit domain inline form -->
					<div class="rounded border border-slate-600 bg-slate-800 p-2">
						<input
							bind:value={editDomainName}
							onkeydown={handleEditDomainKeydown}
							class="mb-1.5 w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
						/>
						<div class="flex justify-end space-x-1">
							<button
								onclick={cancelEditDomain}
								class="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
							>
								Cancel
							</button>
							<button
								onclick={submitEditDomain}
								class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500"
							>
								Save
							</button>
						</div>
					</div>
				{:else}
					<div class="group flex items-center">
						<!-- Expand/collapse toggle -->
						<button
							onclick={() => toggleDomain(domain.id)}
							class="flex-shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:text-slate-300"
							title={expandedDomains.has(domain.id) ? 'Collapse' : 'Expand'}
						>
							<svg
								class="h-3.5 w-3.5 transition-transform"
								class:rotate-90={expandedDomains.has(domain.id)}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</button>

						<!-- Domain label (click to select) -->
						<button
							onclick={() => selectDomain(domain.id)}
							class="flex min-w-0 flex-1 items-center rounded px-1.5 py-1 text-left text-sm transition-colors"
							class:bg-slate-700={selectedDomainId === domain.id && selectedFocusId === null}
							class:text-slate-100={selectedDomainId === domain.id && selectedFocusId === null}
							class:text-slate-300={selectedDomainId !== domain.id || selectedFocusId !== null}
							class:hover:bg-slate-800={selectedDomainId !== domain.id || selectedFocusId !== null}
						>
							<svg
								class="mr-1.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
								/>
							</svg>
							<span class="truncate">{domain.name}</span>
						</button>

						<!-- Domain actions (visible on hover) -->
						<div
							class="flex flex-shrink-0 items-center space-x-0.5 opacity-0 group-hover:opacity-100"
						>
							{#if domainIndex > 0}
								<button
									onclick={() => moveDomainUp(domainIndex)}
									class="rounded p-0.5 text-slate-500 hover:text-slate-300"
									title="Move up"
								>
									<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 15l7-7 7 7"
										/>
									</svg>
								</button>
							{/if}
							{#if domainIndex < sortedDomains.length - 1}
								<button
									onclick={() => moveDomainDown(domainIndex)}
									class="rounded p-0.5 text-slate-500 hover:text-slate-300"
									title="Move down"
								>
									<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								</button>
							{/if}
							<button
								onclick={() => startCreateFocus(domain.id)}
								class="rounded p-0.5 text-slate-500 hover:text-slate-300"
								title="Add focus"
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 4v16m8-8H4"
									/>
								</svg>
							</button>
							<button
								onclick={() => startEditDomain(domain)}
								class="rounded p-0.5 text-slate-500 hover:text-slate-300"
								title="Edit domain"
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
							</button>
							<button
								onclick={() => confirmDeleteDomain(domain)}
								class="rounded p-0.5 text-slate-500 hover:text-red-400"
								title="Delete domain"
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
				{/if}

				<!-- Focuses (nested, shown when expanded) -->
				{#if expandedDomains.has(domain.id)}
					<div class="ml-4 mt-0.5">
						{#each focusesForDomain(domain.id) as focus, focusIndex (focus.id)}
							{#if editingFocusId === focus.id}
								<!-- Edit focus inline form -->
								<div class="mb-1 rounded border border-slate-600 bg-slate-800 p-2">
									<input
										bind:value={editFocusName}
										onkeydown={handleEditFocusKeydown}
										class="mb-1.5 w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
									/>
									<div class="flex justify-end space-x-1">
										<button
											onclick={cancelEditFocus}
											class="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
										>
											Cancel
										</button>
										<button
											onclick={submitEditFocus}
											class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500"
										>
											Save
										</button>
									</div>
								</div>
							{:else}
								<div class="group/focus flex items-center">
									<button
										onclick={() => selectFocus(domain.id, focus.id)}
										class="flex min-w-0 flex-1 items-center rounded px-2 py-1 text-left text-sm transition-colors"
										class:bg-slate-700={selectedFocusId === focus.id}
										class:text-slate-100={selectedFocusId === focus.id}
										class:text-slate-400={selectedFocusId !== focus.id}
										class:hover:bg-slate-800={selectedFocusId !== focus.id}
									>
										<svg
											class="mr-1.5 h-3 w-3 flex-shrink-0"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 12l2 2 4-4"
											/>
										</svg>
										<span class="truncate">{focus.name}</span>
									</button>

									<!-- Focus actions (visible on hover) -->
									<div
										class="flex flex-shrink-0 items-center space-x-0.5 opacity-0 group-hover/focus:opacity-100"
									>
										{#if focusIndex > 0}
											<button
												onclick={() => moveFocusUp(domain.id, focusIndex)}
												class="rounded p-0.5 text-slate-500 hover:text-slate-300"
												title="Move up"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M5 15l7-7 7 7"
													/>
												</svg>
											</button>
										{/if}
										{#if focusIndex < focusesForDomain(domain.id).length - 1}
											<button
												onclick={() => moveFocusDown(domain.id, focusIndex)}
												class="rounded p-0.5 text-slate-500 hover:text-slate-300"
												title="Move down"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 9l-7 7-7-7"
													/>
												</svg>
											</button>
										{/if}
										<button
											onclick={() => startEditFocus(focus)}
											class="rounded p-0.5 text-slate-500 hover:text-slate-300"
											title="Edit focus"
										>
											<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
											</svg>
										</button>
										<button
											onclick={() => confirmDeleteFocus(focus)}
											class="rounded p-0.5 text-slate-500 hover:text-red-400"
											title="Delete focus"
										>
											<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</div>
								</div>
							{/if}
						{/each}

						<!-- Create Focus Form -->
						{#if creatingFocusForDomain === domain.id}
							<div class="mb-1 rounded border border-slate-600 bg-slate-800 p-2">
								<input
									bind:value={newFocusId}
									onkeydown={handleFocusFormKeydown}
									placeholder="Focus ID"
									class="mb-1.5 w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
								/>
								<input
									bind:value={newFocusName}
									onkeydown={handleFocusFormKeydown}
									placeholder="Focus Name"
									class="mb-1.5 w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
								/>
								<div class="flex justify-end space-x-1">
									<button
										onclick={cancelCreateFocus}
										class="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
									>
										Cancel
									</button>
									<button
										onclick={submitCreateFocus}
										class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500"
									>
										Create
									</button>
								</div>
							</div>
						{/if}

						<!-- Empty state for focuses -->
						{#if focusesForDomain(domain.id).length === 0 && creatingFocusForDomain !== domain.id}
							<p class="px-2 py-1 text-xs text-slate-500">No focuses</p>
						{/if}
					</div>
				{/if}
			</div>
		{/each}

		<!-- Empty state -->
		{#if sortedDomains.length === 0 && !creatingDomain}
			<div class="px-2 py-4 text-center">
				<p class="text-xs text-slate-500">No domains yet</p>
				<button onclick={startCreateDomain} class="mt-2 text-xs text-blue-400 hover:text-blue-300">
					Create a domain
				</button>
			</div>
		{/if}
	</div>
</div>

<ConfirmDialog
	title={confirmTitle}
	message={confirmMessage}
	confirmLabel="Delete"
	open={confirmOpen}
	onconfirm={handleConfirm}
	oncancel={handleConfirmCancel}
/>
