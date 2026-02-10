<script lang="ts">
	import {
		searchResults,
		isSearching,
		searchAllChats,
		searchInSession,
		clearSearch,
		type SearchResult
	} from '$lib/stores/chat-search.js';
	import { activeSessionKey } from '$lib/stores/sessions.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';

	let {
		onjump
	}: {
		onjump: (sessionKey: string, messageId: string) => void;
	} = $props();

	let query = $state('');
	let results = $state<SearchResult[]>([]);
	let searching = $state(false);
	let sessionKey = $state<string | null>(null);
	let searchMode = $state<'all' | 'session'>('all');

	$effect(() => {
		const unsub = searchResults.subscribe((v) => {
			results = v;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = isSearching.subscribe((v) => {
			searching = v;
		});
		return unsub;
	});
	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			sessionKey = v;
		});
		return unsub;
	});

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		query = input.value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			if (searchMode === 'session' && sessionKey) {
				searchInSession(sessionKey, query);
			} else {
				searchAllChats(query);
			}
		}, 300);
	}

	function handleClose() {
		query = '';
		clearSearch();
	}

	function handleJump(result: SearchResult) {
		onjump(result.sessionKey, result.messageId);
	}
</script>

<div class="flex flex-col border-b border-gray-800 bg-gray-900 p-3">
	<div class="flex items-center gap-2">
		<div class="flex rounded border border-gray-700 bg-gray-800">
			<button
				onclick={() => {
					searchMode = 'all';
				}}
				class="px-2 py-1 text-xs {searchMode === 'all'
					? 'bg-gray-700 text-white'
					: 'text-gray-400'}"
			>
				All Chats
			</button>
			<button
				onclick={() => {
					searchMode = 'session';
				}}
				class="px-2 py-1 text-xs {searchMode === 'session'
					? 'bg-gray-700 text-white'
					: 'text-gray-400'}"
			>
				This Chat
			</button>
		</div>
		<input
			type="text"
			value={query}
			oninput={handleInput}
			placeholder="Search messages..."
			class="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
		/>
		<button
			onclick={handleClose}
			class="rounded p-1 text-gray-400 hover:text-white"
			aria-label="Close search"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>

	{#if searching}
		<div class="mt-2 text-center text-xs text-gray-500">Searching...</div>
	{:else if results.length > 0}
		<div class="mt-2 max-h-60 overflow-y-auto">
			{#each results as result (result.messageId)}
				<button
					onclick={() => handleJump(result)}
					class="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-gray-800"
				>
					<div class="flex items-center gap-2 text-xs">
						<span class="font-medium text-gray-300">{result.sessionName}</span>
						<span class="text-gray-600">{formatRelativeTime(result.timestamp)}</span>
					</div>
					<div class="truncate text-xs text-gray-400">
						{result.highlight || result.content.slice(0, 120)}
					</div>
				</button>
			{/each}
		</div>
	{:else if query}
		<div class="mt-2 text-center text-xs text-gray-500">No results found</div>
	{/if}
</div>
