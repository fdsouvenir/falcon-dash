<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		filteredSessions,
		activeSessionKey,
		searchQuery,
		setActiveSession,
		renameSession,
		deleteSession,
		createSession,
		reorderSessions,
		setManualOrder,
		type ChatSessionInfo
	} from '$lib/stores/sessions.js';
	import { call } from '$lib/stores/gateway.js';
	import {
		searchAllChats,
		searchResults,
		isSearching,
		clearSearch,
		type SearchResult
	} from '$lib/stores/chat-search.js';
	import CreateChatDialog from './CreateChatDialog.svelte';

	let { onselect, variant = 'desktop' }: { onselect?: () => void; variant?: 'desktop' | 'mobile' } =
		$props();

	function formatRelativeTime(ts: number): string {
		const diff = Date.now() - ts;
		if (diff < 60_000) return 'now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return `${Math.floor(diff / 86_400_000)}d ago`;
	}

	function shortModel(model: string): string {
		// Strip common prefixes for compact display
		return model
			.replace(/^claude-/, '')
			.replace(/^openai\//, '')
			.replace(/-\d{8}$/, '');
	}

	let agentName = $state('Agent');

	$effect(() => {
		if (variant !== 'mobile') return;
		call<{ name: string; description?: string }>('agent-identity')
			.then((identity) => {
				agentName = identity.name || 'Agent';
			})
			.catch(() => {
				agentName = 'Agent';
			});
	});

	let sessionList = $state<ChatSessionInfo[]>([]);
	let activeKey = $state<string | null>(null);
	let query = $state('');
	let editingKey = $state<string | null>(null);
	let editName = $state('');
	let draggedKey = $state<string | null>(null);
	let showNewChatDialog = $state(false);
	let contentResults = $state<SearchResult[]>([]);
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	// Swipe-to-reveal state
	let swipedKey = $state<string | null>(null);
	let swipeOffset = $state(0);
	let touchStartX = 0;
	let touchStartY = 0;
	let isSwiping = false;
	const SWIPE_THRESHOLD = 60;
	const ACTION_WIDTH = 120; // width of revealed action buttons

	// Delete confirmation state
	let deleteConfirmSession = $state<ChatSessionInfo | null>(null);

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
		isSwiping = false;
	}

	function handleTouchMove(e: TouchEvent, key: string) {
		const dx = e.touches[0].clientX - touchStartX;
		const dy = e.touches[0].clientY - touchStartY;

		// If vertical scroll is dominant, bail out
		if (!isSwiping && Math.abs(dy) > Math.abs(dx)) return;

		// Once horizontal movement exceeds a small threshold, commit to swipe
		if (!isSwiping && Math.abs(dx) > 10) {
			isSwiping = true;
		}

		if (!isSwiping) return;
		e.preventDefault();

		if (swipedKey === key) {
			// Already open — allow swiping back closed
			const raw = -ACTION_WIDTH + dx;
			swipeOffset = Math.max(-ACTION_WIDTH, Math.min(0, raw));
		} else {
			// Closed — only allow swiping left
			swipeOffset = Math.max(-ACTION_WIDTH, Math.min(0, dx));
		}
	}

	function handleTouchEnd(key: string) {
		if (!isSwiping) {
			// It was a tap, not a swipe — close any open actions
			if (swipedKey && swipedKey !== key) {
				swipedKey = null;
				swipeOffset = 0;
			}
			return;
		}

		if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
			// Commit open
			swipedKey = key;
			swipeOffset = -ACTION_WIDTH;
		} else {
			// Snap closed
			swipedKey = null;
			swipeOffset = 0;
		}
	}

	function closeSwipe() {
		swipedKey = null;
		swipeOffset = 0;
	}

	$effect(() => {
		const unsub = filteredSessions.subscribe((v) => {
			sessionList = v;
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

		// Content search for queries > 2 chars, debounced
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

	async function handleCreateConfirm(name: string) {
		showNewChatDialog = false;
		try {
			const key = await createSession(name || undefined);
			selectSession(key);
		} catch {
			// createSession already logs and reverts state
		}
	}

	function handleCreateCancel() {
		showNewChatDialog = false;
	}

	function dragStart(key: string) {
		draggedKey = key;
	}

	function dragOver(e: DragEvent, key: string) {
		if (!draggedKey || draggedKey === key) return;
		e.preventDefault();
	}

	async function drop(targetKey: string) {
		if (!draggedKey || draggedKey === targetKey) {
			draggedKey = null;
			return;
		}

		const draggedIndex = sessionList.findIndex((s) => s.sessionKey === draggedKey);
		const targetIndex = sessionList.findIndex((s) => s.sessionKey === targetKey);

		if (draggedIndex === -1 || targetIndex === -1) {
			draggedKey = null;
			return;
		}

		const reordered = [...sessionList];
		const [dragged] = reordered.splice(draggedIndex, 1);
		reordered.splice(targetIndex, 0, dragged);

		const keys = reordered.map((s) => s.sessionKey);
		setManualOrder(keys);
		await reorderSessions(keys);
		draggedKey = null;
	}
</script>

<div class="flex flex-col">
	{#if variant === 'mobile'}
		<!-- Mobile: Agent name header -->
		<div class="flex items-center gap-1 px-3 pb-2 pt-3">
			<span class="text-base font-bold text-white">{agentName}</span>
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
	{:else}
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

	<!-- Session list -->
	<div class="flex-1 overflow-y-auto">
		{#each sessionList as session (session.sessionKey)}
			{@render sessionButton(session)}
		{/each}

		{#if sessionList.length === 0 && contentResults.length === 0 && !searching}
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

{#snippet sessionButton(session: ChatSessionInfo)}
	{@const isOpen = swipedKey === session.sessionKey}
	{@const offset = isOpen ? swipeOffset : 0}
	<div class="group relative overflow-hidden rounded">
		<!-- Action buttons revealed behind the row -->
		<div class="absolute inset-y-0 right-0 flex items-stretch">
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

		<!-- Main session row — slides left on swipe -->
		<button
			draggable={true}
			ondragstart={() => dragStart(session.sessionKey)}
			ondragover={(e) => dragOver(e, session.sessionKey)}
			ondrop={() => drop(session.sessionKey)}
			onclick={() => {
				if (isSwiping) return;
				if (swipedKey) {
					closeSwipe();
					return;
				}
				selectSession(session.sessionKey);
			}}
			ontouchstart={(e) => handleTouchStart(e)}
			ontouchmove={(e) => handleTouchMove(e, session.sessionKey)}
			ontouchend={() => handleTouchEnd(session.sessionKey)}
			class="relative flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors {activeKey ===
			session.sessionKey
				? 'bg-gray-800 text-white'
				: 'bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white'} {draggedKey ===
			session.sessionKey
				? 'opacity-50'
				: ''}"
			style="transform: translateX({offset}px); transition: {isSwiping
				? 'none'
				: 'transform 0.2s ease'}"
		>
			<svg
				class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-600 opacity-0 transition-opacity group-hover:opacity-100"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
			</svg>
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
						{#if variant === 'mobile'}<span class="text-gray-500"
								>#
							</span>{/if}{session.displayName}
					</span>
					{#if session.model || session.totalTokens || session.updatedAt}
						<span class="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
							{#if session.model}
								<span class="rounded bg-gray-700/50 px-1 py-px leading-tight" title={session.model}
									>{shortModel(session.model)}</span
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

		<!-- Desktop hover actions (positioned outside the button to avoid nesting) -->
		<div
			class="pointer-events-none absolute inset-y-0 right-1 hidden items-center gap-0.5 group-hover:flex"
		>
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
