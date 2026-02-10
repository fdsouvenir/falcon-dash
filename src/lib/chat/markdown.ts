import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

// Extend sanitize schema to allow details/summary and other needed elements
const sanitizeSchema = {
	...defaultSchema,
	tagNames: [...(defaultSchema.tagNames ?? []), 'details', 'summary', 'hr'],
	attributes: {
		...defaultSchema.attributes,
		details: ['open'],
		'*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'class']
	}
};

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypeRaw)
	.use(rehypeSanitize, sanitizeSchema)
	.use(rehypeStringify);

/**
 * Render markdown to sanitized HTML.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
	// Handle compaction divider (--- with specific context) as visual separator
	const processed = markdown.replace(/^-{3,}\s*$/gm, '<hr class="compaction-divider" />');
	const result = await processor.process(processed);
	return String(result);
}

/**
 * Synchronous render (for use in reactive contexts).
 * Uses processSync which may be slightly less efficient but avoids async.
 */
export function renderMarkdownSync(markdown: string): string {
	const processed = markdown.replace(/^-{3,}\s*$/gm, '<hr class="compaction-divider" />');
	const result = processor.processSync(processed);
	return String(result);
}
