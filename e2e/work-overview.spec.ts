import { expect, test } from './fixtures';

const workDestinations = [
	{ path: '/work', heading: 'Work' },
	{ path: '/work/projects', heading: 'Projects' },
	{ path: '/work/needs-resolution', heading: 'Needs Resolution' },
	{ path: '/work/automations', heading: 'Automations' },
	{ path: '/work/browse', heading: 'Browse' }
] as const;

test.describe('Work v3 cutover', () => {
	test('renders the Work overview inbox with the operator queue and v3 navigation', async ({
		page,
		baseURL
	}) => {
		const response = await page.goto(`${baseURL ?? ''}/work`);

		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle('Work — Falcon Dash');
		await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();

		for (const destination of workDestinations) {
			await expect(page.getByRole('link', { name: destination.heading }).first()).toBeVisible();
		}

		for (const heading of [
			'Due next',
			'Needs your call',
			'At risk and waiting',
			'Recent activity'
		]) {
			await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
		}

		// KPI strip: four signal tiles anchoring to page sections.
		const statTiles = page.locator('[data-work-stat-tile]');
		await expect(statTiles).toHaveCount(4);
		await statTiles.filter({ hasText: 'Due next' }).click();
		await expect(page).toHaveURL(/#due-next$/);

		// Due-next band keeps its four windows even when empty.
		for (const window of ['Today', 'This week', 'Next week', 'Later']) {
			await expect(page.getByRole('heading', { name: window, exact: true })).toBeVisible();
		}

		// Label rails: Review and Authorization stay separately labeled groups.
		await expect(page.getByRole('heading', { name: 'Plan reviews' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Authorization / verification' })).toBeVisible();
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
		const focusFilters = page.getByRole('navigation', { name: 'Focus filters' });
		await expect(focusFilters).toBeVisible();
		for (const focus of ['All', 'Overdue', 'Blocked', 'Waiting on you', 'In review', 'Ready']) {
			await expect(focusFilters.getByRole('link', { name: new RegExp(`^${focus}`) })).toBeVisible();
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
		await page.setViewportSize({ width: 390, height: 844 });

		for (const destination of workDestinations) {
			const response = await page.goto(`${baseURL ?? ''}${destination.path}`);
			expect(response?.status(), destination.path).toBe(200);
			await expect(
				page.getByRole('heading', { name: destination.heading, exact: true })
			).toBeVisible();

			const hasHorizontalOverflow = await page.evaluate(
				() => document.documentElement.scrollWidth > window.innerWidth + 1
			);
			expect(hasHorizontalOverflow, destination.path).toBe(false);
		}

		await page.goto(`${baseURL ?? ''}/work/browse`);
		const search = await page.getByRole('textbox', { name: 'Search terms' }).boundingBox();
		const submit = await page.getByRole('button', { name: 'Search' }).boundingBox();
		expect(search?.height).toBeGreaterThanOrEqual(48);
		expect(submit?.height).toBeGreaterThanOrEqual(48);
	});
});
