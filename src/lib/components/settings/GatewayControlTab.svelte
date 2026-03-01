<script lang="ts">
	// Gateway control UI runs on localhost — always available regardless of SSE connection state.
	// Port is read from the server via a lightweight endpoint.
	let controlUrl = $state<string | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		fetch('/api/gateway/control-url')
			.then((r) => r.json())
			.then((data: { url?: string; error?: string }) => {
				if (data.url) {
					controlUrl = data.url;
				} else {
					error = data.error ?? 'Could not determine gateway URL.';
				}
			})
			.catch(() => {
				error = 'Failed to fetch gateway URL.';
			});
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
	{:else}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-sm text-gray-400">Loading...</p>
		</div>
	{/if}
</div>
