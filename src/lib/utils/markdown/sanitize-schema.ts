import { defaultSchema } from 'rehype-sanitize';

// MathML elements used by KaTeX (US-030)
const mathmlTagNames = [
	'math',
	'semantics',
	'mrow',
	'mi',
	'mo',
	'mn',
	'msup',
	'msub',
	'mfrac',
	'msqrt',
	'mover',
	'munder',
	'mtext',
	'annotation',
	'mspace',
	'mtable',
	'mtr',
	'mtd',
	'menclose'
];

/**
 * Custom sanitize schema extending the GitHub default.
 * Extended progressively by later stories (US-029 Shiki, US-030 KaTeX, US-031 Mermaid).
 */
export const sanitizeSchema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./]],
		pre: [...(defaultSchema.attributes?.pre ?? []), 'className', 'style', 'tabIndex'],
		div: [...(defaultSchema.attributes?.div ?? []), 'className', 'style', /^data-/],
		span: [...(defaultSchema.attributes?.span ?? []), 'className', 'style'],
		// US-029: copy button in code blocks
		button: ['className', 'type', 'ariaLabel'],
		// US-030: MathML attributes for KaTeX
		math: ['xmlns', 'display'],
		annotation: ['encoding']
	},
	tagNames: [...(defaultSchema.tagNames ?? []), 'button', ...mathmlTagNames]
};
