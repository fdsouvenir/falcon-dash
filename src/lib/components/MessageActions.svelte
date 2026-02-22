<script lang="ts">
	import { Reply, MessageSquare, Copy, Check, Smile, Star } from '@lucide/svelte';

	let {
		onreply,
		onthread,
		oncopy,
		onreact,
		onbookmark,
		bookmarked = false
	}: {
		onreply: () => void;
		onthread: () => void;
		oncopy?: () => void;
		onreact?: () => void;
		onbookmark?: () => void;
		bookmarked?: boolean;
	} = $props();

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleCopy() {
		if (oncopy) oncopy();
		copied = true;
		if (copyTimeout) clearTimeout(copyTimeout);
		copyTimeout = setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<div
	class="flex items-center gap-1 rounded border border-gray-700 bg-gray-800 px-1 py-0.5 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
>
	<button
		onclick={onreply}
		class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
		aria-label="Reply"
		title="Reply"
	>
		<Reply size={14} />
	</button>
	<button
		onclick={onthread}
		class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
		aria-label="Start thread"
		title="Start thread"
	>
		<MessageSquare size={14} />
	</button>
	{#if oncopy}
		<button
			onclick={handleCopy}
			class="rounded p-1 transition-colors {copied
				? 'text-green-400'
				: 'text-gray-400 hover:bg-gray-700 hover:text-white'}"
			aria-label={copied ? 'Copied!' : 'Copy message'}
			title={copied ? 'Copied!' : 'Copy'}
		>
			{#if copied}
				<Check size={14} />
			{:else}
				<Copy size={14} />
			{/if}
		</button>
	{/if}
	{#if onreact}
		<button
			onclick={onreact}
			class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
			aria-label="Add reaction"
			title="React"
		>
			<Smile size={14} />
		</button>
	{/if}
	{#if onbookmark}
		<button
			onclick={onbookmark}
			class="rounded p-1 transition-colors {bookmarked
				? 'text-yellow-400 hover:text-yellow-300'
				: 'text-gray-400 hover:text-yellow-400'} hover:bg-gray-700"
			aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark message'}
			title={bookmarked ? 'Unbookmark' : 'Bookmark'}
		>
			<Star size={14} fill={bookmarked ? 'currentColor' : 'none'} />
		</button>
	{/if}
</div>
