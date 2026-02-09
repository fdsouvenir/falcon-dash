import { expect, test } from '@playwright/test';
import { loadPage } from './helpers';

test.describe('jobs page', () => {
	test('shows tab bar with heartbeat and cron tabs', async ({ page }) => {
		await loadPage(page, '/jobs');
		const tablist = page.locator('[role="tablist"][aria-label="Job type tabs"]');
		await expect(tablist).toBeVisible();

		const tabs = tablist.locator('[role="tab"]');
		await expect(tabs).toHaveCount(2);
		await expect(tabs.nth(0)).toHaveText('Heartbeat');
		await expect(tabs.nth(1)).toHaveText('Cron Jobs');
		await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
	});

	test('heartbeat tab shows content state', async ({ page }) => {
		await loadPage(page, '/jobs');
		const loading = page.getByText('Loading heartbeat configuration...');
		const config = page.getByText('Heartbeat Configuration');
		const retry = page.getByText('Retry');
		await expect(loading.or(config).or(retry)).toBeVisible();
	});

	test('switching to cron jobs tab', async ({ page }) => {
		await loadPage(page, '/jobs');
		const tablist = page.locator('[role="tablist"][aria-label="Job type tabs"]');
		await tablist.locator('[role="tab"]', { hasText: 'Cron Jobs' }).click();
		await expect(tablist.locator('[role="tab"]', { hasText: 'Cron Jobs' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByText('New Job')).toBeVisible();
	});

	test('heartbeat interval input has correct attributes', async ({ page }) => {
		await loadPage(page, '/jobs');
		const input = page.locator('input[aria-label="Heartbeat interval in minutes"]');
		if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
			await expect(input).toHaveAttribute('type', 'number');
			await expect(input).toHaveAttribute('min', '1');
			await expect(input).toHaveAttribute('max', '1440');
		}
	});
});
