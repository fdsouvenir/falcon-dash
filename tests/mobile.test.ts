import { expect, test } from '@playwright/test';
import { loadPage } from './helpers';

test.describe('mobile layout', () => {
	test('sidebar hidden by default', async ({ page }) => {
		await loadPage(page, '/');
		const aside = page.locator('aside[aria-label="Main sidebar navigation"]');
		await expect(aside).toHaveClass(/-translate-x-full/);
	});

	test('mobile header visible with toggle', async ({ page }) => {
		await loadPage(page, '/');
		await expect(page.locator('button[aria-label="Toggle sidebar"]')).toBeVisible();
		await expect(page.locator('header').getByText('falcon-dash')).toBeVisible();
	});

	test('hamburger opens sidebar', async ({ page }) => {
		await loadPage(page, '/');
		await page.locator('button[aria-label="Toggle sidebar"]').click();
		const aside = page.locator('aside[aria-label="Main sidebar navigation"]');
		await expect(aside).toHaveClass(/translate-x-0/);
	});

	test('MobileTabBar is visible', async ({ page }) => {
		await loadPage(page, '/');
		const nav = page.locator('nav[aria-label="Main navigation"]');
		await expect(nav).toBeVisible();
		await expect(nav.getByText('Chat')).toBeVisible();
		await expect(nav.getByText('Projects')).toBeVisible();
		await expect(nav.getByText('Files')).toBeVisible();
		await expect(nav.getByText('Jobs')).toBeVisible();
		await expect(nav.getByText('More')).toBeVisible();
	});

	test('active tab highlighting on projects', async ({ page }) => {
		await loadPage(page, '/projects');
		const nav = page.locator('nav[aria-label="Main navigation"]');
		const projectsTab = nav.getByRole('link', { name: 'Projects' });
		const filesTab = nav.getByRole('link', { name: 'Files' });
		await expect(projectsTab).toHaveClass(/text-blue-400/);
		await expect(filesTab).toHaveClass(/text-slate-400/);
	});

	test('aria-current on active tab', async ({ page }) => {
		await loadPage(page, '/files');
		const nav = page.locator('nav[aria-label="Main navigation"]');
		const filesTab = nav.getByRole('link', { name: 'Files' });
		await expect(filesTab).toHaveAttribute('aria-current', 'page');
	});

	test('tab bar navigation works', async ({ page }) => {
		await loadPage(page, '/');
		const nav = page.locator('nav[aria-label="Main navigation"]');
		await nav.getByRole('link', { name: 'Jobs' }).click();
		await expect(page).toHaveURL(/\/jobs/);
	});

	test('more menu shows additional links', async ({ page }) => {
		await loadPage(page, '/');
		await page.locator('button[aria-label="More menu"]').click();
		const moreNav = page.locator('nav[aria-label="Additional navigation"]');
		await expect(moreNav).toBeVisible();
		await expect(moreNav.getByRole('link', { name: 'Settings' })).toBeVisible();
		await expect(moreNav.getByRole('link', { name: 'Passwords' })).toBeVisible();
	});

	test('projects mobile view switcher', async ({ page }) => {
		await loadPage(page, '/projects');
		const tablists = page.locator('[role="tablist"][aria-label="View switcher"]');
		const mobileTablist = tablists.last();
		await expect(mobileTablist).toBeVisible();
		await expect(mobileTablist.locator('[role="tab"]')).toHaveCount(3);
	});
});
