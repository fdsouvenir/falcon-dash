<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		channelsForAgent,
		activeChannelId,
		setActiveChannel,
		createChannel,
		renameChannel,
		deleteChannel,
		type Channel
	} from '$lib/stores/channels.js';
	import { selectedAgentId, sessions } from '$lib/stores/sessions.js';
	import CreateChannelDialog from './CreateChannelDialog.svelte';

	let { onselect }: { onselect?: () => void } = $props();

	let agentId = $state<string | null>(null);
	let channelList = $state<Channel[]>([]);
	let activeId = $state<string | null>(null);
	let showCreateDialog = $state(false);
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let deleteConfirmChannel = $state<Channel | null>(null);

	// Unread counts from sessions store keyed by session key
	let unreadCounts = $state<Record<string, number>>({});

	$effect(() => {
		const unsub = selectedAgentId.subscribe((id) => {
			agentId = id;
		});
		return unsub;
	});

	$effect(() => {
		const id = agentId;
		if (!id) {
			channelList = [];
			return;
		}
		const store = channelsForAgent(id);
		const unsub = store.subscribe((v) => {
			channelList = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = activeChannelId.subscribe((v) => {
			activeId = v;
		});
		return unsub;
	});

	// Track unread counts from the sessions store
	$effect(() => {
		const unsub = sessions.subscribe(($sessions) => {
			const counts: Record<string, number> = {};
			for (const s of $sessions) {
				if (s.unreadCount > 0) {
					counts[s.sessionKey] = s.unreadCount;
				}
			}
			unreadCounts = counts;
		});
		return unsub;
	});

	function selectChannel(channel: Channel) {
		setActiveChannel(channel.id);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- static route
		goto('/');
		onselect?.();
	}

	function startRename(channel: Channel) {
		editingId = channel.id;
		editName = channel.name;
	}

	async function commitRename() {
		if (editingId && editName.trim()) {
			await renameChannel(editingId, editName.trim());
		}
		editingId = null;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitRename();
		}
		if (e.key === 'Escape') {
			editingId = null;
		}
	}

	function promptDelete(channel: Channel) {
		deleteConfirmChannel = channel;
	}

	async function confirmDelete() {
		if (!deleteConfirmChannel) return;
		await deleteChannel(deleteConfirmChannel.id);
		deleteConfirmChannel = null;
	}

	function cancelDelete() {
		deleteConfirmChannel = null;
	}

	async function handleCreateConfirm(name: string, description?: string) {
		showCreateDialog = false;
		if (!agentId) return;
		const channel = await createChannel(agentId, name, description);
		selectChannel(channel);
	}

	function handleCreateCancel() {
		showCreateDialog = false;
	}

	let existingNames = $derived(channelList.map((c) => c.name));
</script>

<div class="flex flex-col">
	<!-- Header row -->
	<div class="flex items-center justify-between px-2 pb-2">
		<span class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Channels</span>
		<button
			onclick={() => (showCreateDialog = true)}
			class="rounded p-0.5 text-gray-500 transition-colors hover:text-white"
			aria-label="Create channel"
			title="Create channel"
		>
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</div>

	<!-- Channel list -->
	<div class="flex-1 overflow-y-auto">
		{#each channelList as channel (channel.id)}
			{@const isActive = activeId === channel.id}
			{@const unread = unreadCounts[channel.sessionKey] ?? 0}
			<div class="group relative">
				<button
					onclick={() => selectChannel(channel)}
					class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm transition-colors {isActive
						? 'bg-gray-800 text-white'
						: 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}"
				>
					{#if editingId === channel.id}
						<!-- eslint-disable-next-line svelte/no-autofocus -- renaming needs immediate focus -->
						<span class="text-gray-500">#</span>
						<input
							type="text"
							bind:value={editName}
							onblur={commitRename}
							onkeydown={handleRenameKeydown}
							onclick={(e) => e.stopPropagation()}
							autofocus
							class="flex-1 rounded bg-gray-700 px-1.5 py-0.5 text-xs text-white focus:outline-none"
						/>
					{:else}
						<span class="text-gray-500">#</span>
						<span class="flex-1 truncate {unread > 0 ? 'font-semibold text-white' : ''}"
							>{channel.name}</span
						>

						{#if unread > 0}
							<span
								class="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium text-white"
							>
								{unread}
							</span>
						{/if}
					{/if}
				</button>

				<!-- Hover actions (not on default channel for delete) -->
				{#if editingId !== channel.id}
					<div
						class="pointer-events-none absolute inset-y-0 right-1 hidden items-center gap-0.5 group-hover:flex"
					>
						<button
							onclick={(e) => {
								e.stopPropagation();
								startRename(channel);
							}}
							class="pointer-events-auto rounded p-0.5 text-gray-500 transition-colors hover:text-blue-400"
							aria-label="Rename channel"
						>
							<svg
								class="h-3 w-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
								/>
							</svg>
						</button>
						{#if !channel.isDefault}
							<button
								onclick={(e) => {
									e.stopPropagation();
									promptDelete(channel);
								}}
								class="pointer-events-auto rounded p-0.5 text-gray-500 transition-colors hover:text-red-400"
								aria-label="Delete channel"
							>
								<svg
									class="h-3 w-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}

		{#if channelList.length === 0}
			<div class="px-2 py-3 text-center text-xs italic text-gray-500">No channels yet</div>
		{/if}
	</div>

	{#if showCreateDialog && agentId}
		<CreateChannelDialog
			{agentId}
			{existingNames}
			onconfirm={handleCreateConfirm}
			oncancel={handleCreateCancel}
		/>
	{/if}

	{#if deleteConfirmChannel}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={(e) => {
				if (e.target === e.currentTarget) cancelDelete();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') cancelDelete();
			}}
			role="dialog"
			aria-modal="true"
			aria-label="Confirm delete"
		>
			<div class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl">
				<h3 class="mb-1 text-sm font-medium text-white">
					Delete #{deleteConfirmChannel.name}?
				</h3>
				<p class="mb-4 text-xs text-gray-400">
					This deletes the channel and archives its transcript.
				</p>
				<div class="flex justify-end gap-2">
					<button
						onclick={cancelDelete}
						class="rounded px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
					>
						Cancel
					</button>
					<button
						onclick={confirmDelete}
						class="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
