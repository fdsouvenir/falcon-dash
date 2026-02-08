<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { highlighterManager } from '$lib/utils/markdown/highlighter';
	import { codeBlockActions } from '$lib/actions/codeBlockActions';
	import { mermaidAction } from '$lib/actions/mermaidAction';

	export let content: string;
	export let isStreaming: boolean;

	let renderedHtml = '';
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let highlighterReady = highlighterManager.isReady();

	function doRender(text: string) {
		renderedHtml = renderMarkdown(text);
	}

	$: if (content || highlighterReady) {
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

	onMount(() => {
		if (!highlighterManager.isReady()) {
			highlighterManager.init().then(() => {
				highlighterReady = true;
			});
		}
	});

	onDestroy(() => clearTimeout(debounceTimer));
</script>

<div class="rendered-content" use:codeBlockActions use:mermaidAction>
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

	/* Code block wrapper with header */
	.rendered-content :global(.code-block-wrapper) {
		margin-top: 0.75em;
		margin-bottom: 0.75em;
		border: 1px solid rgb(51 65 85); /* slate-700 */
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.rendered-content :global(.code-block-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.75rem;
		background-color: rgb(30 41 59); /* slate-800 */
		border-bottom: 1px solid rgb(51 65 85); /* slate-700 */
	}

	.rendered-content :global(.code-block-lang) {
		font-size: 0.75rem;
		color: rgb(148 163 184); /* slate-400 */
		text-transform: lowercase;
	}

	.rendered-content :global(.code-block-copy) {
		font-size: 0.75rem;
		color: rgb(148 163 184); /* slate-400 */
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		transition:
			color 150ms,
			background-color 150ms;
	}

	.rendered-content :global(.code-block-copy:hover) {
		color: rgb(226 232 240); /* slate-200 */
		background-color: rgb(51 65 85); /* slate-700 */
	}

	.rendered-content :global(pre) {
		background-color: rgb(15 23 42); /* slate-900 */
		border-radius: 0;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		margin: 0;
	}

	/* Standalone pre (not inside code-block-wrapper) */
	.rendered-content :global(pre:not(.code-block-wrapper pre)) {
		border: 1px solid rgb(51 65 85); /* slate-700 */
		border-radius: 0.5rem;
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

	/* Shiki highlighted code — override inline color for tokens */
	.rendered-content :global(.shiki) {
		background-color: rgb(15 23 42) !important; /* slate-900, override Shiki theme bg */
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

	/* Mermaid diagram styles (US-031) */
	.rendered-content :global(.mermaid-placeholder) {
		margin-top: 0.75em;
		margin-bottom: 0.75em;
		border: 1px solid rgb(51 65 85); /* slate-700 */
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.rendered-content :global(.mermaid-loading) {
		padding: 1rem;
		color: rgb(148 163 184); /* slate-400 */
		font-size: 0.85rem;
		text-align: center;
	}

	.rendered-content :global(.mermaid-diagram) {
		display: flex;
		justify-content: center;
		padding: 1rem;
		background-color: rgb(15 23 42); /* slate-900 */
	}

	.rendered-content :global(.mermaid-diagram svg) {
		max-width: 100%;
		height: auto;
	}

	.rendered-content :global(.mermaid-error) {
		padding: 0.5rem 0.75rem;
		color: rgb(248 113 113); /* red-400 */
		background-color: rgba(248, 113, 113, 0.1);
		font-size: 0.75rem;
		border-bottom: 1px solid rgb(51 65 85); /* slate-700 */
	}

	.rendered-content :global(.mermaid-fallback) {
		margin: 0 !important;
		border: none !important;
		border-radius: 0 !important;
	}
</style>
