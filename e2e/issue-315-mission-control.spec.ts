import { expect, test } from './fixtures';

test.describe('issue #315 mission control homepage', () => {
	test('renders the operator dashboard surface', async ({ gotoHome, page }) => {
		await gotoHome();

		await expect(
			page.getByRole('heading', { name: /gateway, agents, channels, and approvals/i })
		).toBeVisible();
		await expect(page.getByText('Operator Dashboard')).toBeVisible();
		await expect(page.getByRole('heading', { name: /configured operators/i })).toBeVisible();
		await expect(
			page.getByRole('heading', {
				name: /approval queue unavailable|queue is clear|queue needs attention/i
			})
		).toBeVisible();
		await expect(
			page.getByRole('heading', {
				name: /channels unavailable|channels ready|channels need attention/i
			})
		).toBeVisible();
		await expect(page.getByRole('heading', { name: /open a workspace/i })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
		await expect(page.getByText('Mission Control')).toHaveCount(0);
		await expect(page.getByText(/high-value operator workflows/i)).toHaveCount(0);
	});

	test('stays usable at mobile width', async ({ gotoHome, page }) => {
		test.skip(test.info().project.name !== 'mobile-chrome', 'Mobile layout assertion only');

		await gotoHome();

		await expect(
			page.getByRole('heading', { name: /gateway, agents, channels, and approvals/i })
		).toBeVisible();
		await expect(page.getByRole('heading', { name: /configured operators/i })).toBeVisible();
		await expect(page.getByRole('heading', { name: /open a workspace/i })).toBeVisible();

		const hasHorizontalOverflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > window.innerWidth + 1;
		});

		expect(hasHorizontalOverflow).toBe(false);
	});
});
