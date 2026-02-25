<script lang="ts">
	import { get } from 'svelte/store';
	import { gatewayUrl } from '$lib/stores/token.js';

	let controlUrl = $state<string | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		const wsUrl = get(gatewayUrl);
		try {
			const httpUrl = wsUrl.replace(/^ws(s?)/, 'http$1');
			const url = new URL(httpUrl);
			controlUrl = url.origin;
		} catch {
			error = 'No gateway URL configured. Connect to a gateway first.';
		}
	});
</script>

<div class="flex h-full flex-col">
	{#if error}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-sm text-gray-400">{error}</p>
		</div>
	{:else if controlUrl}
		<iframe
			src={controlUrl}
			title="Gateway Control UI"
			class="h-full w-full flex-1 border-0"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
		></iframe>
	{/if}
</div>
