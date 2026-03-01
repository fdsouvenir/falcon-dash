<script lang="ts">
	import { gatewayEvents } from '$lib/gateway-api.js';

	let controlUrl = $state<string | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		const unsub = gatewayEvents.snapshot.subscribe((snap) => {
			if (snap?.server?.host) {
				try {
					// Derive control UI URL from server host info
					const url = new URL(`http://${snap.server.host}`);
					controlUrl = url.origin;
					error = null;
				} catch {
					error = 'Could not parse gateway host.';
				}
			} else {
				controlUrl = null;
				error = 'Not connected to gateway.';
			}
		});
		return unsub;
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
