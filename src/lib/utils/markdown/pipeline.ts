import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { type defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { sanitizeSchema } from './sanitize-schema';
import { rehypeShikiPlugin } from './shiki-plugin';
import { rehypeMermaidPlugin } from './mermaid-plugin';
import { remarkAdmonitionPlugin } from './admonition-plugin';
import { rehypeLazyImagesPlugin } from './lazy-images-plugin';

/** Regex to detect math content: $...$, $$...$$, or \(...\), \[...\] */
const MATH_PATTERN = /\$\$[\s\S]+?\$\$|\$[^\n$]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;

/** Base processor without KaTeX (used when no math detected) */
const baseProcessor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkMath)
	.use(remarkAdmonitionPlugin)
	.use(remarkRehype)
	.use(rehypeMermaidPlugin)
	.use(rehypeShikiPlugin)
	.use(rehypeLazyImagesPlugin)
	.use(rehypeSanitize, sanitizeSchema as typeof defaultSchema)
	.use(rehypeStringify);

/** Processor with KaTeX (lazy-loaded on first math content) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mathProcessor: { processSync: (text: string) => any } | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mathProcessorPromise: Promise<{ processSync: (text: string) => any }> | null = null;

async function getMathProcessor() {
	if (mathProcessor) return mathProcessor;
	if (mathProcessorPromise) return mathProcessorPromise;
	mathProcessorPromise = import('rehype-katex').then((mod) => {
		const rehypeKatex = mod.default;
		mathProcessor = unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkMath)
			.use(remarkAdmonitionPlugin)
			.use(remarkRehype)
			.use(rehypeKatex)
			.use(rehypeMermaidPlugin)
			.use(rehypeShikiPlugin)
			.use(rehypeLazyImagesPlugin)
			.use(rehypeSanitize, sanitizeSchema as typeof defaultSchema)
			.use(rehypeStringify);
		return mathProcessor;
	});
	return mathProcessorPromise;
}

/**
 * Render a markdown string to sanitized HTML.
 * Uses the base processor for non-math content and lazy-loads KaTeX when needed.
 */
export function renderMarkdown(text: string): string {
	if (!text) return '';
	// If math content is detected and KaTeX is already loaded, use math processor
	if (MATH_PATTERN.test(text) && mathProcessor) {
		const file = mathProcessor.processSync(text);
		return String(file);
	}
	const file = baseProcessor.processSync(text);
	return String(file);
}

/**
 * Render markdown with math support (async).
 * Lazy-loads KaTeX on first call with math content.
 */
export async function renderMarkdownAsync(text: string): Promise<string> {
	if (!text) return '';
	if (MATH_PATTERN.test(text)) {
		const proc = await getMathProcessor();
		const file = proc.processSync(text);
		return String(file);
	}
	const file = baseProcessor.processSync(text);
	return String(file);
}
