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
			'Agent can act',
			'Blocked risk',
			'Waiting on agent',
			'Waiting on external',
			'Awaiting Review',
			'Changes: authorization / verification',
			'Automation health',
			'Reconciliation'
		]) {
			await expect(page.getByRole('heading', { name: bucket })).toBeVisible();
		}

		await expect(page.getByText('Material recent changes')).toBeVisible();
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

	test('exposes v3 capture and search affordances on Browse', async ({ page, baseURL }) => {
		await page.goto(`${baseURL ?? ''}/work/browse`);

		await expect(page.getByPlaceholder('Search all Work…')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'New Task' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'New Area' })).toBeVisible();
		await expect(page.getByText(/^Tasks \(0\)$/)).toBeVisible();
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
