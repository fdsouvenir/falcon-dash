import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { type defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { sanitizeSchema } from './sanitize-schema';

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype)
	.use(rehypeSanitize, sanitizeSchema as typeof defaultSchema)
	.use(rehypeStringify);

/**
 * Render a markdown string to sanitized HTML.
 * Synchronous — unified's processSync works because all plugins are sync.
 */
export function renderMarkdown(text: string): string {
	if (!text) return '';
	const file = processor.processSync(text);
	return String(file);
}
