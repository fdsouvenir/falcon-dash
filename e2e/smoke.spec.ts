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

	await expect(page).toHaveURL(/\/work$/);
	const moduleNavigation = page.getByRole('navigation', { name: 'Falcon Dash modules' });
	await expect(moduleNavigation).toBeVisible();
	await expect(moduleNavigation.getByRole('button', { name: 'Vault' })).toBeVisible();
	await expect(moduleNavigation.getByRole('button', { name: 'Channels' })).toBeVisible();
	await expect(moduleNavigation.getByRole('button', { name: 'Labs' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Work' })).toBeVisible();
});

test('mobile shell smoke', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only shell smoke');

	await page.goto(`${baseURL ?? ''}/`);

	await expect(page).toHaveURL(/\/work$/);
	for (const module of ['Work', 'Vault', 'Channels', 'Labs']) {
		await expect(page.getByRole('link', { name: module, exact: true }).last()).toBeVisible();
	}
	await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible();
});

test('settings route smoke', async ({ page, baseURL }, testInfo) => {
	await page.goto(`${baseURL ?? ''}/settings`);

	if (testInfo.project.name === 'mobile-chrome') {
		await expect(page.getByText('Settings')).toBeVisible();
		await expect(page.getByRole('button', { name: 'User Your profile' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Agents System instructions' })).toBeVisible();
		return;
	}

	await expect(page.getByRole('button', { name: 'User' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Agents' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Agent Tokens' })).toBeVisible();
});
