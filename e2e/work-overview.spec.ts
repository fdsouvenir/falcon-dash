import { expect, test } from './fixtures';

const workDestinations = [
	{ path: '/work', heading: 'Mission Control' },
	{ path: '/work/projects', heading: 'Projects' },
	{ path: '/work/needs-resolution', heading: 'Needs Resolution' },
	{ path: '/work/automata', heading: 'Automata' },
	{ path: '/work/browse', heading: 'Browse' }
] as const;

test.describe('Work v3 cutover', () => {
	test('renders Mission Control with the operator queue and v3 navigation', async ({
		page,
		baseURL
	}) => {
		const response = await page.goto(`${baseURL ?? ''}/work`);

		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle('Mission Control — Work v3');
		await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible();

		for (const destination of workDestinations) {
			await expect(page.getByRole('link', { name: destination.heading }).first()).toBeVisible();
		}

		for (const bucket of [
			'Needs Fred',
			'Blocked risk',
			'Governance',
			'Awaiting Review',
			'Needs Authorization / Verification',
			'Waiting',
			'Agent can act',
			'Automation health',
			'Reconciliation',
			'Material recent changes'
		]) {
			await expect(page.getByRole('heading', { name: bucket, exact: true })).toBeVisible();
		}

		for (const summary of ['Needs your call', 'At risk']) {
			await expect(page.getByText(summary, { exact: true })).toBeVisible();
		}
		await expect(page.getByRole('tab', { name: /Agent/ })).toBeVisible();
		await expect(page.getByRole('tab', { name: /External/ })).toBeVisible();
	});

	test('serves every primary Work v3 destination', async ({ page, baseURL }) => {
		for (const destination of workDestinations) {
			const response = await page.goto(`${baseURL ?? ''}${destination.path}`);

			expect(response?.status(), destination.path).toBe(200);
			await expect(
				page.getByRole('heading', { name: destination.heading, exact: true })
			).toBeVisible();
		}
	});

	test('keeps Browse search-only and agent-driven', async ({ page, baseURL }) => {
		await page.goto(`${baseURL ?? ''}/work/browse`);

		await expect(page.getByRole('textbox', { name: 'Search terms' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'New Task' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'New Area' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'All indexed Work' })).toBeVisible();

		await page.goto(`${baseURL ?? ''}/work/browse?type=task`);
		await expect(page.getByRole('navigation', { name: 'Focus filters' })).toBeVisible();
		for (const focus of ['All', 'Overdue', 'Blocked', 'Waiting on you', 'In review', 'Ready']) {
			await expect(page.getByRole('link', { name: new RegExp(`^${focus}`) })).toBeVisible();
		}
	});

	test('reports version 3 health and keeps the v2 Work API retired', async ({ request }) => {
		const healthResponse = await request.get('/api/health');
		expect(healthResponse.ok()).toBe(true);
		expect(await healthResponse.json()).toMatchObject({
			status: 'ok',
			version: '3.0.0',
			work3: { status: 'ok' }
		});

		const retiredApiResponse = await request.get('/api/work/queue');
		expect(retiredApiResponse.status()).toBe(404);
	});

	test('keeps Work v3 usable at mobile width', async ({ page, baseURL }, testInfo) => {
		test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only Work assertion');

		await page.goto(`${baseURL ?? ''}/work`);

		await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible();
		for (const destination of workDestinations) {
			await expect(page.getByRole('link', { name: destination.heading }).first()).toBeVisible();
		}

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1
		);
		expect(hasHorizontalOverflow).toBe(false);
	});
});
