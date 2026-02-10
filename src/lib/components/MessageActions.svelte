<script lang="ts">
	let {
		onreply,
		onthread
	}: {
		onreply: () => void;
		onthread: () => void;
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
</div>
