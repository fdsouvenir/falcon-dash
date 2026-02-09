import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

/**
 * Rehype plugin that adds loading="lazy" to all img elements
 * for native browser lazy loading.
 */
export function rehypeLazyImagesPlugin() {
	return (tree: Root) => {
		visit(tree, 'element', (node: Element) => {
			if (node.tagName === 'img') {
				node.properties = node.properties || {};
				node.properties.loading = 'lazy';
			}
		});
	};
}
