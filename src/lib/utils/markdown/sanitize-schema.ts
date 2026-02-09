import { defaultSchema } from 'rehype-sanitize';

// SVG elements used by Mermaid diagrams (US-031)
const svgTagNames = [
	'svg',
	'g',
	'rect',
	'path',
	'text',
	'circle',
	'line',
	'polyline',
	'polygon',
	'ellipse',
	'foreignObject',
	'tspan',
	'marker',
	'defs',
	'use',
	'style',
	'clipPath',
	'linearGradient',
	'radialGradient',
	'stop',
	'title',
	'desc'
];

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
		// US-076: lazy loading for images
		img: [...(defaultSchema.attributes?.img ?? []), 'loading'],
		// US-029: copy button in code blocks
		button: ['className', 'type', 'ariaLabel'],
		// US-030: MathML attributes for KaTeX
		math: ['xmlns', 'display'],
		annotation: ['encoding'],
		// US-031: SVG attributes for Mermaid diagrams
		svg: [
			'xmlns',
			'viewBox',
			'width',
			'height',
			'className',
			'style',
			'role',
			'aria-roledescription',
			'aria-label',
			'id'
		],
		g: ['className', 'transform', 'id', 'style'],
		rect: [
			'x',
			'y',
			'width',
			'height',
			'rx',
			'ry',
			'fill',
			'stroke',
			'strokeWidth',
			'style',
			'className',
			'id'
		],
		path: [
			'd',
			'fill',
			'stroke',
			'strokeWidth',
			'style',
			'className',
			'id',
			'markerEnd',
			'markerStart'
		],
		text: [
			'x',
			'y',
			'dominantBaseline',
			'textAnchor',
			'style',
			'className',
			'id',
			'fill',
			'dy',
			'dx',
			'transform'
		],
		circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'style', 'className', 'id'],
		line: [
			'x1',
			'y1',
			'x2',
			'y2',
			'stroke',
			'strokeWidth',
			'style',
			'className',
			'id',
			'markerEnd'
		],
		polyline: ['points', 'fill', 'stroke', 'strokeWidth', 'style', 'className', 'id'],
		polygon: ['points', 'fill', 'stroke', 'style', 'className', 'id'],
		ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'style', 'className', 'id'],
		foreignObject: ['x', 'y', 'width', 'height', 'className', 'style', 'id'],
		tspan: ['x', 'y', 'dx', 'dy', 'className', 'style'],
		marker: [
			'id',
			'viewBox',
			'refX',
			'refY',
			'markerWidth',
			'markerHeight',
			'orient',
			'markerUnits'
		],
		defs: [],
		use: ['href', 'x', 'y', 'width', 'height'],
		clipPath: ['id'],
		linearGradient: ['id', 'x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform'],
		radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits'],
		stop: ['offset', 'stopColor', 'stopOpacity', 'style'],
		title: [],
		desc: []
	},
	tagNames: [...(defaultSchema.tagNames ?? []), 'button', ...mathmlTagNames, ...svgTagNames]
};
