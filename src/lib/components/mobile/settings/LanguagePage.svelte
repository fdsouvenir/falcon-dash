<script lang="ts">
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
		<h1 class="text-base font-semibold text-white">Language</h1>
	</header>

	<div class="flex flex-1 flex-col items-center justify-center p-4 text-center">
		<div class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900">
			<svg
				class="h-8 w-8 text-gray-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
				/>
			</svg>
		</div>
		<p class="mt-4 text-sm font-medium text-gray-400">Coming Soon</p>
		<p class="mt-1 text-xs text-gray-600">
			Language settings will be available in a future update.
		</p>
	</div>
</div>
