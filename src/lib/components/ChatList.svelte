<script lang="ts">
	import {
		filteredSessions,
		activeSessionKey,
		searchQuery,
		setActiveSession,
		renameSession,
		deleteSession,
		createSession,
		type ChatSessionInfo
	} from '$lib/stores/sessions.js';

	let sessionList = $state<ChatSessionInfo[]>([]);
	let activeKey = $state<string | null>(null);
	let query = $state('');
	let editingKey = $state<string | null>(null);
	let editName = $state('');

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
				onclick={() => selectSession(session.sessionKey)}
				class="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors {activeKey ===
				session.sessionKey
					? 'bg-gray-800 text-white'
					: 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
			>
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
