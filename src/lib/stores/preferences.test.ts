import { beforeEach, describe, expect, it } from 'vitest';

describe('display preferences', () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.classList.remove('compact');
		document.documentElement.removeAttribute('data-text-size');
	});

	it('loads older stored preferences without text size', async () => {
		localStorage.setItem(
			'falcon-dash-preferences',
			JSON.stringify({
				theme: 'dark',
				notificationsEnabled: false,
				soundEnabled: true,
				compactMode: true
			})
		);

		const { loadPreferences } = await import('./preferences.js');

		expect(loadPreferences()).toMatchObject({
			theme: 'dark',
			notificationsEnabled: false,
			soundEnabled: true,
			compactMode: true,
			textSize: 'comfortable'
		});
	});

	it('applies text size and compact state to the root element', async () => {
		const { applyDisplayPreferences } = await import('./preferences.js');

		applyDisplayPreferences({ compactMode: true, textSize: 'extra-large' });

		expect(document.documentElement.classList.contains('compact')).toBe(true);
		expect(document.documentElement.getAttribute('data-text-size')).toBe('extra-large');
	});
});
