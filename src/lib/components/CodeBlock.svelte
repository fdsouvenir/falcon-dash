<script lang="ts">
	import { highlightCode } from '$lib/utils/highlighter.js';

	let { code = '', lang = '' }: { code: string; lang: string } = $props();

	let html = $state('');
	let copied = $state(false);

	$effect(() => {
		highlightCode(code, lang).then((result) => {
			html = result;
		});
	});

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// Clipboard API not available
		}
	}
</script>

<div class="group relative my-3 rounded-lg border border-gray-700 bg-gray-900">
	<!-- Header with language label and copy button -->
	<div class="flex items-center justify-between border-b border-gray-700 px-4 py-1.5">
		<span class="text-xs font-medium text-gray-400">{lang || 'text'}</span>
		<button
			onclick={copyToClipboard}
			class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
			aria-label="Copy code"
		>
			{copied ? 'Copied!' : 'Copy'}
		</button>
	</div>
	<!-- Code content -->
	<div class="overflow-x-auto p-4 text-sm">
		{#if html}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html html}
		{:else}
			<pre><code>{code}</code></pre>
		{/if}
	</div>
</div>

<style>
	div :global(pre) {
		margin: 0;
		background: transparent !important;
		padding: 0;
	}
	div :global(code) {
		background: transparent;
		padding: 0;
		font-size: 0.875rem;
	}
</style>
