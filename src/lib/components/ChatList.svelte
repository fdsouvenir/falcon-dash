<script lang="ts">
	import {
		filteredSessions,
		activeSessionKey,
		searchQuery,
		setActiveSession,
		renameSession,
		deleteSession,
		createSession,
		reorderSessions,
		type ChatSessionInfo
	} from '$lib/stores/sessions.js';

	let sessionList = $state<ChatSessionInfo[]>([]);
	let activeKey = $state<string | null>(null);
	let query = $state('');
	let editingKey = $state<string | null>(null);
	let editName = $state('');
	let draggedKey = $state<string | null>(null);

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

	function selectSession(key: string) {
		setActiveSession(key);
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

	async function handleNewChat() {
		await createSession();
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

		const nonGeneralSessions = sessionList.filter((s) => !s.isGeneral);
		const draggedIndex = nonGeneralSessions.findIndex((s) => s.sessionKey === draggedKey);
		const targetIndex = nonGeneralSessions.findIndex((s) => s.sessionKey === targetKey);

		if (draggedIndex === -1 || targetIndex === -1) {
			draggedKey = null;
			return;
		}

		const reordered = [...nonGeneralSessions];
		const [dragged] = reordered.splice(draggedIndex, 1);
		reordered.splice(targetIndex, 0, dragged);

		await reorderSessions(reordered.map((s) => s.sessionKey));
		draggedKey = null;
	}
</script>

<div class="flex flex-col">
	<!-- New Chat button -->
	<div class="px-2 pb-2">
		<button
			onclick={handleNewChat}
			class="flex w-full items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
		>
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
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

	<!-- Session list -->
	<div class="flex-1 overflow-y-auto">
		{#each sessionList as session (session.sessionKey)}
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
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 8h16M4 16h16"
						/>
					</svg>
				{/if}
				{#if editingKey === session.sessionKey}
					<input
						type="text"
						bind:value={editName}
						onblur={commitRename}
						onkeydown={handleRenameKeydown}
						class="flex-1 rounded bg-gray-700 px-2 py-0.5 text-xs text-white focus:outline-none"
					/>
				{:else}
					<span
						class="flex-1 truncate"
						ondblclick={() => startRename(session)}
						role="button"
						tabindex="0"
					>
						{session.displayName}
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
		{/each}

		{#if sessionList.length === 0}
			<div class="px-2 py-4 text-center text-xs italic text-gray-500">
				{query ? 'No matching chats' : 'No chats yet'}
			</div>
		{/if}
	</div>
</div>
