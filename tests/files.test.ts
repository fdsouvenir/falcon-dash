import { expect, test } from '@playwright/test';
import { loadPage } from './helpers';

test.describe('files page', () => {
	test('shows breadcrumb navigation', async ({ page }) => {
		await loadPage(page, '/files');
		await expect(page.locator('nav[aria-label="File breadcrumb"]')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
	});

	test('shows file action buttons', async ({ page }) => {
		await loadPage(page, '/files');
		await expect(page.getByText('New File')).toBeVisible();
		await expect(page.getByText('New Folder')).toBeVisible();
	});

	test('shows preview placeholder', async ({ page }) => {
		await loadPage(page, '/files');
		await expect(page.getByText('Select a file to preview')).toBeVisible();
	});

	test('shows file list or empty state', async ({ page }) => {
		await loadPage(page, '/files');
		const sortByName = page.locator('button[aria-label="Sort by name"]');
		const empty = page.getByText('This directory is empty');
		await expect(sortByName.or(empty)).toBeVisible();
	});
});
