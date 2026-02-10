<script lang="ts">
	import {
		threadsForSession,
		openThread,
		archiveThread,
		type ThreadInfo,
		type ThreadState
	} from '$lib/stores/threads.js';
	import { activeSessionKey } from '$lib/stores/sessions.js';

	let sessionKey = $state<string | null>(null);
	let threads = $state<ThreadInfo[]>([]);

	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			sessionKey = v;
		});
		return unsub;
	});

	$effect(() => {
		if (!sessionKey) return;
		const unsub = threadsForSession(sessionKey).subscribe((v) => {
			threads = v;
		});
		return unsub;
	});

	function stateLabel(state: ThreadState): string {
		return state.charAt(0).toUpperCase() + state.slice(1);
	}

	function stateColor(state: ThreadState): string {
		if (state === 'active') return 'text-green-400';
		if (state === 'archived') return 'text-gray-500';
		return 'text-yellow-400'; // locked
	}

	function formatTime(ts: number): string {
		const diff = Date.now() - ts;
		if (diff < 60000) return 'just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return `${Math.floor(diff / 86400000)}d ago`;
	}

	async function handleOpen(thread: ThreadInfo) {
		if (!sessionKey) return;
		// Reopen existing thread — create a session for it
		await openThread(sessionKey, thread.originMessageId, thread.displayName);
	}

	async function handleArchive(e: Event, threadKey: string) {
		e.stopPropagation();
		await archiveThread(threadKey);
	}
</script>

<div class="flex flex-col gap-1 p-2">
	<div class="mb-1 text-xs font-medium text-gray-400">Threads</div>
	{#each threads as thread (thread.threadKey)}
		<div
			class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-800"
		>
			<button onclick={() => handleOpen(thread)} class="min-w-0 flex-1 text-left">
				<div class="truncate text-xs font-medium text-white">{thread.displayName}</div>
				<div class="flex items-center gap-2 text-xs text-gray-500">
					<span class={stateColor(thread.state)}>{stateLabel(thread.state)}</span>
					<span>{thread.replyCount} messages</span>
					<span>{formatTime(thread.lastActivity)}</span>
				</div>
			</button>
			{#if thread.state === 'active'}
				<button
					onclick={(e) => handleArchive(e, thread.threadKey)}
					class="text-xs text-gray-500 hover:text-gray-300"
					aria-label="Archive thread"
				>
					Archive
				</button>
			{/if}
		</div>
	{/each}
	{#if threads.length === 0}
		<div class="py-4 text-center text-xs text-gray-500">No threads yet</div>
	{/if}
</div>
