import { expect, test as base } from '@playwright/test';

type FalconDashFixtures = {
	gotoHome: () => Promise<void>;
};

export const test = base.extend<FalconDashFixtures>({
	gotoHome: async ({ page, baseURL }, use) => {
		await use(async () => {
			await page.goto(baseURL ?? '/');
			await expect(page.locator('body')).toBeVisible();
		});
	}
});

export { expect };
