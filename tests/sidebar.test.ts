import { expect, test } from '@playwright/test';
import { loadPage } from './helpers';

test.describe('sidebar', () => {
	test('is visible on desktop', async ({ page }) => {
		await loadPage(page, '/');
		await expect(page.locator('aside[aria-label="Main sidebar navigation"]')).toBeVisible();
	});

	test('shows logo', async ({ page }) => {
		await loadPage(page, '/');
		await expect(
			page.locator('aside[aria-label="Main sidebar navigation"]').getByText('falcon-dash')
		).toBeVisible();
	});

	test('shows channels section', async ({ page }) => {
		await loadPage(page, '/');
		const sidebar = page.locator('aside[aria-label="Main sidebar navigation"]');
		await expect(sidebar.getByRole('heading', { name: 'Channels' })).toBeVisible();
		await expect(sidebar.getByText('No channels yet')).toBeVisible();
		await expect(sidebar.locator('button[aria-label="New chat"]')).toBeVisible();
	});

	test('shows apps section with links', async ({ page }) => {
		await loadPage(page, '/');
		const sidebar = page.locator('aside[aria-label="Main sidebar navigation"]');
		await expect(sidebar.getByText('Apps')).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Projects' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Files' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Agent Jobs' })).toBeVisible();
	});

	test('shows footer links', async ({ page }) => {
		await loadPage(page, '/');
		const sidebar = page.locator('aside[aria-label="Main sidebar navigation"]');
		await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Passwords' })).toBeVisible();
	});

	test('shows connection status as disconnected', async ({ page }) => {
		await loadPage(page, '/');
		const status = page.locator('[role="status"][aria-live="polite"]');
		await expect(status).toBeVisible();
		await expect(status).toContainText('Disconnected');
	});

	test('shows theme toggle', async ({ page }) => {
		await loadPage(page, '/');
		await expect(page.locator('button[aria-label*="Toggle theme"]')).toBeVisible();
	});

	test('active state on navigation', async ({ page }) => {
		await loadPage(page, '/projects');
		const sidebar = page.locator('aside[aria-label="Main sidebar navigation"]');
		const projectsLink = sidebar.getByRole('link', { name: 'Projects' });
		const filesLink = sidebar.getByRole('link', { name: 'Files' });
		await expect(projectsLink).toHaveAttribute('aria-current', 'page');
		await expect(projectsLink).toHaveClass(/bg-slate-700/);
		await expect(filesLink).not.toHaveAttribute('aria-current', 'page');
	});
});
