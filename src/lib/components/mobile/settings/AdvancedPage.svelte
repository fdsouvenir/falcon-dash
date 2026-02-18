<script lang="ts">
	import InformationTab from '$lib/components/settings/InformationTab.svelte';
	import DeviceManagement from '$lib/components/settings/DeviceManagement.svelte';
	import WorkspaceFiles from '$lib/components/settings/WorkspaceFiles.svelte';
	import CanvasDiagnosticsTab from '$lib/components/settings/CanvasDiagnosticsTab.svelte';

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
		<h1 class="text-base font-semibold text-white">Advanced</h1>
	</header>

	<div class="flex-1 overflow-y-auto p-4">
		<div class="space-y-6">
			<section>
				<h2 class="mb-3 text-sm font-semibold text-gray-400">Gateway</h2>
				<InformationTab />
			</section>
			<section>
				<h2 class="mb-3 text-sm font-semibold text-gray-400">Devices</h2>
				<DeviceManagement />
			</section>
			<section>
				<h2 class="mb-3 text-sm font-semibold text-gray-400">Workspace Files</h2>
				<WorkspaceFiles />
			</section>
			<section>
				<h2 class="mb-3 text-sm font-semibold text-gray-400">Canvas Diagnostics</h2>
				<CanvasDiagnosticsTab />
			</section>
		</div>
	</div>
</div>
