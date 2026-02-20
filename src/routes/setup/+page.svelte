<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { gatewayUrl } from '$lib/stores/token.js';

	let message = $state('Redirecting to gateway setup…');

	onMount(() => {
		const wsUrl = get(gatewayUrl);
		try {
			const httpUrl = wsUrl.replace(/^ws(s?)/, 'http$1');
			const url = new URL(httpUrl);
			window.location.href = url.origin;
		} catch {
			message = 'No gateway URL configured. Connect to a gateway first.';
		}
	});
</script>

<div class="flex h-screen items-center justify-center bg-gray-950">
	<p class="text-sm text-gray-400">{message}</p>
</div>
