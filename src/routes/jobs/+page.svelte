<script lang="ts">
	import CronJobList from '$lib/components/CronJobList.svelte';
	import MobileCronJobList from '$lib/components/mobile/MobileCronJobList.svelte';
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
		<MobileCronJobList />
	{:else}
		<CronJobList />
	{/if}
</div>
