<script lang="ts">
	import AgentsTab from '$lib/components/settings/AgentsTab.svelte';
	import { addToast } from '$lib/stores/toast.js';

	let { onback }: { onback: () => void } = $props();
</script>

<div class="flex h-full flex-col bg-gray-950">
	<header class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
		<button onclick={onback} class="flex min-h-[44px] min-w-[44px] items-center justify-center">
			<svg
				class="h-5 w-5 text-gray-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<h1 class="flex-1 text-base font-semibold text-white">Agents</h1>
		<button
			onclick={() => addToast('Multi-agent support coming soon', 'info')}
			class="flex min-h-[44px] min-w-[44px] items-center justify-center"
			aria-label="Add agent"
		>
			<svg
				class="h-5 w-5 text-gray-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</header>

	<div class="flex-1 overflow-y-auto">
		<AgentsTab />
	</div>
</div>
