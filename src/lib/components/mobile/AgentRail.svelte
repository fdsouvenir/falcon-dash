<script lang="ts">
	import { call } from '$lib/stores/gateway.js';

	let agentName = $state('Agent');

	$effect(() => {
		call<{ name: string; description?: string }>('agent-identity')
			.then((identity) => {
				agentName = identity.name || 'Agent';
			})
			.catch(() => {
				agentName = 'Agent';
			});
	});

	let agentInitial = $derived(agentName.charAt(0).toUpperCase());
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static route -->
<div class="flex w-14 shrink-0 flex-col items-center gap-2 bg-gray-950 pb-3 pt-3">
	<!-- Active agent icon -->
	<div class="relative">
		<!-- Active pill indicator (left edge) -->
		<div class="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white"></div>
		<div
			class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white"
		>
			{agentInitial}
		</div>
	</div>

	<!-- Separator -->
	<div class="h-px w-8 bg-gray-800"></div>

	<!-- Add / settings button -->
	<a
		href="/settings"
		class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-green-500 transition-colors hover:bg-green-600 hover:text-white"
		aria-label="Settings"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
		</svg>
	</a>
</div>
