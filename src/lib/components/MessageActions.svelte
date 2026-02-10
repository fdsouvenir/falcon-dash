<script lang="ts">
	let {
		onreply
	}: {
		onreply: () => void;
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
</div>
