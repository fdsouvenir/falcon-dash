<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { renderMarkdown, renderMarkdownAsync } from '$lib/utils/markdown';
	import { highlighterManager } from '$lib/utils/markdown/highlighter';
	import { codeBlockActions } from '$lib/actions/codeBlockActions';
	import { mermaidAction } from '$lib/actions/mermaidAction';

	interface Props {
		content: string;
		isStreaming: boolean;
	}

	let { content, isStreaming }: Props = $props();

	let renderedHtml = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let highlighterReady = $state(highlighterManager.isReady());

	/** Regex to detect math content */
	const MATH_RE = /\$\$[\s\S]+?\$\$|\$[^\n$]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;

	function doRender(text: string) {
		renderedHtml = renderMarkdown(text);
		// If content has math and KaTeX isn't loaded yet, trigger async render
		if (MATH_RE.test(text)) {
			renderMarkdownAsync(text).then((html) => {
				renderedHtml = html;
			});
		}
	}

	$effect(() => {
		if (content || highlighterReady) {
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
	});

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
		content-visibility: auto;
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

	/* Admonition styles (US-032) */
	.rendered-content :global(.admonition) {
		margin-top: 0.75em;
		margin-bottom: 0.75em;
		border-radius: 0.375rem;
		border: 1px solid;
		overflow: hidden;
	}

	.rendered-content :global(.admonition-title) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-weight: 600;
		font-size: 0.85rem;
	}

	.rendered-content :global(.admonition-title::before) {
		display: inline-block;
		width: 1em;
		height: 1em;
		flex-shrink: 0;
	}

	.rendered-content :global(.admonition-content) {
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}

	.rendered-content :global(.admonition-content > :first-child) {
		margin-top: 0;
	}

	.rendered-content :global(.admonition-content > :last-child) {
		margin-bottom: 0;
	}

	/* NOTE — blue */
	.rendered-content :global(.admonition-note) {
		border-color: rgb(59 130 246 / 0.4);
		background-color: rgb(59 130 246 / 0.08);
	}

	.rendered-content :global(.admonition-note .admonition-title) {
		color: rgb(96 165 250); /* blue-400 */
	}

	.rendered-content :global(.admonition-note .admonition-title::before) {
		content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='%2360a5fa'%3E%3Cpath d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E");
	}

	/* TIP — green */
	.rendered-content :global(.admonition-tip) {
		border-color: rgb(34 197 94 / 0.4);
		background-color: rgb(34 197 94 / 0.08);
	}

	.rendered-content :global(.admonition-tip .admonition-title) {
		color: rgb(74 222 128); /* green-400 */
	}

	.rendered-content :global(.admonition-tip .admonition-title::before) {
		content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='%234ade80'%3E%3Cpath d='M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z'/%3E%3C/svg%3E");
	}

	/* WARNING — amber */
	.rendered-content :global(.admonition-warning) {
		border-color: rgb(245 158 11 / 0.4);
		background-color: rgb(245 158 11 / 0.08);
	}

	.rendered-content :global(.admonition-warning .admonition-title) {
		color: rgb(251 191 36); /* amber-400 */
	}

	.rendered-content :global(.admonition-warning .admonition-title::before) {
		content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='%23fbbf24'%3E%3Cpath d='M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E");
	}

	/* CAUTION — red */
	.rendered-content :global(.admonition-caution) {
		border-color: rgb(239 68 68 / 0.4);
		background-color: rgb(239 68 68 / 0.08);
	}

	.rendered-content :global(.admonition-caution .admonition-title) {
		color: rgb(248 113 113); /* red-400 */
	}

	.rendered-content :global(.admonition-caution .admonition-title::before) {
		content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='%23f87171'%3E%3Cpath d='M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'/%3E%3C/svg%3E");
	}

	/* IMPORTANT — purple */
	.rendered-content :global(.admonition-important) {
		border-color: rgb(168 85 247 / 0.4);
		background-color: rgb(168 85 247 / 0.08);
	}

	.rendered-content :global(.admonition-important .admonition-title) {
		color: rgb(192 132 252); /* purple-400 */
	}

	.rendered-content :global(.admonition-important .admonition-title::before) {
		content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='%23c084fc'%3E%3Cpath d='M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'/%3E%3C/svg%3E");
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
