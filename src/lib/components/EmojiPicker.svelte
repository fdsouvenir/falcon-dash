<script lang="ts">
	let {
		onselect,
		onclose
	}: {
		onselect: (emoji: string) => void;
		onclose: () => void;
	} = $props();

	const quickEmojis = ['👍', '👎', '❤️', '😂', '🎉', '🤔', '👀', '🔥', '✅', '❌', '💯', '🙏'];

	function handleSelect(emoji: string) {
		onselect(emoji);
		onclose();
	}

	function handleBackdropClick() {
		onclose();
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" onclick={handleBackdropClick} onkeydown={() => {}}></div>

<!-- Picker -->
<div
	class="absolute bottom-full right-0 z-50 mb-1 grid grid-cols-6 gap-1 rounded-lg border border-gray-700 bg-gray-800 p-2 shadow-xl"
>
	{#each quickEmojis as emoji (emoji)}
		<button
			onclick={() => handleSelect(emoji)}
			class="rounded p-1 text-lg transition-colors hover:bg-gray-700"
			aria-label="React with {emoji}"
		>
			{emoji}
		</button>
	{/each}
</div>
