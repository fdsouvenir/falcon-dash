import { test, expect } from './fixtures';

test('ready endpoint responds', async ({ page, baseURL }) => {
	await page.goto(`${baseURL ?? ''}/api/ready`);
	await expect(page.locator('body')).toContainText('"ready":true');
});

test('homepage renders a visible shell', async ({ gotoHome, page }) => {
	await gotoHome();
	await expect(page.locator('body')).not.toBeEmpty();
});
