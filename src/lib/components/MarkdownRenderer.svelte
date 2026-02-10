<script lang="ts">
	import { renderMarkdownSync } from '$lib/chat/markdown.js';
	import MermaidDiagram from './MermaidDiagram.svelte';
	import CodeBlock from './CodeBlock.svelte';

	let { content = '' }: { content: string } = $props();

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

		while ((match = regex.exec(content)) !== null) {
			// Add markdown before code block
			if (match.index > lastIndex) {
				const markdownContent = content.slice(lastIndex, match.index);
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
		if (lastIndex < content.length) {
			result.push({
				type: 'markdown',
				content: content.slice(lastIndex),
				id: `segment-${segmentIndex++}`
			});
		}

		if (result.length === 0) {
			result.push({ type: 'markdown', content, id: `segment-${segmentIndex++}` });
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

<svelte:head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
</svelte:head>

<div class="markdown-content prose prose-invert max-w-none">
	{#each segments as segment (segment.id)}
		{#if segment.type === 'mermaid'}
			<MermaidDiagram code={segment.content} />
		{:else if segment.type === 'code'}
			<CodeBlock code={segment.content} lang={segment.lang} />
		{:else}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html renderMarkdownSync(preprocessMarkdown(segment.content))}
		{/if}
	{/each}
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
