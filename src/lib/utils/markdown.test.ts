// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { getSafeMathProcessor, renderMarkdownSafeSync } from './markdown.js';

describe('safe Markdown input', () => {
	it('keeps Markdown structure and fenced code while dropping raw HTML', () => {
		const html = renderMarkdownSafeSync(`> Quoted guidance

\`\`\`html
<div style="position:fixed;inset:0;z-index:9999">Example</div>
\`\`\`

<div style="position:fixed;inset:0;z-index:9999">Cover</div>

## Safe heading`);

		expect(html).toContain('<blockquote>');
		expect(html).toContain('Quoted guidance');
		expect(html).toContain('<code class="language-html">');
		expect(html).toContain('&#x3C;div style="position:fixed;inset:0;z-index:9999">Example');
		expect(html).toContain('<h2>Safe heading</h2>');
		expect(html).not.toContain('<div style=');
	});

	it('retains math rendering without enabling raw HTML', async () => {
		await getSafeMathProcessor();
		const html = renderMarkdownSafeSync(
			'Inline $$x^2$$\n\n<div style="position:fixed">Cover</div>'
		);

		expect(html).toContain('class="katex"');
		expect(html).toContain('<msup>');
		expect(html).not.toContain('<div style=');
	});

	it('keeps ordinary currency amounts as text', async () => {
		await getSafeMathProcessor();
		const html = renderMarkdownSafeSync('Budget is $5 and revenue is $10.');

		expect(html).toContain('Budget is $5 and revenue is $10.');
		expect(html).not.toContain('class="katex"');
	});
});
