<script lang="ts">
	import { Sparkles } from 'lucide-svelte';

	let { suggestions, onselect }: { suggestions: string[]; onselect: (text: string) => void } =
		$props();

	let visible = $state(false);

	$effect(() => {
		if (suggestions.length > 0) {
			// Trigger fade-in on next frame
			const id = requestAnimationFrame(() => {
				visible = true;
			});
			return () => {
				cancelAnimationFrame(id);
				visible = false;
			};
		} else {
			visible = false;
		}
	});
</script>

{#if suggestions.length > 0}
	<div
		class="flex items-center gap-2 overflow-x-auto px-1 py-2 transition-all duration-500 ease-out scrollbar-none"
		class:opacity-0={!visible}
		class:translate-y-2={!visible}
		class:opacity-100={visible}
		class:translate-y-0={visible}
	>
		<Sparkles class="h-3.5 w-3.5 shrink-0 text-gray-500" />
		{#each suggestions as suggestion, i (suggestion)}
			<button
				onclick={() => onselect(suggestion)}
				class="shrink-0 rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-xs text-gray-300 transition-all duration-200 hover:border-gray-600 hover:bg-gray-700 hover:text-white active:scale-95"
				style="transition-delay: {i * 50}ms"
			>
				{suggestion}
			</button>
		{/each}
	</div>
{/if}

<style>
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
</style>
