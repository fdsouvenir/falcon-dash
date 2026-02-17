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

/** Fast regex check for math delimiters */
export function hasMath(markdown: string): boolean {
	return /\$\$|\$[^$]|\\\[|\\\(/.test(markdown);
}

/** Cached math processor (with rehype-katex) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mathProcessor: any = null;
let mathProcessorLoading = false;

/** Inject KaTeX CSS into document head (once) */
let katexCssInjected = false;
function injectKatexCss() {
	if (katexCssInjected || typeof document === 'undefined') return;
	katexCssInjected = true;
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
	document.head.appendChild(link);
}

/** Dynamically load and cache the math-enhanced processor */
export async function getMathProcessor(): Promise<ReturnType<typeof unified>> {
	if (mathProcessor) return mathProcessor;
	if (mathProcessorLoading) {
		// Wait for the in-flight load
		return new Promise((resolve) => {
			const check = setInterval(() => {
				if (mathProcessor) {
					clearInterval(check);
					resolve(mathProcessor);
				}
			}, 50);
		});
	}
	mathProcessorLoading = true;
	const { default: rehypeKatex } = await import('rehype-katex');
	injectKatexCss();
	mathProcessor = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkMath)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(rehypeKatex)
		.use(rehypeSanitize, sanitizeSchema)
		.use(rehypeStringify);
	mathProcessorLoading = false;
	return mathProcessor;
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
		getMathProcessor();
	}
	return String(baseProcessor.processSync(processed));
}
