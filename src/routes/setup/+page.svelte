<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- static path, no route params
		goto('/settings', { replaceState: true });
	});
</script>

<div class="flex h-screen items-center justify-center bg-gray-950">
	<p class="text-sm text-gray-400">Redirecting to settings…</p>
</div>
