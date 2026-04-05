import { test, expect } from './fixtures';

test('ready endpoint responds', async ({ page, baseURL }) => {
	await page.goto(`${baseURL ?? ''}/api/ready`);
	await expect(page.locator('body')).toContainText('"ready":true');
});

test('homepage renders a visible shell', async ({ gotoHome, page }) => {
	await gotoHome();
	await expect(page.locator('body')).not.toBeEmpty();
});

test('desktop shell smoke', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'Desktop-only shell smoke');

	await page.goto(`${baseURL ?? ''}/`);

	await expect(page.locator('aside')).toBeVisible();
	await expect(page.getByText('Navigation')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Approvals' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Channels' })).toBeVisible();
});

test('mobile shell smoke', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only shell smoke');

	await page.goto(`${baseURL ?? ''}/`);

	await expect(page.getByText('Dashboard')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Channels' })).toBeVisible();
});

test('settings route smoke', async ({ page, baseURL }, testInfo) => {
	await page.goto(`${baseURL ?? ''}/settings`);

	if (testInfo.project.name === 'mobile-chrome') {
		await expect(page.getByText('Settings')).toBeVisible();
		await expect(page.getByRole('button', { name: /User/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Agents/i })).toBeVisible();
		return;
	}

	await expect(page.getByRole('button', { name: 'User' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Agents' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
});
