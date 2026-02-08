import { visit } from 'unist-util-visit';
import { fromHtml } from 'hast-util-from-html';
import type { Root, Element, Text } from 'hast';
import { highlighterManager } from './highlighter';

/**
 * Extract the language from a code element's className.
 * Remark-rehype outputs className like ['language-typescript'].
 */
function getLanguage(node: Element): string | null {
	const classes = node.properties?.className;
	if (!Array.isArray(classes)) return null;
	for (const cls of classes) {
		if (typeof cls === 'string' && cls.startsWith('language-')) {
			return cls.slice('language-'.length);
		}
	}
	return null;
}

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
 * Rehype plugin that applies Shiki syntax highlighting to code blocks
 * and injects a copy button + language label.
 *
 * When the highlighter is not yet ready, falls back to unstyled code blocks
 * with the language-xxx class preserved.
 */
export function rehypeShikiPlugin() {
	return (tree: Root) => {
		visit(tree, 'element', (node, index, parent) => {
			// Match <pre><code class="language-xxx">
			if (node.tagName !== 'pre' || !parent || index === undefined || index === null) {
				return;
			}

			const codeNode = node.children.find(
				(child): child is Element => child.type === 'element' && child.tagName === 'code'
			);
			if (!codeNode) return;

			const lang = getLanguage(codeNode);
			const code = extractText(codeNode);

			// Build the copy button + language label header
			const langLabel = lang ?? 'text';
			const headerHtml = `<div class="code-block-header"><span class="code-block-lang">${langLabel}</span><button class="code-block-copy" type="button" aria-label="Copy code">Copy</button></div>`;

			if (highlighterManager.isReady() && lang) {
				// Shiki returns a full <pre><code>...</code></pre> — parse and extract
				const highlighted = highlighterManager.highlight(code, lang);
				const fragment = fromHtml(highlighted, { fragment: true });
				const headerFragment = fromHtml(headerHtml, { fragment: true });

				// Wrap in a container div
				const wrapper: Element = {
					type: 'element',
					tagName: 'div',
					properties: { className: ['code-block-wrapper'] },
					children: [...headerFragment.children, ...fragment.children] as Element[]
				};

				// Replace the original <pre> node
				(parent as Element).children[index] = wrapper;
			} else {
				// Fallback: no highlighting, but add header
				const headerFragment = fromHtml(headerHtml, { fragment: true });

				const wrapper: Element = {
					type: 'element',
					tagName: 'div',
					properties: { className: ['code-block-wrapper'] },
					children: [...headerFragment.children, node] as Element[]
				};

				(parent as Element).children[index] = wrapper;
			}
		});
	};
}
