import { defaultSchema } from 'rehype-sanitize';

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
		div: [...(defaultSchema.attributes?.div ?? []), 'className', /^data-/],
		span: [...(defaultSchema.attributes?.span ?? []), 'className', 'style'],
		// US-029: copy button in code blocks
		button: ['className', 'type', 'ariaLabel']
	},
	tagNames: [...(defaultSchema.tagNames ?? []), 'button']
};
