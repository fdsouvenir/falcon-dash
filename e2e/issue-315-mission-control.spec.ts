import { expect, test } from './fixtures';

test.describe('issue #315 default operator workspace', () => {
	test('redirects the homepage to Work v3 Mission Control', async ({ gotoHome, page }) => {
		await gotoHome();

		await expect(page).toHaveURL(/\/work$/);
		await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Needs Fred' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Agent can act' })).toBeVisible();
		await expect(page.getByText('Material recent changes')).toBeVisible();
	});

	test('stays usable at mobile width', async ({ gotoHome, page }) => {
		test.skip(test.info().project.name !== 'mobile-chrome', 'Mobile layout assertion only');

		await gotoHome();

		await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible();
		for (const module of ['Work', 'Vault', 'Channels', 'Labs']) {
			await expect(page.getByRole('link', { name: module, exact: true }).last()).toBeVisible();
		}

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);

		expect(hasHorizontalOverflow).toBe(false);
	});
});
