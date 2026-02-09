import { expect, test } from '@playwright/test';
import { loadPage } from './helpers';

const settingsTabs = [
	'Workspace',
	'Information',
	'Skills',
	'Security',
	'Dashboard',
	'Advanced',
	'About'
];
const nonDefaultTabs = ['information', 'skills', 'security', 'dashboard', 'advanced', 'about'];

test.describe('settings page', () => {
	test('shows header and all tabs', async ({ page }) => {
		await loadPage(page, '/settings');
		await expect(page.locator('h1')).toHaveText('Settings');
		for (const tab of settingsTabs) {
			await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
		}
	});

	test('workspace is active by default', async ({ page }) => {
		await loadPage(page, '/settings');
		const workspaceBtn = page.getByRole('button', { name: 'Workspace', exact: true });
		await expect(workspaceBtn).toHaveClass(/text-slate-100/);
	});

	test('clicking tab updates hash', async ({ page }) => {
		await loadPage(page, '/settings');
		await page.getByRole('button', { name: 'About', exact: true }).click();
		await expect(page).toHaveURL(/#about/);
		await expect(page.getByRole('button', { name: 'About', exact: true })).toHaveClass(
			/text-slate-100/
		);
	});

	for (const tabId of nonDefaultTabs) {
		test(`URL hash #${tabId} activates tab`, async ({ page }) => {
			await loadPage(page, `/settings#${tabId}`);
			const label = tabId.charAt(0).toUpperCase() + tabId.slice(1);
			await expect(page.getByRole('button', { name: label, exact: true })).toHaveClass(
				/text-slate-100/
			);
		});
	}
});
