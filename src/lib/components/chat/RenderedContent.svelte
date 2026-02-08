<script lang="ts">
	import { onDestroy } from 'svelte';
	import { renderMarkdown } from '$lib/utils/markdown';

	export let content: string;
	export let isStreaming: boolean;

	let renderedHtml = '';
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	function doRender(text: string) {
		renderedHtml = renderMarkdown(text);
	}

	$: if (content) {
		if (isStreaming) {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				doRender(content);
			}, 50);
		} else {
			clearTimeout(debounceTimer);
			doRender(content);
		}
	}

	onDestroy(() => clearTimeout(debounceTimer));
</script>

<div class="rendered-content">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html renderedHtml}
</div>

<style>
	/* Prose styling for rendered markdown — dark slate theme */
	.rendered-content {
		font-size: 0.875rem;
		line-height: 1.625;
		color: rgb(226 232 240); /* slate-200 */
	}

	.rendered-content :global(h1),
	.rendered-content :global(h2),
	.rendered-content :global(h3),
	.rendered-content :global(h4),
	.rendered-content :global(h5),
	.rendered-content :global(h6) {
		color: rgb(241 245 249); /* slate-100 */
		font-weight: 600;
		margin-top: 1.25em;
		margin-bottom: 0.5em;
		line-height: 1.3;
	}

	.rendered-content :global(h1) {
		font-size: 1.5em;
	}
	.rendered-content :global(h2) {
		font-size: 1.25em;
	}
	.rendered-content :global(h3) {
		font-size: 1.1em;
	}

	.rendered-content :global(p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	.rendered-content :global(a) {
		color: rgb(96 165 250); /* blue-400 */
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.rendered-content :global(a:hover) {
		color: rgb(147 197 253); /* blue-300 */
	}

	.rendered-content :global(strong) {
		color: rgb(241 245 249); /* slate-100 */
		font-weight: 600;
	}

	.rendered-content :global(code) {
		background-color: rgb(30 41 59); /* slate-800 */
		color: rgb(248 113 113); /* red-400 */
		padding: 0.125em 0.375em;
		border-radius: 0.25rem;
		font-size: 0.85em;
	}

	.rendered-content :global(pre) {
		background-color: rgb(15 23 42); /* slate-900 */
		border: 1px solid rgb(51 65 85); /* slate-700 */
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		margin-top: 0.75em;
		margin-bottom: 0.75em;
	}

	.rendered-content :global(pre code) {
		background-color: transparent;
		color: rgb(226 232 240); /* slate-200 */
		padding: 0;
		border-radius: 0;
		font-size: 0.85em;
	}

	.rendered-content :global(blockquote) {
		border-left: 3px solid rgb(71 85 105); /* slate-600 */
		padding-left: 1em;
		color: rgb(148 163 184); /* slate-400 */
		margin-top: 0.75em;
		margin-bottom: 0.75em;
	}

	.rendered-content :global(ul),
	.rendered-content :global(ol) {
		padding-left: 1.5em;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	.rendered-content :global(ul) {
		list-style-type: disc;
	}

	.rendered-content :global(ol) {
		list-style-type: decimal;
	}

	.rendered-content :global(li) {
		margin-top: 0.25em;
		margin-bottom: 0.25em;
	}

	.rendered-content :global(li > ul),
	.rendered-content :global(li > ol) {
		margin-top: 0.125em;
		margin-bottom: 0.125em;
	}

	.rendered-content :global(hr) {
		border: none;
		border-top: 1px solid rgb(51 65 85); /* slate-700 */
		margin-top: 1.5em;
		margin-bottom: 1.5em;
	}

	.rendered-content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.75em;
		margin-bottom: 0.75em;
	}

	.rendered-content :global(th),
	.rendered-content :global(td) {
		border: 1px solid rgb(51 65 85); /* slate-700 */
		padding: 0.375rem 0.75rem;
		text-align: left;
	}

	.rendered-content :global(th) {
		background-color: rgb(30 41 59); /* slate-800 */
		color: rgb(241 245 249); /* slate-100 */
		font-weight: 600;
	}

	.rendered-content :global(img) {
		max-width: 100%;
		border-radius: 0.375rem;
	}

	.rendered-content :global(input[type='checkbox']) {
		margin-right: 0.5em;
	}

	/* Remove margin from first/last children for tight layout */
	.rendered-content :global(> :first-child) {
		margin-top: 0;
	}
	.rendered-content :global(> :last-child) {
		margin-bottom: 0;
	}
</style>
