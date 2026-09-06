import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const owner = 'owner@fixture.invalid';
async function openModule(page: Page, name: string) {
	await page.goto('/');
	const destination = page
		.locator('openclaw-plugin-contributions')
		.getByRole('link', { name, exact: true })
		.first();
	const backToApp = page.getByRole('button', { name: 'Back to app', exact: true });
	await expect
		.poll(async () => (await destination.count()) > 0 || (await backToApp.count()) > 0, {
			timeout: 60000
		})
		.toBeTruthy();
	if (await backToApp.count()) {
		if (await backToApp.isVisible()) await backToApp.click();
		else await page.keyboard.press('Escape');
	}
	await destination.waitFor({ state: 'attached', timeout: 60000 });
	if (!(await destination.isVisible())) await page.keyboard.press('Control+b');
	await expect(destination).toBeVisible({ timeout: 60000 });
	await destination.click();
	await expect(
		page.locator('.falcon-native').getByRole('heading', { name, exact: true })
	).toBeVisible();
	await expect(page.locator('.falcon-native').first()).not.toHaveAttribute('aria-busy', 'true');
}
async function capture(page: Page, name: string, project: string) {
	const dir = 'artifacts/plugin-v4/native-screenshots';
	fs.mkdirSync(dir, { recursive: true });
	await page.screenshot({
		path: path.join(dir, `${project}-${name}.png`),
		fullPage: true,
		mask: [page.locator('[data-secret]')]
	});
	const layout = await page
		.locator('.falcon-native')
		.first()
		.evaluate((element) => ({
			scrollWidth: element.scrollWidth,
			clientWidth: element.clientWidth
		}));
	expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
}
async function unlock(page: Page) {
	const unlock = page
		.locator('.falcon-native')
		.getByRole('button', { name: 'Unlock', exact: true });
	if (await unlock.isVisible()) await unlock.click();
	await expect(
		page.locator('.falcon-native').getByRole('button', { name: 'Add credential', exact: true })
	).toBeVisible();
}
test.afterEach(async ({ page, request }, info) => {
	if (info.status !== info.expectedStatus) {
		const dir = 'artifacts/plugin-v4/native-screenshots';
		fs.mkdirSync(dir, { recursive: true });
		await page
			.screenshot({
				path: path.join(
					dir,
					`${info.project.name}-failure-${info.title.replace(/[^a-z0-9]/gi, '-')}.png`
				),
				fullPage: true,
				mask: [page.locator('[data-secret]')]
			})
			.catch(() => {});
	}
	await request.post('/__fixture/reconnect');
	await request.post('/__fixture/identity', { data: { email: owner } });
});
test('real Gateway native Work renders and commits schema-backed edits', async ({ page }, info) => {
	await openModule(page, 'Work');
	await capture(page, 'work-attention', info.project.name);
	await page
		.locator('.falcon-native')
		.getByRole('button', { name: 'Create work', exact: true })
		.click();
	let dialog = page.locator('openclaw-modal-dialog');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	dialog = page.locator('openclaw-modal-dialog');
	await dialog
		.getByLabel('Title *', { exact: true })
		.fill(`Native acceptance ${info.project.name}`);
	await dialog
		.getByLabel('Description *', { exact: true })
		.fill('Created by the actual signed-in native page.');
	await dialog
		.getByLabel('Done When *', { exact: true })
		.fill('The real Gateway stores this Task and it remains after reload.');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('openclaw-modal-dialog')).toHaveCount(0);
	await page.locator('.falcon-native').getByRole('button', { name: 'Browse', exact: true }).click();
	await page
		.locator('.falcon-native')
		.getByLabel('Search work')
		.fill(`Native acceptance ${info.project.name}`);
	await page.locator('.falcon-native').getByLabel('Search work').press('Tab');
	await expect(
		page.locator('.record').filter({ hasText: `Native acceptance ${info.project.name}` })
	).toBeVisible();
	await page
		.locator('.record')
		.filter({ hasText: `Native acceptance ${info.project.name}` })
		.click();
	await capture(page, 'task-detail', info.project.name);
	await page.reload();
	await expect(page.locator('.falcon-native')).toBeVisible();
	await openModule(page, 'Work');
	await page.locator('.falcon-native').getByRole('button', { name: 'Browse', exact: true }).click();
	await page.getByLabel('Search work').fill(`Native acceptance ${info.project.name}`);
	await page.getByLabel('Search work').press('Tab');
	await expect(
		page.locator('.record').filter({ hasText: `Native acceptance ${info.project.name}` })
	).toBeVisible();
	await page
		.locator('.record')
		.filter({ hasText: `Native acceptance ${info.project.name}` })
		.click();
	await expect(page.locator('.falcon-native')).toContainText(
		'The real Gateway stores this Task and it remains after reload.'
	);
});
test('real native Vault supports protected owner entry and agent-created reveal copy cleanup', async ({
	page,
	request
}, info) => {
	await openModule(page, 'Vault');
	await unlock(page);
	await page.getByRole('button', { name: 'Add credential', exact: true }).click();
	const dialog = page.locator('openclaw-modal-dialog');
	await dialog.getByLabel('Entry path', { exact: true }).fill(`owner-${info.project.name}`);
	await dialog.getByLabel('Protected value', { exact: true }).fill('SYNTHETIC-HUMAN-UI-CANARY');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('openclaw-modal-dialog')).toHaveCount(0);
	await openModule(page, 'Vault');
	await unlock(page);
	const human = page.locator('.list-zone').filter({
		has: page.getByRole('heading', { name: `owner-${info.project.name}`, exact: true })
	});
	await human.getByRole('button', { name: 'Reveal', exact: true }).click();
	await expect(human.locator('output')).toHaveText('SYNTHETIC-HUMAN-UI-CANARY');
	await human.getByRole('button', { name: 'Copy', exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => navigator.clipboard.readText()))
		.toBe('SYNTHETIC-HUMAN-UI-CANARY');
	await human.getByRole('button', { name: 'Hide', exact: true }).click();
	await expect(human.locator('output')).toHaveText('');
	const agent = page
		.locator('.list-zone')
		.filter({ has: page.getByRole('heading', { name: 'agent-created', exact: true }) });
	await agent.getByRole('button', { name: 'Reveal', exact: true }).click();
	await expect(agent.locator('output')).toHaveText('SYNTHETIC-AGENT-UI-CANARY');
	await agent.getByRole('button', { name: 'Copy', exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => navigator.clipboard.readText()))
		.toBe('SYNTHETIC-AGENT-UI-CANARY');
	await agent.getByRole('button', { name: 'Hide', exact: true }).click();
	await expect(agent.locator('output')).toHaveText('');
	await capture(page, 'vault-masked', info.project.name);
	await agent.getByRole('button', { name: 'Reveal', exact: true }).click();
	await expect(agent.locator('output')).toHaveText('SYNTHETIC-AGENT-UI-CANARY');
	await request.post('/__fixture/lock');
	await expect(page.locator('.falcon-native')).not.toContainText('SYNTHETIC-AGENT-UI-CANARY');
	await expect(page.getByRole('button', { name: 'Unlock', exact: true })).toBeVisible();
});
test('native Documents saves through the Gateway and preserves stale edits', async ({
	page,
	request
}, info) => {
	await openModule(page, 'Documents');
	await page
		.locator('.falcon-native')
		.getByRole('button', { name: 'workspace', exact: true })
		.click();
	await page.locator('.record').filter({ hasText: 'Operating notes.md' }).click();
	const editor = page.getByLabel('Document content', { exact: true });
	await editor.fill(`# My preserved draft ${info.project.name}\nReview this before saving.\n`);
	await request.post('/__fixture/document');
	await page.locator('.falcon-native').getByRole('button', { name: 'Save', exact: true }).click();
	await expect(editor).toHaveValue(new RegExp(`My preserved draft ${info.project.name}`));
	await expect(page.locator('.falcon-native [role=alert]')).toBeVisible();
	await page.getByRole('button', { name: 'Compare latest version', exact: true }).click();
	await expect(page.locator('.falcon-native')).toContainText('Changed by another writer');
	await page.getByRole('button', { name: 'Use latest version for next save', exact: true }).click();
	await page.getByRole('button', { name: 'Rename', exact: true }).click();
	const rename = page.locator('openclaw-modal-dialog');
	await rename
		.getByLabel('Destination', { exact: true })
		.fill(`Renamed notes ${info.project.name}.md`);
	await rename.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(rename).toHaveCount(0);
	await expect(editor).toHaveValue(new RegExp(`My preserved draft ${info.project.name}`));
	await capture(page, 'documents-dirty-rename', info.project.name);
	await page.locator('.falcon-native').getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('.falcon-native')).toContainText('Text view');
	await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
	await expect(
		page
			.frameLocator('iframe.document-preview')
			.getByRole('heading', { name: `My preserved draft ${info.project.name}` })
	).toBeVisible();
	await capture(page, 'documents-editor', info.project.name);
	await page.getByRole('button', { name: 'Rename', exact: true }).click();
	await page
		.locator('openclaw-modal-dialog')
		.getByLabel('Destination', { exact: true })
		.fill('Operating notes.md');
	await page
		.locator('openclaw-modal-dialog')
		.getByRole('button', { name: 'Save', exact: true })
		.click();
	await expect(page.locator('openclaw-modal-dialog')).toHaveCount(0);
	await openModule(page, 'Documents');
	await page
		.locator('.falcon-native')
		.getByRole('button', { name: 'workspace', exact: true })
		.click();
	await page.locator('.record').filter({ hasText: 'Operating notes.md' }).click();
	await expect(editor).toHaveValue(new RegExp(`My preserved draft ${info.project.name}`));
});
test('native Integrations performs real persisted maintenance controls without contacting live providers', async ({
	page
}, info) => {
	await openModule(page, 'Integrations');
	const connection = page
		.locator('.list-zone')
		.filter({ hasText: 'Synthetic connection — not live authentication' });
	await expect(connection).toBeVisible();
	await expect(
		connection
			.locator('dt')
			.filter({ hasText: /^Paused$/ })
			.locator('+ dd')
	).toHaveText('true');
	await connection.getByRole('button', { name: 'Resume maintenance', exact: true }).click();
	await expect(
		connection
			.locator('dt')
			.filter({ hasText: /^Paused$/ })
			.locator('+ dd')
	).toHaveText('false');
	await openModule(page, 'Integrations');
	await expect(
		connection
			.locator('dt')
			.filter({ hasText: /^Paused$/ })
			.locator('+ dd')
	).toHaveText('false');
	await expect(page.locator('.falcon-native').first()).not.toHaveAttribute('aria-busy', 'true');
	await connection.getByRole('button', { name: 'Pause maintenance', exact: true }).click();
	await expect(
		connection
			.locator('dt')
			.filter({ hasText: /^Paused$/ })
			.locator('+ dd')
	).toHaveText('true');
	await openModule(page, 'Integrations');
	await expect(
		connection
			.locator('dt')
			.filter({ hasText: /^Paused$/ })
			.locator('+ dd')
	).toHaveText('true');
	await capture(page, 'integrations', info.project.name);
});
test('real transport disconnect clears revealed values and reconnect recovers native reads', async ({
	page,
	request
}, info) => {
	await openModule(page, 'Vault');
	await unlock(page);
	const agent = page
		.locator('.list-zone')
		.filter({ has: page.getByRole('heading', { name: 'agent-created', exact: true }) });
	await agent.getByRole('button', { name: 'Reveal', exact: true }).click();
	await expect(agent.locator('output')).toHaveText('SYNTHETIC-AGENT-UI-CANARY');
	await request.post('/__fixture/disconnect');
	await expect(page.locator('body')).not.toContainText('SYNTHETIC-AGENT-UI-CANARY');
	await request.post('/__fixture/reconnect');
	await expect(
		page.locator('.falcon-native').getByRole('button', { name: 'Add credential', exact: true })
	).toBeVisible({ timeout: 60000 });
	await capture(page, 'reconnected-vault', info.project.name);
});
test('a different authenticated person cannot reveal the owner Vault', async ({
	page,
	request
}, info) => {
	await request.post('/__fixture/identity', { data: { email: 'intruder@fixture.invalid' } });
	await openModule(page, 'Vault');
	await expect(page.locator('.falcon-native')).not.toContainText('SYNTHETIC');
	await expect(page.locator('.falcon-native [role=alert]')).toBeVisible();
	await capture(page, 'vault-denied', info.project.name);
});
test('Custom plugin UI off provides guidance instead of enabling native code', async ({
	page,
	request
}, info) => {
	await request.post('/__fixture/ui', { data: { enabled: false } });
	try {
		await page.goto('/plugins/falcon-dash/work');
		await expect(page.getByText(/Custom plugin UI/)).toBeVisible();
		await expect(page.locator('.falcon-native')).toHaveCount(0);
		const dir = 'artifacts/plugin-v4/native-screenshots';
		fs.mkdirSync(dir, { recursive: true });
		await page.screenshot({
			path: path.join(dir, `${info.project.name}-opt-in-off.png`),
			fullPage: true
		});
	} finally {
		await request.post('/__fixture/ui', { data: { enabled: true } });
	}
});
test('Project Milestone Decision and Ask details use the real canonical records', async ({
	page
}, info) => {
	await openModule(page, 'Work');
	const app = page.locator('.falcon-native');
	await app.getByRole('button', { name: 'Projects', exact: true }).click();
	await page
		.locator('.record')
		.filter({ hasText: 'Deliver the quarterly operations review' })
		.click();
	await capture(page, 'project-detail', info.project.name);
	await page.locator('.record').filter({ hasText: 'Review accepted' }).click();
	await expect(app).toContainText('The owner accepts the complete review.');
	await capture(page, 'milestone-detail', info.project.name);
	await app.getByRole('button', { name: 'Browse', exact: true }).click();
	await app.getByLabel('Work type', { exact: true }).selectOption('decision');
	await page.locator('.record').filter({ hasText: 'Choose the review window' }).click();
	await expect(app).toContainText('Morning review');
	await expect(app).toContainText('The final review cannot be scheduled.');
	await capture(page, 'decision-detail', info.project.name);
	await app.getByRole('button', { name: 'Browse', exact: true }).click();
	await app.getByLabel('Work type', { exact: true }).selectOption('task');
	await page.locator('.record').filter({ hasText: 'Review the migration plan' }).click();
	await expect(app).toContainText('Please review the completion criteria.');
	await capture(page, 'ask-detail', info.project.name);
	await app.getByRole('button', { name: 'Open conversation', exact: true }).click();
	await expect(page.getByText('Review follow-up', { exact: true }).first()).toBeVisible();
});
