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

	it('keeps form controls tokenized and focus-visible', () => {
		for (const path of [
			'./input/input.svelte',
			'./textarea/textarea.svelte',
			'./select/select.svelte'
		]) {
			const control = source(path);
			expect(control).toContain('bg-surface-container');
			expect(control).toContain('rounded-[var(--md-sys-shape-corner-small)]');
			expect(control).toContain('falcon-focus');
			expect(control).toContain('touch-target');
			expect(control).not.toMatch(/(?:bg|text|border)-(?:blue|emerald|red|amber|sky)-\d/);
		}
	});

	it('provides visible nested focus and reduced-motion fallbacks', () => {
		const css = source('../../../app.css');

		expect(css).toContain('.falcon-focus:has(:focus-visible)');
		expect(css).toContain('@media (prefers-reduced-motion: reduce)');
		expect(css).toContain('transition-duration: 0.01ms !important');
	});

	it('uses semantic modal surfaces on desktop and mobile', () => {
		const dialog = source('./confirm-dialog/confirm-dialog.svelte');

		expect(dialog).toContain('<dialog');
		expect(dialog).toContain('BottomSheet');
		expect(dialog).toContain('bg-surface-container');
		expect(dialog).toContain('shadow-none');
		expect(dialog).not.toContain('shadow-sm');
	});

	it('gives tabs keyboard and ARIA semantics', () => {
		const tabs = source('./tabs/tabs.svelte');

		expect(tabs).toContain('role="tablist"');
		expect(tabs).toContain("'ArrowLeft', 'ArrowRight'");
		expect(tabs).toContain("event.key === 'ArrowRight'");
		expect(tabs).toContain('aria-selected');
	});
});
