<script lang="ts">
	import DiscordSetup from '$lib/components/settings/DiscordSetup.svelte';

	let { onback }: { onback: () => void } = $props();

	let activeChannel = $state<string | null>(null);
</script>

<div class="flex h-full flex-col bg-gray-950">
	<header class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
		<button
			onclick={activeChannel ? () => (activeChannel = null) : onback}
			class="flex min-h-[44px] min-w-[44px] items-center justify-center"
		>
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
		<h1 class="text-base font-semibold text-white">
			{activeChannel ? activeChannel.charAt(0).toUpperCase() + activeChannel.slice(1) : 'Channels'}
		</h1>
	</header>

	<div class="flex-1 overflow-y-auto p-4">
		{#if activeChannel === 'discord'}
			<DiscordSetup />
		{:else}
			<div class="grid grid-cols-2 gap-3">
				<button
					onclick={() => (activeChannel = 'discord')}
					class="flex flex-col items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 p-4 active:bg-gray-800"
				>
					<div class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-900/50">
						<svg class="h-6 w-6 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
							<path
								d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"
							/>
						</svg>
					</div>
					<span class="text-sm font-medium text-white">Discord</span>
				</button>

				{#each ['WhatsApp', 'Telegram', 'Slack'] as channel (channel)}
					<div
						class="flex flex-col items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 p-4 opacity-50"
					>
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800">
							<svg
								class="h-6 w-6 text-gray-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
								/>
							</svg>
						</div>
						<span class="text-sm font-medium text-gray-400">{channel}</span>
						<span class="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-500">Coming Soon</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
