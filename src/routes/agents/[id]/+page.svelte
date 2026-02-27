<script lang="ts">
	import { page } from '$app/state';

	let agentId = $derived(page.params.id);
</script>

<div class="flex flex-col gap-5 p-4 sm:p-6">
	<div>
		<h1 class="text-lg font-semibold text-white">Agent: {agentId}</h1>
		<p class="text-sm text-gray-400">Agent configuration and management (coming soon)</p>
	</div>

	<div
		class="rounded-lg border border-gray-700/40 border-dashed bg-gray-800/20 px-4 py-12 text-center"
	>
		<p class="text-sm text-gray-500">Agent detail page will be built in Phase 3</p>
	</div>
</div>
