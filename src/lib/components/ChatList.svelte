<script lang="ts">
	import { goto } from '$app/navigation';
	import { usePan, type GestureCustomEvent } from 'svelte-gestures';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import {
		groupedSessions,
		activeSessionKey,
		searchQuery,
		setActiveSession,
		renameSession,
		deleteSession,
		createSessionOptimistic,
		togglePin,
		pinnedSessions,
		selectedAgentId,
		type ChatSessionInfo,
		type SessionGroup
	} from '$lib/stores/sessions.js';
	import { getAgentIdentity, connectionState } from '$lib/stores/agent-identity.js';
	import {
		searchAllChats,
		searchResults,
		isSearching,
		clearSearch,
		type SearchResult
	} from '$lib/stores/chat-search.js';
	import { loadThreads, threadsForSession } from '$lib/stores/threads.js';
	import CreateChatDialog from './CreateChatDialog.svelte';

	let {
		onselect,
		variant = 'desktop',
		legacy = false
	}: { onselect?: () => void; variant?: 'desktop' | 'mobile'; legacy?: boolean } = $props();

	function formatRelativeTime(ts: number): string {
		const diff = Date.now() - ts;
		if (diff < 60_000) return 'now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return `${Math.floor(diff / 86_400_000)}d ago`;
	}

	function shortModel(model: string): string {
		return model
			.replace(/^claude-/, '')
			.replace(/^openai\//, '')
			.replace(/-\d{8}$/, '');
	}

	let agentName = $state('Agent');
	let agentEmoji = $state<string | undefined>(undefined);
	let currentAgentId = $state<string | null>(null);

	$effect(() => {
		if (variant !== 'mobile') return;
		const unsub = selectedAgentId.subscribe((id) => {
			currentAgentId = id;
		});
		return unsub;
	});

	$effect(() => {
		if (variant !== 'mobile') return;
		const _id = currentAgentId;
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'READY') return;
			getAgentIdentity(_id ?? undefined).then((identity) => {
				agentName = identity.name || 'Agent';
				agentEmoji = identity.emoji;
			});
		});
		return unsub;
	});

	let pinnedItems = $state<ChatSessionInfo[]>([]);
	let groups = $state<SessionGroup[]>([]);
	let pinned = $state<string[]>([]);
	let collapsedGroups = new SvelteSet<string>();

	function toggleGroup(label: string) {
		if (collapsedGroups.has(label)) {
			collapsedGroups.delete(label);
		} else {
			collapsedGroups.add(label);
		}
	}

	let activeKey = $state<string | null>(null);
	let query = $state('');
	let editingKey = $state<string | null>(null);
	let editName = $state('');
	let showNewChatDialog = $state(false);
	let contentResults = $state<SearchResult[]>([]);
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	// Swipe-to-reveal state
	let swipedKey = $state<string | null>(null);
	let swipeOffset = $state(0);
	let panStartX = 0;
	let panStartY = 0;
	let isPanning = $state(false);
	let panKey = $state<string | null>(null);
	const SWIPE_THRESHOLD = 60;
	const ACTION_WIDTH = 180;

	// Delete confirmation state
	let deleteConfirmSession = $state<ChatSessionInfo | null>(null);

	function handlePanDown(e: GestureCustomEvent, key: string) {
		panStartX = e.detail.event.clientX;
		panStartY = e.detail.event.clientY;
		isPanning = false;
		panKey = key;
	}

	function handlePanMove(e: GestureCustomEvent, key: string) {
		if (panKey !== key) return;
		const dx = e.detail.event.clientX - panStartX;
		const dy = e.detail.event.clientY - panStartY;

		if (!isPanning && Math.abs(dy) > Math.abs(dx)) return;
		if (!isPanning && Math.abs(dx) > 10) {
			isPanning = true;
		}
		if (!isPanning) return;

		if (swipedKey === key) {
			const raw = -ACTION_WIDTH + dx;
			swipeOffset = Math.max(-ACTION_WIDTH, Math.min(0, raw));
		} else {
			swipeOffset = Math.max(-ACTION_WIDTH, Math.min(0, dx));
		}
	}

	function handlePanUp(_e: GestureCustomEvent, key: string) {
		if (panKey !== key) return;
		if (!isPanning) {
			if (swipedKey && swipedKey !== key) {
				swipedKey = null;
				swipeOffset = 0;
			}
			panKey = null;
			return;
		}

		if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
			swipedKey = key;
			swipeOffset = -ACTION_WIDTH;
		} else {
			swipedKey = null;
			swipeOffset = 0;
		}
		panKey = null;
	}

	function closeSwipe() {
		swipedKey = null;
		swipeOffset = 0;
	}

	$effect(() => {
		const unsub = groupedSessions.subscribe((v) => {
			pinnedItems = v.pinned;
			groups = v.groups;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = pinnedSessions.subscribe((v) => {
			pinned = v;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			activeKey = v;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = searchResults.subscribe((v) => {
			contentResults = v;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = isSearching.subscribe((v) => {
			searching = v;
		});
		return unsub;
	});

	// Thread count tracking per session
	let threadCounts = new SvelteMap<string, number>();
	let threadUnsubs: Array<() => void> = [];

	// Load threads for all visible sessions and subscribe to counts
	$effect(() => {
		// Clean up previous subscriptions
		for (const unsub of threadUnsubs) unsub();
		threadUnsubs = [];

		const allSessions = [...pinnedItems, ...groups.flatMap((g) => g.sessions)];
		for (const session of allSessions) {
			loadThreads(session.sessionKey).catch(() => {});
			const unsub = threadsForSession(session.sessionKey).subscribe((threads) => {
				threadCounts.set(session.sessionKey, threads.length);
			});
			threadUnsubs.push(unsub);
		}

		return () => {
			for (const unsub of threadUnsubs) unsub();
			threadUnsubs = [];
		};
	});

	function selectSession(key: string) {
		setActiveSession(key);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- static route
		goto('/');
		onselect?.();
	}

	function startRename(session: ChatSessionInfo) {
		editingKey = session.sessionKey;
		editName = session.displayName;
	}

	async function commitRename() {
		if (editingKey && editName.trim()) {
			await renameSession(editingKey, editName.trim());
		}
		editingKey = null;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitRename();
		}
		if (e.key === 'Escape') {
			editingKey = null;
		}
	}

	function promptDelete(session: ChatSessionInfo) {
		closeSwipe();
		deleteConfirmSession = session;
	}

	async function confirmDelete() {
		if (!deleteConfirmSession) return;
		await deleteSession(deleteConfirmSession.sessionKey);
		deleteConfirmSession = null;
	}

	function cancelDelete() {
		deleteConfirmSession = null;
	}

	function handleSearch(e: Event) {
		const input = e.target as HTMLInputElement;
		searchQuery.set(input.value);
		query = input.value;

		if (searchTimer) clearTimeout(searchTimer);
		if (input.value.trim().length > 2) {
			searchTimer = setTimeout(() => {
				searchAllChats(input.value.trim());
			}, 300);
		} else {
			clearSearch();
		}
	}

	function handleNewChat() {
		showNewChatDialog = true;
	}

	function handleCreateConfirm(name: string) {
		showNewChatDialog = false;
		const key = createSessionOptimistic(name || undefined);
		selectSession(key);
	}

	function handleCreateCancel() {
		showNewChatDialog = false;
	}

	function createPanProps(key: string) {
		return usePan(
			() => {},
			() => ({ delay: 0, touchAction: 'pan-y' as const }),
			{
				onpandown: (e: GestureCustomEvent) => handlePanDown(e, key),
				onpanmove: (e: GestureCustomEvent) => handlePanMove(e, key),
				onpanup: (e: GestureCustomEvent) => handlePanUp(e, key)
			}
		);
	}
</script>

<div class="flex flex-col">
	{#if variant === 'mobile' && !legacy}
		<!-- Mobile: Agent name header -->
		<div class="flex items-center gap-1 px-3 pb-2 pt-3">
			<span class="text-base font-bold text-white"
				>{agentEmoji ? `${agentEmoji} ` : ''}{agentName}</span
			>
			<svg class="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
			</svg>
		</div>

		<!-- Mobile: Search + New button row -->
		<div class="flex items-center gap-2 px-3 pb-2">
			<div class="relative flex-1">
				<svg
					class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<input
					type="text"
					value={query}
					oninput={handleSearch}
					placeholder="Search"
					class="w-full rounded-full bg-gray-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-700"
				/>
			</div>
			<button
				onclick={handleNewChat}
				class="flex shrink-0 items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				New
			</button>
		</div>
	{:else if !legacy}
		<!-- Desktop: existing layout -->
		<!-- New Chat button -->
		<div class="px-2 pb-2">
			<button
				onclick={handleNewChat}
				class="flex w-full items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				New Chat
			</button>
		</div>

		<!-- Search -->
		<div class="px-2 pb-2">
			<input
				type="text"
				value={query}
				oninput={handleSearch}
				placeholder="Search chats..."
				class="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
			/>
		</div>
	{/if}

	{#snippet sessionRow(
		session: ChatSessionInfo,
		isOpen: boolean,
		offset: number,
		isPinned: boolean,
		panProps: ReturnType<typeof createPanProps>
	)}
		<div class="group relative overflow-hidden rounded">
			<!-- Action buttons revealed behind the row -->
			{#if isOpen}
				<div class="absolute inset-y-0 right-0 flex items-stretch">
					<button
						onclick={() => {
							closeSwipe();
							togglePin(session.sessionKey);
						}}
						class="flex w-[60px] items-center justify-center bg-amber-600 text-xs font-medium text-white transition-colors hover:bg-amber-500"
						aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}
					>
						{isPinned ? 'Unpin' : 'Pin'}
					</button>
					<button
						onclick={() => {
							closeSwipe();
							startRename(session);
						}}
						class="flex w-[60px] items-center justify-center bg-blue-600 text-xs font-medium text-white transition-colors hover:bg-blue-500"
						aria-label="Rename chat"
					>
						Rename
					</button>
					<button
						onclick={() => promptDelete(session)}
						class="flex w-[60px] items-center justify-center bg-red-600 text-xs font-medium text-white transition-colors hover:bg-red-500"
						aria-label="Delete chat"
					>
						Delete
					</button>
				</div>
			{/if}

			<!-- Main session row — slides left on swipe -->
			<button
				{...panProps}
				onclick={() => {
					if (isPanning) return;
					if (swipedKey) {
						closeSwipe();
						return;
					}
					selectSession(session.sessionKey);
				}}
				class="relative flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors {activeKey ===
				session.sessionKey
					? 'bg-gray-800 text-white'
					: 'bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white'}"
				style="transform: translateX({offset}px); transition: {isPanning &&
				panKey === session.sessionKey
					? 'none'
					: 'transform 0.2s ease'}"
			>
				{#if editingKey === session.sessionKey}
					<!-- eslint-disable-next-line svelte/no-autofocus -- renaming needs immediate focus -->
					<input
						type="text"
						bind:value={editName}
						onblur={commitRename}
						onkeydown={handleRenameKeydown}
						onclick={(e) => e.stopPropagation()}
						autofocus
						class="flex-1 rounded bg-gray-700 px-2 py-0.5 text-xs text-white focus:outline-none"
					/>
				{:else}
					<div class="flex min-w-0 flex-1 flex-col">
						<span
							class="truncate"
							ondblclick={(e) => {
								e.stopPropagation();
								startRename(session);
							}}
							role="button"
							tabindex="0"
						>
							{#if isPinned}<svg
									class="mr-0.5 inline h-3 w-3 text-amber-500"
									fill="currentColor"
									viewBox="0 0 24 24"
									><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" /></svg
								>{/if}{#if variant === 'mobile' && agentEmoji}<span class="mr-1">{agentEmoji}</span
								>{/if}{session.displayName}
						</span>
						{#if session.model || session.totalTokens || session.updatedAt}
							<span class="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
								{#if session.model}
									<span
										class="rounded bg-gray-700/50 px-1 py-px leading-tight"
										title={session.model}>{shortModel(session.model)}</span
									>
								{/if}
								{#if session.totalTokens && session.contextTokens}
									{@const pct = Math.min(
										100,
										Math.round((session.totalTokens / session.contextTokens) * 100)
									)}
									<span
										class="inline-flex items-center gap-0.5"
										title="{session.totalTokens.toLocaleString()} / {session.contextTokens.toLocaleString()} tokens"
									>
										<span class="inline-block h-1 w-6 overflow-hidden rounded-full bg-gray-700">
											<span
												class="block h-full rounded-full {pct > 80
													? 'bg-red-500'
													: pct > 50
														? 'bg-yellow-500'
														: 'bg-blue-500'}"
												style="width:{pct}%"
											></span>
										</span>
										{pct}%
									</span>
								{/if}
								{#if session.updatedAt}
									<span>{formatRelativeTime(session.updatedAt)}</span>
								{/if}
								{#if (threadCounts.get(session.sessionKey) ?? 0) > 0}
									<span
										class="inline-flex items-center gap-0.5"
										title="{threadCounts.get(session.sessionKey)} thread{threadCounts.get(
											session.sessionKey
										) === 1
											? ''
											: 's'}"
									>
										<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
											/>
										</svg>
										{threadCounts.get(session.sessionKey)}
									</span>
								{/if}
							</span>
						{/if}
					</div>
				{/if}

				<!-- Unread badge -->
				{#if session.unreadCount > 0}
					<span
						class="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white"
					>
						{session.unreadCount}
					</span>
				{/if}
			</button>

			<!-- Desktop hover actions -->
			<div
				class="pointer-events-none absolute inset-y-0 right-1 hidden items-center gap-0.5 group-hover:flex"
			>
				<button
					onclick={() => togglePin(session.sessionKey)}
					class="pointer-events-auto rounded p-0.5 transition-colors {isPinned
						? 'text-amber-500 hover:text-amber-400'
						: 'text-gray-500 hover:text-amber-400'}"
					aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}
				>
					<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
					</svg>
				</button>
				<button
					onclick={() => startRename(session)}
					class="pointer-events-auto rounded p-0.5 text-gray-500 transition-colors hover:text-blue-400"
					aria-label="Rename chat"
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
				</button>
				<button
					onclick={() => promptDelete(session)}
					class="pointer-events-auto rounded p-0.5 text-gray-500 transition-colors hover:text-red-400"
					aria-label="Delete chat"
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/snippet}

	<!-- Session list -->
	<div class="flex-1 overflow-y-auto">
		<!-- Pinned sessions -->
		{#if pinnedItems.length > 0}
			<div class="px-1 pb-1">
				<div class="flex items-center gap-1 px-1 py-1">
					<svg class="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
						<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
					</svg>
					<span class="text-[10px] font-semibold uppercase tracking-wider text-gray-500"
						>Pinned</span
					>
				</div>
				{#each pinnedItems as session (session.sessionKey)}
					{@const isOpen = swipedKey === session.sessionKey}
					{@const offset = isOpen ? swipeOffset : 0}
					{@const panProps = createPanProps(session.sessionKey)}
					{@render sessionRow(session, isOpen, offset, true, panProps)}
				{/each}
			</div>
		{/if}

		<!-- Time-grouped sessions -->
		{#each groups as group (group.label)}
			<div class="px-1 pb-1">
				<button
					onclick={() => toggleGroup(group.label)}
					class="flex w-full items-center gap-1 px-1 py-1 text-left"
				>
					<svg
						class="h-3 w-3 text-gray-500 transition-transform {collapsedGroups.has(group.label)
							? '-rotate-90'
							: ''}"
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
					<span class="text-[10px] font-semibold uppercase tracking-wider text-gray-500"
						>{group.label}</span
					>
				</button>
				{#if !collapsedGroups.has(group.label)}
					{#each group.sessions as session (session.sessionKey)}
						{@const isOpen = swipedKey === session.sessionKey}
						{@const offset = isOpen ? swipeOffset : 0}
						{@const isPinned = pinned.includes(session.sessionKey)}
						{@const panProps = createPanProps(session.sessionKey)}
						{@render sessionRow(session, isOpen, offset, isPinned, panProps)}
					{/each}
				{/if}
			</div>
		{/each}

		{#if pinnedItems.length === 0 && groups.length === 0 && contentResults.length === 0 && !searching}
			<div class="px-2 py-4 text-center text-xs italic text-gray-500">
				{query ? 'No matching chats' : 'No chats yet'}
			</div>
		{/if}

		<!-- Content search results -->
		{#if query.trim().length > 2 && (contentResults.length > 0 || searching)}
			<div class="border-t border-gray-700/50 pt-1">
				<div class="flex items-center gap-1.5 px-2 py-1.5">
					<span class="text-xs font-medium uppercase tracking-wider text-gray-400"
						>Message matches</span
					>
					{#if searching}
						<span class="text-xs text-gray-500">...</span>
					{:else}
						<span class="text-xs text-gray-500">{contentResults.length}</span>
					{/if}
				</div>
				{#each contentResults as result (result.messageId)}
					<button
						onclick={() => selectSession(result.sessionKey)}
						class="group flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-colors {activeKey ===
						result.sessionKey
							? 'bg-gray-800 text-white'
							: 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
					>
						<span class="truncate text-sm">{result.sessionName || 'Untitled'}</span>
						<span class="truncate text-[10px] text-gray-500"
							>{result.highlight || result.content}</span
						>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if showNewChatDialog}
		<CreateChatDialog onconfirm={handleCreateConfirm} oncancel={handleCreateCancel} />
	{/if}

	{#if deleteConfirmSession}
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
					Delete {deleteConfirmSession.displayName}?
				</h3>
				<p class="mb-4 text-xs text-gray-400">
					This deletes the session and archives its transcript.
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
