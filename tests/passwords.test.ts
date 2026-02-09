import { expect, test } from '@playwright/test';
import { loadPage } from './helpers';

test.describe('passwords page', () => {
	test('renders a vault state', async ({ page }) => {
		await loadPage(page, '/passwords');
		const checking = page.getByText('Checking vault status...');
		const unavailable = page.getByText('Password Vault Unavailable');
		const create = page.getByText('Create Password Vault');
		const locked = page.getByText('Vault Locked');
		await expect(checking.or(unavailable).or(create).or(locked)).toBeVisible();
	});

	test('unavailable state shows recheck', async ({ page }) => {
		await loadPage(page, '/passwords');
		const unavailable = page.getByText('Password Vault Unavailable');
		if (await unavailable.isVisible({ timeout: 3000 }).catch(() => false)) {
			await expect(page.getByText('keepassxc-cli')).toBeVisible();
			await expect(page.getByRole('button', { name: 'Recheck' })).toBeVisible();
		}
	});

	test('first-run state shows create form', async ({ page }) => {
		await loadPage(page, '/passwords');
		const create = page.getByText('Create Password Vault');
		if (await create.isVisible({ timeout: 3000 }).catch(() => false)) {
			await expect(page.locator('#init-password')).toBeVisible();
			await expect(page.locator('#init-confirm')).toBeVisible();
			await expect(page.getByRole('button', { name: 'Create Vault' })).toBeVisible();
		}
	});

	test('locked state shows unlock form', async ({ page }) => {
		await loadPage(page, '/passwords');
		const locked = page.getByText('Vault Locked');
		if (await locked.isVisible({ timeout: 3000 }).catch(() => false)) {
			await expect(page.locator('#unlock-password')).toBeVisible();
			await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible();
		}
	});
});
