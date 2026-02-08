import type { ActionReturn } from 'svelte/action';

let mermaidInstance: typeof import('mermaid').default | null = null;
let initPromise: Promise<void> | null = null;
let renderCounter = 0;

/**
 * Initialize mermaid on first use via dynamic import.
 */
async function ensureMermaid(): Promise<typeof import('mermaid').default> {
	if (mermaidInstance) return mermaidInstance;
	if (!initPromise) {
		initPromise = (async () => {
			const mod = await import('mermaid');
			mermaidInstance = mod.default;
			mermaidInstance.initialize({
				startOnLoad: false,
				theme: 'dark',
				securityLevel: 'loose'
			});
		})();
	}
	await initPromise;
	return mermaidInstance!;
}

/**
 * Render all mermaid placeholders within the given container.
 */
async function renderPlaceholders(node: HTMLElement) {
	const placeholders = node.querySelectorAll<HTMLElement>(
		'.mermaid-placeholder:not(.mermaid-rendered)'
	);
	if (placeholders.length === 0) return;

	let mermaid: typeof import('mermaid').default;
	try {
		mermaid = await ensureMermaid();
	} catch {
		// If mermaid fails to load, show error in all placeholders
		placeholders.forEach((el) => {
			el.classList.add('mermaid-rendered');
			el.innerHTML = '<div class="mermaid-error">Failed to load diagram renderer</div>';
		});
		return;
	}

	for (const el of placeholders) {
		const encoded = el.getAttribute('data-mermaid-source');
		if (!encoded) continue;

		let source: string;
		try {
			source = decodeURIComponent(escape(atob(encoded)));
		} catch {
			el.classList.add('mermaid-rendered');
			el.innerHTML = '<div class="mermaid-error">Invalid diagram source</div>';
			continue;
		}

		const id = `mermaid-${Date.now()}-${renderCounter++}`;

		try {
			const { svg } = await mermaid.render(id, source);
			el.classList.add('mermaid-rendered');
			el.innerHTML = `<div class="mermaid-diagram">${svg}</div>`;
		} catch (err) {
			el.classList.add('mermaid-rendered');
			const message = err instanceof Error ? err.message : 'Unknown render error';
			el.innerHTML = `<div class="mermaid-error">${escapeHtml(message)}</div><pre class="mermaid-fallback"><code>${escapeHtml(source)}</code></pre>`;
			// Mermaid render errors may leave orphan SVG nodes in the DOM
			const orphan = document.getElementById(id);
			if (orphan) orphan.remove();
		}
	}
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Svelte action that finds .mermaid-placeholder divs in rendered HTML
 * and renders them with mermaid.
 *
 * Usage: <div use:mermaidAction>{@html renderedHtml}</div>
 */
export function mermaidAction(node: HTMLElement): ActionReturn {
	let observer: MutationObserver | null = null;

	// Render on initial mount
	renderPlaceholders(node);

	// Watch for DOM changes (new placeholders from re-renders)
	observer = new MutationObserver(() => {
		renderPlaceholders(node);
	});
	observer.observe(node, { childList: true, subtree: true });

	return {
		destroy() {
			if (observer) {
				observer.disconnect();
				observer = null;
			}
		}
	};
}
