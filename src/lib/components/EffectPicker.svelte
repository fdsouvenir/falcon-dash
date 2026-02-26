<script lang="ts">
	import type { SendEffect, BubbleEffect, ScreenEffect } from '$lib/stores/chat.js';

	let { onSelect, onClose }: { onSelect: (effect: SendEffect) => void; onClose: () => void } =
		$props();

	let pickerEl: HTMLDivElement;

	const BUBBLE_EFFECTS: { name: BubbleEffect; emoji: string; label: string }[] = [
		{ name: 'slam', emoji: '💥', label: 'Slam' },
		{ name: 'loud', emoji: '📢', label: 'Loud' },
		{ name: 'gentle', emoji: '🤫', label: 'Gentle' },
		{ name: 'invisible-ink', emoji: '👻', label: 'Invisible Ink' }
	];

	const SCREEN_EFFECTS: { name: ScreenEffect; emoji: string; label: string }[] = [
		{ name: 'confetti', emoji: '🎊', label: 'Confetti' },
		{ name: 'fireworks', emoji: '🎆', label: 'Fireworks' },
		{ name: 'hearts', emoji: '❤️', label: 'Hearts' },
		{ name: 'balloons', emoji: '🎈', label: 'Balloons' },
		{ name: 'celebration', emoji: '✨', label: 'Celebration' },
		{ name: 'lasers', emoji: '⚡', label: 'Lasers' },
		{ name: 'spotlight', emoji: '🔦', label: 'Spotlight' },
		{ name: 'echo', emoji: '🔊', label: 'Echo' }
	];

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
	class="absolute bottom-full right-0 z-50 mb-1 w-56 rounded-lg border border-gray-700 bg-gray-800 p-2 shadow-xl"
>
	<!-- Bubble effects -->
	<div class="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">Bubble</div>
	<div class="mb-2 grid grid-cols-2 gap-1">
		{#each BUBBLE_EFFECTS as effect (effect.name)}
			<button
				onclick={() => onSelect({ type: 'bubble', name: effect.name })}
				class="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
			>
				<span>{effect.emoji}</span>
				<span>{effect.label}</span>
			</button>
		{/each}
	</div>

	<!-- Screen effects -->
	<div class="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">Screen</div>
	<div class="grid grid-cols-2 gap-1">
		{#each SCREEN_EFFECTS as effect (effect.name)}
			<button
				onclick={() => onSelect({ type: 'screen', name: effect.name })}
				class="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
			>
				<span>{effect.emoji}</span>
				<span>{effect.label}</span>
			</button>
		{/each}
	</div>
</div>
