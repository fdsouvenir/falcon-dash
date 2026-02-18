<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		groupedSessions,
		activeSessionKey,
		searchQuery,
		setActiveSession,
		renameSession,
		deleteSession,
		createSession,
		reorderSessions,
		setManualOrder,
		type ChatSessionInfo,
		type SessionGroup
	} from '$lib/stores/sessions.js';
	import { SvelteSet } from 'svelte/reactivity';
	import { call } from '$lib/stores/gateway.js';
	import CreateChatDialog from './CreateChatDialog.svelte';

	let { onselect, variant = 'desktop' }: { onselect?: () => void; variant?: 'desktop' | 'mobile' } =
		$props();

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

	let groups = $state<SessionGroup[]>([]);
	let activeKey = $state<string | null>(null);
	let query = $state('');
	let editingKey = $state<string | null>(null);
	let editName = $state('');
	let draggedKey = $state<string | null>(null);
	let showNewChatDialog = $state(false);

	const COLLAPSED_STORAGE_KEY = 'falcon-dash:collapsedGroups';

	function loadCollapsedGroups(): SvelteSet<string> {
		try {
			if (typeof window === 'undefined') return new SvelteSet();
			const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
			return raw ? new SvelteSet(JSON.parse(raw)) : new SvelteSet();
		} catch {
			return new SvelteSet();
		}
	}

	function persistCollapsedGroups(groups: SvelteSet<string>): void {
		try {
			if (typeof window === 'undefined') return;
			localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...groups]));
		} catch {
			// Storage unavailable
		}
	}

	let collapsed = $state(loadCollapsedGroups());

	function toggleGroup(groupId: string) {
		if (collapsed.has(groupId)) {
			collapsed.delete(groupId);
		} else {
			collapsed.add(groupId);
		}
		persistCollapsedGroups(collapsed);
	}

	$effect(() => {
		const unsub = groupedSessions.subscribe((v) => {
			groups = v;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			activeKey = v;
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
		if (session.isGeneral) return;
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
		if (session.isGeneral) return;
		await deleteSession(session.sessionKey);
	}

	function handleSearch(e: Event) {
		const input = e.target as HTMLInputElement;
		searchQuery.set(input.value);
		query = input.value;
	}

	function handleNewChat() {
		showNewChatDialog = true;
	}

	async function handleCreateConfirm(name: string) {
		showNewChatDialog = false;
		const key = await createSession(name || undefined);
		selectSession(key);
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

		const allSessions = groups.flatMap((g) => g.sessions);
		const nonGeneralSessions = allSessions.filter((s) => !s.isGeneral);
		const draggedIndex = nonGeneralSessions.findIndex((s) => s.sessionKey === draggedKey);
		const targetIndex = nonGeneralSessions.findIndex((s) => s.sessionKey === targetKey);

		if (draggedIndex === -1 || targetIndex === -1) {
			draggedKey = null;
			return;
		}

		const reordered = [...nonGeneralSessions];
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

	<!-- Session list (grouped) -->
	<div class="flex-1 overflow-y-auto">
		{#each groups as group (group.id)}
			{#if group.id === 'general'}
				{#each group.sessions as session (session.sessionKey)}
					{@render sessionButton(session)}
				{/each}
			{:else}
				<button
					onclick={() => toggleGroup(group.id)}
					class="flex w-full items-center gap-1.5 px-2 py-1.5"
				>
					<svg
						class="h-3 w-3 text-gray-500 transition-transform {collapsed.has(group.id)
							? ''
							: 'rotate-90'}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
					<span class="text-xs font-medium uppercase tracking-wider text-gray-400"
						>{group.label}</span
					>
					<span class="text-xs text-gray-500">{group.sessions.length}</span>
				</button>

				{#if !collapsed.has(group.id)}
					{#each group.sessions as session (session.sessionKey)}
						{@render sessionButton(session)}
					{/each}
				{/if}
			{/if}
		{/each}

		{#if groups.length === 0}
			<div class="px-2 py-4 text-center text-xs italic text-gray-500">
				{query ? 'No matching chats' : 'No chats yet'}
			</div>
		{/if}
	</div>

	{#if showNewChatDialog}
		<CreateChatDialog onconfirm={handleCreateConfirm} oncancel={handleCreateCancel} />
	{/if}
</div>

{#snippet sessionButton(session: ChatSessionInfo)}
	<button
		draggable={!session.isGeneral}
		ondragstart={() => dragStart(session.sessionKey)}
		ondragover={(e) => dragOver(e, session.sessionKey)}
		ondrop={() => drop(session.sessionKey)}
		onclick={() => selectSession(session.sessionKey)}
		class="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors {activeKey ===
		session.sessionKey
			? 'bg-gray-800 text-white'
			: 'text-gray-300 hover:bg-gray-800 hover:text-white'} {draggedKey === session.sessionKey
			? 'opacity-50'
			: ''}"
	>
		{#if !session.isGeneral}
			<svg
				class="h-3.5 w-3.5 flex-shrink-0 text-gray-600 opacity-0 transition-opacity group-hover:opacity-100"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
			</svg>
		{/if}
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
			<span
				class="flex-1 truncate"
				ondblclick={(e) => {
					e.stopPropagation();
					startRename(session);
				}}
				role="button"
				tabindex="0"
			>
				{#if variant === 'mobile' && !session.isGeneral}<span class="text-gray-500"
						>#
					</span>{/if}{session.displayName}
			</span>
			{#if session.channel}
				<span class="text-indigo-400" title="Synced with Discord">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"
						/>
					</svg>
				</span>
			{/if}
		{/if}

		<!-- Unread badge -->
		{#if session.unreadCount > 0}
			<span
				class="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white"
			>
				{session.unreadCount}
			</span>
		{/if}

		<!-- Delete button (not for General) -->
		{#if !session.isGeneral}
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
				class="hidden text-gray-500 hover:text-red-400 group-hover:block"
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
		{/if}
	</button>
{/snippet}
