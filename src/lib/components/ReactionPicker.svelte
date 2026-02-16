<script lang="ts">
	let { onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void } = $props();

	const emojis = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉', '🤔', '👀', '🙏'];

	let pickerEl: HTMLDivElement;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (pickerEl && !pickerEl.contains(e.target as Node)) {
			onClose();
		}
	}

	$effect(() => {
		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div
	bind:this={pickerEl}
	class="absolute bottom-full mb-1 rounded-lg border border-gray-700 bg-gray-800 p-2 shadow-xl"
>
	<div class="grid grid-cols-4 gap-1">
		{#each emojis as emoji}
			<button
				onclick={() => onSelect(emoji)}
				class="rounded p-1.5 text-lg transition-colors hover:bg-gray-700"
			>
				{emoji}
			</button>
		{/each}
	</div>
</div>
