import { expect, test } from '@playwright/test';
import { loadPage } from './helpers';

test.describe('projects page', () => {
	test('shows header and view switcher', async ({ page }) => {
		await loadPage(page, '/projects');
		await expect(page.locator('h1')).toHaveText('Projects');

		const tablist = page.locator('[role="tablist"][aria-label="View switcher"]').first();
		await expect(tablist).toBeVisible();

		const tabs = tablist.locator('[role="tab"]');
		await expect(tabs).toHaveCount(3);
		await expect(tabs.nth(0)).toHaveText('Dashboard');
		await expect(tabs.nth(1)).toHaveText('List');
		await expect(tabs.nth(2)).toHaveText('Kanban');
		await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
	});

	test('shows search toggle', async ({ page }) => {
		await loadPage(page, '/projects');
		await expect(page.locator('button[aria-label="Search projects and tasks"]')).toBeVisible();
	});

	test('view switching updates URL', async ({ page }) => {
		await loadPage(page, '/projects');
		const tablist = page.locator('[role="tablist"][aria-label="View switcher"]').first();

		await tablist.locator('[role="tab"]', { hasText: 'List' }).click();
		await expect(page).toHaveURL(/[?&]view=list/);

		await tablist.locator('[role="tab"]', { hasText: 'Kanban' }).click();
		await expect(page).toHaveURL(/[?&]view=kanban/);

		await tablist.locator('[role="tab"]', { hasText: 'Dashboard' }).click();
		await expect(page).not.toHaveURL(/[?&]view=/);
	});

	test('direct URL param selects correct tab', async ({ page }) => {
		await loadPage(page, '/projects?view=list');
		const tablist = page.locator('[role="tablist"][aria-label="View switcher"]').first();
		await expect(tablist.locator('[role="tab"]', { hasText: 'List' })).toHaveAttribute(
			'aria-selected',
			'true'
		);

		await loadPage(page, '/projects?view=kanban');
		const tablist2 = page.locator('[role="tablist"][aria-label="View switcher"]').first();
		await expect(tablist2.locator('[role="tab"]', { hasText: 'Kanban' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});
});
