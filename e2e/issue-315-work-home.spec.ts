import { expect, test } from './fixtures';

test.describe('issue #315 default operator workspace', () => {
	test('redirects the homepage to the Work overview', async ({ gotoHome, page }) => {
		await gotoHome();

		await expect(page).toHaveURL(/\/work$/);
		await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: /^Needs your call/ })).toBeVisible();
		await expect(page.getByRole('heading', { name: /^At risk/ })).toBeVisible();
		await expect(page.getByRole('heading', { name: /^Recent activity/ })).toBeVisible();
	});

	test('stays usable at mobile width', async ({ gotoHome, page }) => {
		test.skip(test.info().project.name !== 'mobile-chrome', 'Mobile layout assertion only');

		await gotoHome();

		await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
		for (const module of ['Work', 'Vault', 'Channels', 'Labs']) {
			await expect(page.getByRole('link', { name: module, exact: true }).last()).toBeVisible();
		}

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);

		expect(hasHorizontalOverflow).toBe(false);
	});
});
