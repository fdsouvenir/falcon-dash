<script lang="ts">
	import { renderMarkdownSync } from '$lib/chat/markdown.js';

	let { content = '' }: { content: string } = $props();

	let html = $derived(renderMarkdownSync(content));
</script>

<div class="markdown-content prose prose-invert max-w-none">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html html}
</div>

<style>
	.markdown-content :global(table) {
		border-collapse: collapse;
		width: 100%;
		margin: 1em 0;
	}
	.markdown-content :global(th),
	.markdown-content :global(td) {
		border: 1px solid rgb(55 65 81);
		padding: 0.5em 0.75em;
		text-align: left;
	}
	.markdown-content :global(th) {
		background: rgb(31 41 55);
		font-weight: 600;
	}
	.markdown-content :global(details) {
		border: 1px solid rgb(55 65 81);
		border-radius: 0.375rem;
		padding: 0.5em 0.75em;
		margin: 0.5em 0;
	}
	.markdown-content :global(summary) {
		cursor: pointer;
		font-weight: 500;
	}
	.markdown-content :global(hr.compaction-divider) {
		border: none;
		border-top: 2px dashed rgb(75 85 99);
		margin: 1.5em 0;
	}
	.markdown-content :global(code) {
		background: rgb(31 41 55);
		padding: 0.15em 0.35em;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}
	.markdown-content :global(pre) {
		background: rgb(17 24 39);
		padding: 1em;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin: 1em 0;
	}
	.markdown-content :global(pre code) {
		background: none;
		padding: 0;
		font-size: 0.875em;
	}
	.markdown-content :global(blockquote) {
		border-left: 3px solid rgb(75 85 99);
		padding-left: 1em;
		margin-left: 0;
		color: rgb(156 163 175);
	}
	.markdown-content :global(a) {
		color: rgb(96 165 250);
		text-decoration: underline;
	}
	.markdown-content :global(img) {
		max-width: 100%;
		border-radius: 0.5rem;
	}
	.markdown-content :global(ul) {
		list-style: disc;
		padding-left: 1.5em;
	}
	.markdown-content :global(ol) {
		list-style: decimal;
		padding-left: 1.5em;
	}
	.markdown-content :global(input[type='checkbox']) {
		margin-right: 0.5em;
	}
</style>
