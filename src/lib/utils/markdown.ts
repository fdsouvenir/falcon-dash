import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

// Extend sanitize schema to allow details/summary and other needed elements
const sanitizeSchema = {
	...defaultSchema,
	tagNames: [
		...(defaultSchema.tagNames ?? []),
		'details',
		'summary',
		'hr',
		'span',
		'div',
		'math',
		'semantics',
		'mrow',
		'mi',
		'mo',
		'mn',
		'msup',
		'msub',
		'mfrac',
		'mover',
		'munder',
		'msqrt',
		'mtext',
		'annotation'
	],
	attributes: {
		...defaultSchema.attributes,
		details: ['open'],
		span: ['class', 'style', 'aria-hidden'],
		div: ['class', 'style', 'data-type'],
		annotation: ['encoding'],
		math: ['xmlns'],
		'*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'class']
	}
};

/** Base pipeline — no KaTeX (used for non-math content) */
const baseProcessor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkMath)
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypeRaw)
	.use(rehypeSanitize, sanitizeSchema)
	.use(rehypeStringify);

/** Markdown pipeline for persisted content that must not interpret embedded HTML. */
const safeProcessor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkMath, { singleDollarTextMath: false })
	.use(remarkRehype)
	.use(rehypeSanitize, sanitizeSchema)
	.use(rehypeStringify);

/** Fast regex check for math delimiters */
export function hasMath(markdown: string): boolean {
	return /\$\$|\$[^$]|\\\[|\\\(/.test(markdown);
}

/** Cached math processor (with rehype-katex) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mathProcessor: any = null;
let mathProcessorPromise: Promise<ReturnType<typeof unified>> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let safeMathProcessor: any = null;
let safeMathProcessorPromise: Promise<ReturnType<typeof unified>> | null = null;

/** Dynamically load and cache the math-enhanced processor */
export async function getMathProcessor(): Promise<ReturnType<typeof unified>> {
	if (mathProcessor) return mathProcessor;
	if (!mathProcessorPromise) {
		mathProcessorPromise = import('rehype-katex')
			.then(({ default: rehypeKatex }) => {
				mathProcessor = unified()
					.use(remarkParse)
					.use(remarkGfm)
					.use(remarkMath)
					.use(remarkRehype, { allowDangerousHtml: true })
					.use(rehypeRaw)
					.use(rehypeKatex)
					.use(rehypeSanitize, sanitizeSchema)
					.use(rehypeStringify);
				return mathProcessor;
			})
			.finally(() => {
				mathProcessorPromise = null;
			});
	}
	return mathProcessorPromise;
}

export async function getSafeMathProcessor(): Promise<ReturnType<typeof unified>> {
	if (safeMathProcessor) return safeMathProcessor;
	if (!safeMathProcessorPromise) {
		safeMathProcessorPromise = import('rehype-katex')
			.then(({ default: rehypeKatex }) => {
				safeMathProcessor = unified()
					.use(remarkParse)
					.use(remarkGfm)
					.use(remarkMath, { singleDollarTextMath: false })
					.use(remarkRehype)
					.use(rehypeKatex)
					.use(rehypeSanitize, sanitizeSchema)
					.use(rehypeStringify);
				return safeMathProcessor;
			})
			.finally(() => {
				safeMathProcessorPromise = null;
			});
	}
	return safeMathProcessorPromise;
}

/**
 * Render markdown to sanitized HTML.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
	const processed = markdown.replace(/^-{3,}\s*$/gm, '<hr class="compaction-divider" />');
	const proc = hasMath(markdown) ? await getMathProcessor() : baseProcessor;
	const result = await proc.process(processed);
	return String(result);
}

/**
 * Synchronous render (for use in reactive contexts).
 * Uses base pipeline by default. If math is detected and the math processor
 * is already cached, uses it. Otherwise triggers async load for next render.
 */
export function renderMarkdownSync(markdown: string): string {
	const processed = markdown.replace(/^-{3,}\s*$/gm, '<hr class="compaction-divider" />');
	if (hasMath(markdown)) {
		if (mathProcessor) {
			return String(mathProcessor.processSync(processed));
		}
		// Trigger async load — next render will pick it up
		void getMathProcessor().catch(() => undefined);
	}
	return String(baseProcessor.processSync(processed));
}

/** Render Markdown while dropping raw HTML nodes from persisted or otherwise untrusted content. */
export function renderMarkdownSafeSync(markdown: string): string {
	if (hasMath(markdown)) {
		if (safeMathProcessor) return String(safeMathProcessor.processSync(markdown));
		void getSafeMathProcessor().catch(() => undefined);
	}
	return String(safeProcessor.processSync(markdown));
}
