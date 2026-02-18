<script lang="ts">
	import SettingsPage from '$lib/components/settings/SettingsPage.svelte';
	import MobileSettingsPage from '$lib/components/mobile/MobileSettingsPage.svelte';
	import { isMobile } from '$lib/stores/viewport.js';

	let mobile = $state(false);
	$effect(() => {
		const unsub = isMobile.subscribe((v) => {
			mobile = v;
		});
		return unsub;
	});
</script>

<div class="h-full">
	{#if mobile}
		<MobileSettingsPage />
	{:else}
		<SettingsPage />
	{/if}
</div>
