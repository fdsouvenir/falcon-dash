// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button/button-variants.js';

function source(path: string): string {
	return readFileSync(new URL(path, import.meta.url), 'utf-8');
}

describe('Falcon Material foundation', () => {
	it('defines MD3-compatible aliases for Falcon tokens', () => {
		const css = source('../../../app.css');

		for (const token of [
			'--md-sys-color-primary',
			'--md-sys-color-surface',
			'--md-sys-color-on-surface',
			'--md-sys-color-outline',
			'--md-sys-typescale-title-large-size',
			'--md-sys-shape-corner-medium',
			'--md-sys-motion-duration-short2',
			'--falcon-elevation-1'
		]) {
			expect(css).toContain(token);
		}
	});

	it('uses tokenized buttons without shadow-led defaults', () => {
		const defaultButton = buttonVariants();
		const iconButton = buttonVariants({ size: 'icon' });

		expect(defaultButton).toContain('rounded-[var(--md-sys-shape-corner-full)]');
		expect(defaultButton).toContain('duration-[var(--md-sys-motion-duration-short2)]');
		expect(defaultButton).not.toContain('transition-all');
		expect(defaultButton).not.toContain('shadow-xs');
		expect(iconButton).toContain('size-10');
	});

	it('keeps cards tonal', () => {
		// The v2 mobile Work detail this test also covered was removed with the
		// v3 cutover (#342); its replacement pages are plain route templates.
		const card = source('./card/card.svelte');

		expect(card).toContain('bg-surface-container');
		expect(card).toContain('shadow-none');
		expect(card).not.toContain('shadow-sm');
	});
});
