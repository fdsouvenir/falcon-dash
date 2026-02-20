<script lang="ts">
	import { onMount } from 'svelte';

	let { code = '' }: { code: string } = $props();
	let rendered = $state('');
	let error = $state('');

	onMount(async () => {
		try {
			const mermaid = (await import('mermaid')).default;
			mermaid.initialize({
				startOnLoad: false,
				theme: 'dark',
				securityLevel: 'strict'
			});
			const id = `mermaid-${crypto.randomUUID().slice(0, 8)}`;
			const { svg } = await mermaid.render(id, code);
			rendered = svg;
		} catch (e) {
			error = `Diagram error: ${(e as Error).message}`;
		}
	});
</script>

{#if error}
	<div class="rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">
		<p class="font-mono">{error}</p>
		<pre class="mt-2 overflow-x-auto text-xs text-gray-400">{code}</pre>
	</div>
{:else if rendered}
	<div class="my-4 flex min-h-[200px] items-center justify-center">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html rendered}
	</div>
{:else}
	<div class="my-4 flex min-h-[200px] items-center justify-center">
		<div class="animate-pulse text-sm text-gray-500">Loading diagram...</div>
	</div>
{/if}
