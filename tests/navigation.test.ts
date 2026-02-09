import { expect, test } from '@playwright/test';
import { loadPage } from './helpers';

const routes = [
	'/',
	'/projects',
	'/files',
	'/jobs',
	'/settings',
	'/passwords',
	'/apps/nonexistent',
	'/projects/nonexistent'
];

for (const route of routes) {
	test(`${route} loads without console errors`, async ({ page }) => {
		const collector = await loadPage(page, route);
		await expect(page.locator('#main-content')).toBeVisible();
		collector.expectNoErrors();
	});
}

test.describe('home page disconnected state', () => {
	test('shows connect form', async ({ page }) => {
		await loadPage(page, '/');
		await expect(page.locator('h1')).toHaveText('Connect to Gateway');
		await expect(page.locator('#gateway-url')).toBeVisible();
		await expect(page.locator('#gateway-url')).toHaveAttribute(
			'placeholder',
			'ws://127.0.0.1:18789'
		);
		await expect(page.locator('#gateway-token')).toBeVisible();
		await expect(page.locator('#gateway-token')).toHaveAttribute('type', 'password');
		await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
	});
});

test.describe('not-found fallbacks', () => {
	test('nonexistent project shows not found', async ({ page }) => {
		await loadPage(page, '/projects/nonexistent');
		await expect(
			page.getByText('Project not found').or(page.getByText('Invalid project ID'))
		).toBeVisible();
		await expect(page.getByText('Back to Projects')).toBeVisible();
	});

	test('nonexistent app shows not found', async ({ page }) => {
		await loadPage(page, '/apps/nonexistent');
		await expect(page.getByText('App not found')).toBeVisible();
	});
});

test.describe('client-side navigation', () => {
	test('navigate from home to projects via sidebar', async ({ page }) => {
		await loadPage(page, '/');
		await page.getByRole('link', { name: 'Projects' }).first().click();
		await expect(page).toHaveURL(/\/projects/);
		await expect(page.locator('h1')).toHaveText('Projects');
	});

	test('navigate from projects to settings via sidebar', async ({ page }) => {
		await loadPage(page, '/projects');
		await page.getByRole('link', { name: 'Settings' }).first().click();
		await expect(page).toHaveURL(/\/settings/);
		await expect(page.locator('h1')).toHaveText('Settings');
	});
});
