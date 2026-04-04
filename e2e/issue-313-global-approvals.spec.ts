import { expect, test } from './fixtures';

test.describe('issue #313 global approvals queue', () => {
	test('renders a dedicated approvals queue surface', async ({ page, baseURL }) => {
		await page.goto(`${baseURL ?? ''}/approvals`);

		await expect(page.getByRole('heading', { name: /global approvals/i })).toBeVisible();
		await expect(page.getByText('All agents and sessions')).toBeVisible();

		const emptyState = page.getByText(
			/No pending approvals|Connect to the gateway to review approvals\./
		);
		const actionButton = page
			.getByRole('button', { name: /Allow once|Allow always|Deny|Always deny/i })
			.first();
		const [emptyCount, actionCount] = await Promise.all([emptyState.count(), actionButton.count()]);

		expect(emptyCount + actionCount).toBeGreaterThan(0);
	});
});
