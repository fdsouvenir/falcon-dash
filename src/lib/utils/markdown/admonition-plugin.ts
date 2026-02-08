import { visit } from 'unist-util-visit';
import type { Root, Blockquote, Paragraph, Text } from 'mdast';

const ADMONITION_TYPES: Record<string, { label: string; className: string }> = {
	NOTE: { label: 'Note', className: 'admonition-note' },
	TIP: { label: 'Tip', className: 'admonition-tip' },
	WARNING: { label: 'Warning', className: 'admonition-warning' },
	CAUTION: { label: 'Caution', className: 'admonition-caution' },
	IMPORTANT: { label: 'Important', className: 'admonition-important' }
};

/**
 * Remark plugin that transforms GitHub-style blockquote admonitions
 * (> [!NOTE], > [!TIP], etc.) into styled div containers.
 *
 * Uses data.hName/hProperties to instruct remarkRehype on output HTML.
 * Icons are handled via CSS ::before pseudo-elements in RenderedContent.svelte.
 */
export function remarkAdmonitionPlugin() {
	return (tree: Root) => {
		visit(tree, 'blockquote', (node: Blockquote) => {
			const firstChild = node.children[0];
			if (!firstChild || firstChild.type !== 'paragraph') return;

			const para = firstChild as Paragraph;
			const firstInline = para.children[0];
			if (!firstInline || firstInline.type !== 'text') return;

			const match = (firstInline as Text).value.match(
				/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\n?/
			);
			if (!match) return;

			const type = match[1];
			const info = ADMONITION_TYPES[type];
			if (!info) return;

			// Remove the [!TYPE] marker from the text
			(firstInline as Text).value = (firstInline as Text).value.slice(match[0].length);

			// If the text node is now empty, remove it
			if ((firstInline as Text).value === '') {
				para.children.shift();
			}

			// If the paragraph is now empty, remove it from the blockquote
			if (para.children.length === 0) {
				node.children.shift();
			}

			// Create the title div (icon added via CSS ::before)
			const titleNode: Paragraph = {
				type: 'paragraph',
				data: {
					hName: 'div',
					hProperties: { className: ['admonition-title'] }
				},
				children: [{ type: 'text', value: info.label }]
			};

			// Wrap remaining content in an admonition-content div
			const contentChildren = [...node.children];
			const contentWrapper: Blockquote = {
				type: 'blockquote',
				data: {
					hName: 'div',
					hProperties: { className: ['admonition-content'] }
				},
				children: contentChildren
			};

			// Transform the blockquote into an admonition div
			node.data = {
				hName: 'div',
				hProperties: { className: ['admonition', info.className] }
			};

			node.children = [
				titleNode as unknown as (typeof node.children)[0],
				contentWrapper as unknown as (typeof node.children)[0]
			];
		});
	};
}
