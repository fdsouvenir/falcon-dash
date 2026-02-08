import type { ActionReturn } from 'svelte/action';

/**
 * Svelte action that attaches click handlers to code block copy buttons
 * injected by the Shiki rehype plugin.
 *
 * Usage: <div use:codeBlockActions>{@html renderedHtml}</div>
 */
export function codeBlockActions(node: HTMLElement): ActionReturn {
	function handleClick(event: Event) {
		const target = event.target as HTMLElement;
		if (!target.classList.contains('code-block-copy')) return;

		const wrapper = target.closest('.code-block-wrapper');
		if (!wrapper) return;

		const codeEl = wrapper.querySelector('code');
		if (!codeEl) return;

		const text = codeEl.textContent ?? '';
		navigator.clipboard.writeText(text).then(() => {
			target.textContent = 'Copied!';
			setTimeout(() => {
				target.textContent = 'Copy';
			}, 2000);
		});
	}

	node.addEventListener('click', handleClick);

	return {
		destroy() {
			node.removeEventListener('click', handleClick);
		}
	};
}
