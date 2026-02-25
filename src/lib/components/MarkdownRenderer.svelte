<script lang="ts">
	import { renderMarkdownSync } from '$lib/chat/markdown.js';
	import MermaidDiagram from './MermaidDiagram.svelte';
	import CodeBlock from './CodeBlock.svelte';

	let { content = '', isStreaming = false }: { content: string; isStreaming?: boolean } = $props();

	/**
	 * Close unclosed markdown fences and inline markers during streaming
	 * so partial content renders correctly.
	 */
	function streamSanitize(text: string): string {
		// Count triple-backtick fences — if odd, close with a newline + ```
		const fenceMatches = text.match(/```/g);
		if (fenceMatches && fenceMatches.length % 2 !== 0) {
			text += '\n```';
		}

		// Close unclosed bold ** markers (only full pairs count as closed)
		const boldMatches = text.match(/\*\*/g);
		if (boldMatches && boldMatches.length % 2 !== 0) {
			text += '**';
		}

		// Close unclosed italic * markers (exclude ** which are bold)
		const stripped = text.replace(/\*\*/g, '');
		const italicMatches = stripped.match(/\*/g);
		if (italicMatches && italicMatches.length % 2 !== 0) {
			text += '*';
		}

		return text;
	}

	// Throttled content for rendering: ~60ms via rAF during streaming, immediate on completion
	let renderedContent = $state(content);
	let rafId: number | null = null;
	let pendingContent: string | null = null;

	$effect(() => {
		const current = content;
		const streaming = isStreaming;

		if (!streaming) {
			// Immediate render on completion
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			pendingContent = null;
			renderedContent = current;
			return;
		}

		// During streaming, throttle via rAF (~16ms, but effectively batches rapid updates)
		pendingContent = current;
		if (rafId === null) {
			rafId = requestAnimationFrame(() => {
				rafId = null;
				if (pendingContent !== null) {
					renderedContent = pendingContent;
					pendingContent = null;
				}
			});
		}
	});

	// Sanitize content for display during streaming
	let displayContent = $derived(isStreaming ? streamSanitize(renderedContent) : renderedContent);

	// Split content into segments: markdown text, mermaid blocks, and code blocks
	interface BaseSegment {
		id: string;
	}

	interface MarkdownSegment extends BaseSegment {
		type: 'markdown';
		content: string;
	}

	interface MermaidSegment extends BaseSegment {
		type: 'mermaid';
		content: string;
	}

	interface CodeSegment extends BaseSegment {
		type: 'code';
		content: string;
		lang: string;
	}

	type Segment = MarkdownSegment | MermaidSegment | CodeSegment;

	let segments = $derived.by(() => {
		const result: Segment[] = [];
		// Match all fenced code blocks (mermaid and regular)
		const regex = /```(\w*)\n([\s\S]*?)```/g;
		let lastIndex = 0;
		let match;
		let segmentIndex = 0;

		while ((match = regex.exec(displayContent)) !== null) {
			// Add markdown before code block
			if (match.index > lastIndex) {
				const markdownContent = displayContent.slice(lastIndex, match.index);
				result.push({
					type: 'markdown',
					content: markdownContent,
					id: `segment-${segmentIndex++}`
				});
			}
			// Add code block (mermaid or regular)
			const lang = match[1] || 'text';
			if (lang === 'mermaid') {
				result.push({
					type: 'mermaid',
					content: match[2].trim(),
					id: `segment-${segmentIndex++}`
				});
			} else {
				result.push({
					type: 'code',
					content: match[2].trim(),
					lang: lang,
					id: `segment-${segmentIndex++}`
				});
			}
			lastIndex = match.index + match[0].length;
		}

		// Add remaining markdown
		if (lastIndex < displayContent.length) {
			result.push({
				type: 'markdown',
				content: displayContent.slice(lastIndex),
				id: `segment-${segmentIndex++}`
			});
		}

		if (result.length === 0) {
			result.push({ type: 'markdown', content: displayContent, id: `segment-${segmentIndex}` });
		}

		return result;
	});

	// Pre-process markdown to handle admonitions
	function preprocessMarkdown(markdown: string): string {
		// Convert GFM admonitions to HTML divs
		return markdown.replace(
			/^>\s*\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*\n((?:>.*\n?)*)/gm,
			(_, type, body) => {
				const text = body.replace(/^>\s?/gm, '').trim();
				return `<div class="admonition" data-type="${type}">\n\n${text}\n\n</div>`;
			}
		);
	}
</script>

<div class="markdown-content prose prose-invert prose-sm max-w-none break-words">
	{#each segments as segment (segment.id)}
		{#if segment.type === 'mermaid'}
			{#if isStreaming}
				<pre class="rounded-lg bg-gray-900 p-4"><code>{segment.content}</code></pre>
			{:else}
				<MermaidDiagram code={segment.content} />
			{/if}
		{:else if segment.type === 'code'}
			<CodeBlock code={segment.content} lang={segment.lang} />
		{:else}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html renderMarkdownSync(preprocessMarkdown(segment.content))}
		{/if}
	{/each}
	{#if isStreaming}
		<span class="streaming-cursor">▌</span>
	{/if}
</div>

<style>
	.streaming-cursor {
		display: inline;
		color: rgb(156 163 175);
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

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
	/* Admonition styles */
	.markdown-content :global(.admonition[data-type='NOTE']) {
		border-left: 4px solid rgb(37 99 235);
		background: rgb(23 37 84);
		padding: 1rem;
		border-radius: 0.5rem;
		margin: 0.75rem 0;
	}
	.markdown-content :global(.admonition[data-type='TIP']) {
		border-left: 4px solid rgb(22 163 74);
		background: rgb(20 83 45);
		padding: 1rem;
		border-radius: 0.5rem;
		margin: 0.75rem 0;
	}
	.markdown-content :global(.admonition[data-type='WARNING']) {
		border-left: 4px solid rgb(202 138 4);
		background: rgb(66 56 18);
		padding: 1rem;
		border-radius: 0.5rem;
		margin: 0.75rem 0;
	}
	.markdown-content :global(.admonition[data-type='CAUTION']) {
		border-left: 4px solid rgb(220 38 38);
		background: rgb(69 10 10);
		padding: 1rem;
		border-radius: 0.5rem;
		margin: 0.75rem 0;
	}
	.markdown-content :global(.admonition[data-type='IMPORTANT']) {
		border-left: 4px solid rgb(147 51 234);
		background: rgb(59 7 100);
		padding: 1rem;
		border-radius: 0.5rem;
		margin: 0.75rem 0;
	}
</style>
