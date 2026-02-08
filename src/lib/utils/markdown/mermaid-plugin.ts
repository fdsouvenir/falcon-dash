import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';

/**
 * Extract text content from a hast node tree.
 */
function extractText(node: Element | Text): string {
	if (node.type === 'text') return node.value;
	if ('children' in node) {
		return (node.children as (Element | Text)[]).map(extractText).join('');
	}
	return '';
}

/**
 * Rehype plugin that replaces ```mermaid code blocks with placeholder divs.
 *
 * The mermaid source is base64-encoded in data-mermaid-source attribute.
 * Actual rendering is handled post-DOM by the mermaidAction Svelte action.
 */
export function rehypeMermaidPlugin() {
	return (tree: Root) => {
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName !== 'pre' || !parent || index === undefined || index === null) {
				return;
			}

			const codeNode = node.children.find(
				(child): child is Element => child.type === 'element' && child.tagName === 'code'
			);
			if (!codeNode) return;

			// Check if this is a mermaid code block
			const classes = codeNode.properties?.className;
			if (!Array.isArray(classes)) return;
			const isMermaid = classes.some(
				(cls) => typeof cls === 'string' && cls === 'language-mermaid'
			);
			if (!isMermaid) return;

			const source = extractText(codeNode);
			const encoded = btoa(unescape(encodeURIComponent(source)));

			const placeholder: Element = {
				type: 'element',
				tagName: 'div',
				properties: {
					className: ['mermaid-placeholder'],
					'data-mermaid-source': encoded
				},
				children: [
					{
						type: 'element',
						tagName: 'div',
						properties: { className: ['mermaid-loading'] },
						children: [{ type: 'text', value: 'Loading diagram...' }]
					}
				]
			};

			(parent as Element).children[index] = placeholder;
		});
	};
}
