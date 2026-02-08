<script lang="ts">
	export let content: string;

	let copied = false;
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(content);
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// Clipboard API may fail in insecure contexts
		}
	}
</script>

<div
	class="flex items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
>
	<button
		class="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-600 hover:text-slate-200 md:min-h-0 md:min-w-0 md:px-1.5 md:py-0.5"
		on:click={handleCopy}
		aria-label="Copy message"
	>
		{#if copied}
			<svg
				class="h-4 w-4 md:h-3.5 md:w-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
			<span>Copied!</span>
		{:else}
			<svg
				class="h-4 w-4 md:h-3.5 md:w-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
			</svg>
			<span>Copy</span>
		{/if}
	</button>
</div>
