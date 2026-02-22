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
		<h1 class="text-base font-semibold text-white">Tools</h1>
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
					d="M11.42 15.17l-5.384 5.383a2.1 2.1 0 01-2.97-2.97l5.383-5.383m5.37-5.37l3.992-3.992a2.1 2.1 0 012.97 2.97l-3.992 3.992m-5.37-5.37l5.37 5.37M7.5 21L3 16.5m0 0L7.5 12m-4.5 4.5h9"
				/>
			</svg>
		</div>
		<p class="mt-4 text-sm font-medium text-gray-400">Coming Soon</p>
		<p class="mt-1 text-xs text-gray-600">
			Tools configuration will be available in a future update.
		</p>
	</div>
</div>
