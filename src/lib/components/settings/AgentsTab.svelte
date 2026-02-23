<script lang="ts">
	import { get } from 'svelte/store';
	import { sessions } from '$lib/stores/sessions.js';
	import { snapshot } from '$lib/stores/gateway.js';
	import { addToast } from '$lib/stores/toast.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	interface AgentEntry {
		id: string;
		workspace: string;
		identity?: { name: string; emoji?: string; theme?: string };
	}

	interface EnrichedAgent extends AgentEntry {
		displayName: string;
		initial: string;
		sessionCount: number;
		isDefault: boolean;
		isFirst: boolean;
	}

	let agents = $state<AgentEntry[]>([]);
	let configHash = $state('');
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Modal states
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteConfirm = $state(false);
	let selectedAgent = $state<AgentEntry | null>(null);

	// Form fields
	let formId = $state('');
	let formName = $state('');
	let formEmoji = $state('');
	let formTheme = $state('');
	let formSaving = $state(false);
	let formError = $state<string | null>(null);

	// Restart banner
	let needsRestart = $state(false);

	// Session counts from gateway
	let sessionCounts = $state<Record<string, number>>({});
	let defaultAgentId = $state('main');

	$effect(() => {
		const unsub = sessions.subscribe(($sessions) => {
			defaultAgentId = get(snapshot.sessionDefaults).defaultAgentId ?? 'main';
			const counts: Record<string, number> = {};
			for (const s of $sessions) {
				const match = s.sessionKey.match(/^agent:([^:]+):/);
				if (match) counts[match[1]] = (counts[match[1]] ?? 0) + 1;
			}
			sessionCounts = counts;
		});
		return unsub;
	});

	let enrichedAgents = $derived<EnrichedAgent[]>(
		agents.map((agent, idx) => {
			const displayName = agent.identity?.name || agent.id;
			return {
				...agent,
				displayName,
				initial: displayName.charAt(0).toUpperCase(),
				sessionCount: sessionCounts[agent.id] ?? 0,
				isDefault: agent.id === defaultAgentId,
				isFirst: idx === 0
			};
		})
	);

	$effect(() => {
		fetchAgents();
	});

	async function fetchAgents() {
		loading = true;
		error = null;
		try {
			const res = await fetch('/api/agents');
			if (!res.ok) throw new Error('Failed to load agents');
			const data = await res.json();
			agents = data.agents;
			configHash = data.hash;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load agents';
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		formId = '';
		formName = '';
		formEmoji = '';
		formTheme = '';
		formError = null;
		showCreateModal = true;
	}

	function openEdit(agent: AgentEntry) {
		selectedAgent = agent;
		formId = agent.id;
		formName = agent.identity?.name || '';
		formEmoji = agent.identity?.emoji || '';
		formTheme = agent.identity?.theme || '';
		formError = null;
		showEditModal = true;
	}

	function openDelete(agent: AgentEntry) {
		selectedAgent = agent;
		showDeleteConfirm = true;
	}

	function closeModals() {
		showCreateModal = false;
		showEditModal = false;
		showDeleteConfirm = false;
		selectedAgent = null;
		formSaving = false;
		formError = null;
	}

	async function handleCreate() {
		if (!formId.trim() || !formName.trim()) {
			formError = 'Agent ID and display name are required.';
			return;
		}
		if (!/^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/.test(formId.trim())) {
			formError = 'ID must be 2-32 lowercase alphanumeric chars and hyphens.';
			return;
		}

		formSaving = true;
		formError = null;
		try {
			const res = await fetch('/api/agents', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: formId.trim(),
					identity: {
						name: formName.trim(),
						emoji: formEmoji.trim() || undefined,
						theme: formTheme.trim() || undefined
					},
					hash: configHash
				})
			});

			if (!res.ok) {
				const data = await res.json();
				if (data.code === 'AGENT_CONFLICT') {
					await fetchAgents();
					formError = 'Config changed externally. Please try again.';
					return;
				}
				throw new Error(data.error || 'Failed to create agent');
			}

			closeModals();
			needsRestart = true;
			await fetchAgents();
			addToast(`Agent "${formName.trim()}" created`, 'success');
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Failed to create agent';
		} finally {
			formSaving = false;
		}
	}

	async function handleUpdate() {
		if (!formName.trim()) {
			formError = 'Display name is required.';
			return;
		}

		formSaving = true;
		formError = null;
		try {
			const res = await fetch(`/api/agents/${selectedAgent!.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					identity: {
						name: formName.trim(),
						emoji: formEmoji.trim() || undefined,
						theme: formTheme.trim() || undefined
					},
					hash: configHash
				})
			});

			if (!res.ok) {
				const data = await res.json();
				if (data.code === 'AGENT_CONFLICT') {
					await fetchAgents();
					formError = 'Config changed externally. Please try again.';
					return;
				}
				throw new Error(data.error || 'Failed to update agent');
			}

			closeModals();
			needsRestart = true;
			await fetchAgents();
			addToast(`Agent "${formName.trim()}" updated`, 'success');
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Failed to update agent';
		} finally {
			formSaving = false;
		}
	}

	async function handleDelete() {
		if (!selectedAgent) return;

		formSaving = true;
		try {
			const res = await fetch(`/api/agents/${selectedAgent.id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hash: configHash })
			});

			if (!res.ok) {
				const data = await res.json();
				if (data.code === 'AGENT_CONFLICT') {
					await fetchAgents();
					addToast('Config changed externally. Please try again.', 'error');
					closeModals();
					return;
				}
				throw new Error(data.error || 'Failed to delete agent');
			}

			const name = selectedAgent.identity?.name || selectedAgent.id;
			closeModals();
			needsRestart = true;
			await fetchAgents();
			addToast(`Agent "${name}" removed`, 'success');
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Failed to delete agent', 'error');
			closeModals();
		} finally {
			formSaving = false;
		}
	}

	function handleDialogKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			closeModals();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) closeModals();
	}
</script>

<div class="space-y-6 p-6">
	<!-- Restart banner -->
	{#if needsRestart}
		<div
			class="flex items-center justify-between rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3"
		>
			<p class="text-sm text-amber-300">
				Gateway config changed. Restart the gateway for changes to take effect.
			</p>
			<button
				onclick={() => (needsRestart = false)}
				class="ml-4 text-amber-400 hover:text-amber-200"
				aria-label="Dismiss"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-white">Agents</h2>
			<p class="mt-1 text-sm text-gray-400">Manage your configured agents</p>
		</div>
		<button
			onclick={openCreate}
			class="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-700 hover:text-white"
			aria-label="Add agent"
			title="Add agent"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</div>

	<!-- Error state -->
	{#if error}
		<div class="rounded-xl border border-red-800/50 bg-red-900/20 py-8 text-center">
			<p class="text-sm text-red-400">{error}</p>
			<button onclick={fetchAgents} class="mt-2 text-xs text-gray-400 underline hover:text-white">
				Retry
			</button>
		</div>
	{:else if loading}
		<div class="rounded-xl border border-gray-800 bg-gray-900/30 py-12 text-center">
			<p class="text-sm text-gray-500">Loading agents...</p>
		</div>
	{:else}
		<!-- Agent cards -->
		<div class="space-y-3">
			{#each enrichedAgents as agent (agent.id)}
				<Card.Root
					class="border-gray-800 bg-gray-900/50 px-4 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900"
				>
					<div class="flex items-center gap-4">
						<Avatar.Root class="h-11 w-11 rounded-xl">
							<Avatar.Fallback class="rounded-xl bg-rose-900/70 text-lg">
								{agent.identity?.emoji || agent.initial}
							</Avatar.Fallback>
						</Avatar.Root>

						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="truncate font-semibold text-white">{agent.displayName}</span>
								{#if agent.isDefault}
									<Badge variant="outline" class="border-amber-700/50 text-amber-400">
										Default
									</Badge>
								{/if}
								{#if agent.identity?.theme}
									<Badge variant="outline" class="border-gray-700 text-gray-400">
										{agent.identity.theme}
									</Badge>
								{/if}
							</div>
							<p class="mt-0.5 text-sm text-gray-400">
								<span class="font-mono text-xs text-gray-500">{agent.id}</span>
								<span class="mx-1.5 text-gray-600">&middot;</span>
								{agent.sessionCount}
								{agent.sessionCount === 1 ? 'session' : 'sessions'}
							</p>
						</div>

						<div class="flex items-center gap-2">
							<!-- Edit button -->
							<button
								onclick={() => openEdit(agent)}
								class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
								aria-label="Edit {agent.displayName}"
								title="Edit"
							>
								<svg
									class="h-3.5 w-3.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
									/>
								</svg>
							</button>

							<!-- Delete button (hidden for first/main agent) -->
							{#if !agent.isFirst}
								<button
									onclick={() => openDelete(agent)}
									class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
									aria-label="Delete {agent.displayName}"
									title="Delete"
								>
									<svg
										class="h-3.5 w-3.5"
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

							<!-- Online indicator -->
							<span
								class="h-2.5 w-2.5 rounded-full {agent.sessionCount > 0
									? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
									: 'bg-gray-600'}"
							></span>
						</div>
					</div>
				</Card.Root>
			{/each}

			{#if enrichedAgents.length === 0}
				<div class="rounded-xl border border-gray-800 bg-gray-900/30 py-12 text-center">
					<p class="text-sm text-gray-500">No agents configured</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Create Agent Modal -->
{#if showCreateModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleBackdropClick}
		onkeydown={handleDialogKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Create new agent"
	>
		<div class="w-96 rounded-lg border border-gray-700 bg-gray-800 p-5 shadow-xl">
			<h3 class="mb-4 text-sm font-semibold text-white">New Agent</h3>

			{#if formError}
				<div class="mb-3 rounded bg-red-900/30 px-3 py-2 text-xs text-red-400">{formError}</div>
			{/if}

			<div class="space-y-3">
				<div>
					<label for="agent-id" class="mb-1 block text-xs text-gray-400">Agent ID</label>
					<input
						id="agent-id"
						bind:value={formId}
						type="text"
						placeholder="research"
						class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 font-mono text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
					<p class="mt-1 text-xs text-gray-500">Lowercase letters, numbers, hyphens</p>
				</div>

				<div>
					<label for="agent-name" class="mb-1 block text-xs text-gray-400">Display Name</label>
					<input
						id="agent-name"
						bind:value={formName}
						type="text"
						placeholder="Research Agent"
						class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<div class="flex gap-3">
					<div class="w-20">
						<label for="agent-emoji" class="mb-1 block text-xs text-gray-400">Emoji</label>
						<input
							id="agent-emoji"
							bind:value={formEmoji}
							type="text"
							placeholder="🔬"
							class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-center text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
						/>
					</div>
					<div class="flex-1">
						<label for="agent-theme" class="mb-1 block text-xs text-gray-400">
							Theme
							<span class="text-gray-600">(optional)</span>
						</label>
						<input
							id="agent-theme"
							bind:value={formTheme}
							type="text"
							placeholder="research assistant"
							class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
						/>
					</div>
				</div>
			</div>

			<div class="mt-5 flex justify-end gap-2">
				<button
					onclick={closeModals}
					disabled={formSaving}
					class="rounded px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
				>
					Cancel
				</button>
				<button
					onclick={handleCreate}
					disabled={formSaving}
					class="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
				>
					{formSaving ? 'Creating...' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Agent Modal -->
{#if showEditModal && selectedAgent}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleBackdropClick}
		onkeydown={handleDialogKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Edit agent"
	>
		<div class="w-96 rounded-lg border border-gray-700 bg-gray-800 p-5 shadow-xl">
			<h3 class="mb-4 text-sm font-semibold text-white">Edit Agent</h3>

			{#if formError}
				<div class="mb-3 rounded bg-red-900/30 px-3 py-2 text-xs text-red-400">{formError}</div>
			{/if}

			<div class="space-y-3">
				<div>
					<label for="edit-agent-id" class="mb-1 block text-xs text-gray-400">Agent ID</label>
					<input
						id="edit-agent-id"
						value={formId}
						type="text"
						disabled
						class="w-full rounded border border-gray-700 bg-gray-900/50 px-3 py-1.5 font-mono text-sm text-gray-500"
					/>
				</div>

				<div>
					<label for="edit-agent-name" class="mb-1 block text-xs text-gray-400">
						Display Name
					</label>
					<input
						id="edit-agent-name"
						bind:value={formName}
						type="text"
						placeholder="Agent Name"
						class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<div class="flex gap-3">
					<div class="w-20">
						<label for="edit-agent-emoji" class="mb-1 block text-xs text-gray-400">Emoji</label>
						<input
							id="edit-agent-emoji"
							bind:value={formEmoji}
							type="text"
							placeholder="🔬"
							class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-center text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
						/>
					</div>
					<div class="flex-1">
						<label for="edit-agent-theme" class="mb-1 block text-xs text-gray-400">
							Theme
							<span class="text-gray-600">(optional)</span>
						</label>
						<input
							id="edit-agent-theme"
							bind:value={formTheme}
							type="text"
							placeholder="research assistant"
							class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
						/>
					</div>
				</div>
			</div>

			<div class="mt-5 flex justify-end gap-2">
				<button
					onclick={closeModals}
					disabled={formSaving}
					class="rounded px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
				>
					Cancel
				</button>
				<button
					onclick={handleUpdate}
					disabled={formSaving}
					class="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
				>
					{formSaving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && selectedAgent}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleBackdropClick}
		onkeydown={handleDialogKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Delete agent confirmation"
	>
		<div class="w-96 rounded-lg border border-gray-700 bg-gray-800 p-5 shadow-xl">
			<h3 class="mb-2 text-sm font-semibold text-white">Delete Agent</h3>
			<p class="mb-1 text-sm text-gray-300">
				Remove <strong>{selectedAgent.identity?.name || selectedAgent.id}</strong> from the configuration?
			</p>
			<p class="mb-5 text-xs text-gray-500">The workspace directory will not be deleted.</p>

			<div class="flex justify-end gap-2">
				<button
					onclick={closeModals}
					disabled={formSaving}
					class="rounded px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
				>
					Cancel
				</button>
				<button
					onclick={handleDelete}
					disabled={formSaving}
					class="rounded bg-red-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
				>
					{formSaving ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}
