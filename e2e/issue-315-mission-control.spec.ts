import { expect, test } from './fixtures';

test.describe('issue #315 mission control homepage', () => {
	test('renders the mission control operator surface', async ({ gotoHome, page }) => {
		await gotoHome();

		await expect(page.getByText('Mission Control')).toBeVisible();
		await expect(
			page.getByRole('heading', {
				name: /operate agents, repair chat, and clear blockers from one surface/i
			})
		).toBeVisible();
		await expect(page.getByRole('heading', { name: /agent overview/i })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: /high-value operator workflows/i })
		).toBeVisible();
		await expect(page.getByText('Requests waiting for operator action')).toBeVisible();
		await expect(page.getByText('Configured operators')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
	});
});
