import { test } from './fixtures';

test.describe('issue #276 device pairing approval workflow', () => {
	test.fixme('should surface pending CLI pairing requests in Settings > Devices and allow approval', async ({
		gotoSettingsTab,
		page
	}) => {
		await gotoSettingsTab('Devices');

		await page.getByText('Pending Pairing Requests').waitFor();
		await page.getByRole('button', { name: 'Approve' }).click();
	});
});
