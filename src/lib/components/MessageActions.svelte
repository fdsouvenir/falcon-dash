<script lang="ts">
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
</script>

<div
	class="flex items-center gap-1 rounded border border-gray-700 bg-gray-800 px-1 py-0.5 shadow-lg"
>
	<button
		onclick={onreply}
		class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
		aria-label="Reply"
		title="Reply"
	>
		<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
			/>
		</svg>
	</button>
	<button
		onclick={onthread}
		class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
		aria-label="Start thread"
		title="Start thread"
	>
		<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
			/>
		</svg>
	</button>
	{#if oncopy}
		<button
			onclick={oncopy}
			class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
			aria-label="Copy message"
			title="Copy"
		>
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
				/>
			</svg>
		</button>
	{/if}
	{#if onreact}
		<button
			onclick={onreact}
			class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
			aria-label="Add reaction"
			title="React"
		>
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
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
			<svg
				class="h-3.5 w-3.5"
				viewBox="0 0 24 24"
				fill={bookmarked ? 'currentColor' : 'none'}
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
				/>
			</svg>
		</button>
	{/if}
</div>
