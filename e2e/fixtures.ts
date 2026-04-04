import { expect, test as base } from '@playwright/test';

type FalconDashFixtures = {
	gotoHome: () => Promise<void>;
	gotoSettingsTab: (label: string) => Promise<void>;
};

export const test = base.extend<FalconDashFixtures>({
	gotoHome: async ({ page, baseURL }, use) => {
		await use(async () => {
			await page.goto(baseURL ?? '/');
			await expect(page.locator('body')).toBeVisible();
		});
	},
	gotoSettingsTab: async ({ page, baseURL }, use) => {
		await use(async (label: string) => {
			await page.goto(`${baseURL ?? ''}/settings`);
			await page.getByRole('button', { name: label }).click();
		});
	}
});

export { expect };
