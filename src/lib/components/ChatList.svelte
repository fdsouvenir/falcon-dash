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

	async function handleDelete(session: ChatSessionInfo) {
		await deleteSession(session.sessionKey);
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
</div>

{#snippet sessionButton(session: ChatSessionInfo)}
	<button
		draggable={true}
		ondragstart={() => dragStart(session.sessionKey)}
		ondragover={(e) => dragOver(e, session.sessionKey)}
		ondrop={() => drop(session.sessionKey)}
		onclick={() => selectSession(session.sessionKey)}
		class="group flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors {activeKey ===
		session.sessionKey
			? 'bg-gray-800 text-white'
			: 'text-gray-300 hover:bg-gray-800 hover:text-white'} {draggedKey === session.sessionKey
			? 'opacity-50'
			: ''}"
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
					{#if variant === 'mobile'}<span class="text-gray-500"># </span>{/if}{session.displayName}
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

		<!-- Delete button -->
		<div
			onclick={(e) => {
				e.stopPropagation();
				handleDelete(session);
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.stopPropagation();
					handleDelete(session);
				}
			}}
			role="button"
			tabindex="0"
			class="mt-0.5 hidden text-gray-500 hover:text-red-400 group-hover:block"
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
		</div>
	</button>
{/snippet}
