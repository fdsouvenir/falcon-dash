<script lang="ts">
	import DocumentBrowser from '$lib/components/DocumentBrowser.svelte';
	import MobileDocumentBrowser from '$lib/components/mobile/MobileDocumentBrowser.svelte';
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
		<MobileDocumentBrowser />
	{:else}
		<DocumentBrowser />
	{/if}
</div>
