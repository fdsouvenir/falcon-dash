import type { APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';

type SeededWorkItem = {
	id: number;
	title: string;
};

function isoDaysFromNow(days: number): string {
	const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
	return date.toISOString();
}

async function createWorkItem(
	request: APIRequestContext,
	body: Record<string, unknown>
): Promise<SeededWorkItem> {
	const response = await request.post('/api/work/items', {
		data: {
			owner: 'agent',
			priority: 'normal',
			actor: 'playwright',
			...body
		}
	});
	expect(response.ok()).toBe(true);
	return (await response.json()) as SeededWorkItem;
}

async function seedExecutiveOverview(request: APIRequestContext) {
	const stamp = Date.now();
	const items: SeededWorkItem[] = [];
	const project = await createWorkItem(request, {
		type: 'project',
		title: `E2E executive project ${stamp}`,
		description: 'A seeded outcome for overview workflow checks.',
		status: 'in_progress',
		due_date: isoDaysFromNow(5),
		next_action: 'Clear the seeded blocker'
	});
	items.push(project);

	const question = await createWorkItem(request, {
		type: 'decision',
		parent_item_id: project.id,
		title: `E2E choose launch path ${stamp}`,
		status: 'needs_review',
		waiting_on: 'operator',
		next_action: 'Pick the launch path'
	});
	items.push(question);

	const blockedChange = await createWorkItem(request, {
		type: 'change',
		parent_item_id: project.id,
		title: `E2E unblock provider access ${stamp}`,
		status: 'blocked',
		priority: 'urgent',
		waiting_on: 'external',
		next_action: 'Wait for provider support'
	});
	items.push(blockedChange);

	items.push(
		await createWorkItem(request, {
			type: 'task',
			parent_item_id: project.id,
			title: `E2E send stakeholder brief ${stamp}`,
			status: 'ready',
			due_date: isoDaysFromNow(1),
			next_action: 'Send the brief'
		})
	);

	items.push(
		await createWorkItem(request, {
			type: 'routine',
			parent_item_id: project.id,
			title: `E2E run readiness sweep ${stamp}`,
			status: 'scheduled',
			scheduled_at: isoDaysFromNow(2),
			next_action: 'Run the readiness sweep'
		})
	);

	return { project, question, blockedChange, items };
}

async function archiveWorkItems(request: APIRequestContext, items: SeededWorkItem[]) {
	await Promise.all(
		items.map((item) =>
			request.patch(`/api/work/items/${item.id}`, {
				data: { status: 'archived', actor: 'playwright' }
			})
		)
	);
}

test.describe('work overview executive status board', () => {
	test.describe.configure({ mode: 'serial' });

	test('routes aggregate signals to overview sections instead of arbitrary item details', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedExecutiveOverview(request);
		try {
			await page.goto(`${baseURL ?? ''}/work`);

			const signals = [
				['overview-signal-needs-you', '#needs-you', 'needs-you-section'],
				['overview-signal-at-risk', '#at-risk', 'at-risk-section'],
				['overview-signal-due-next', '#due-next', 'due-next-section'],
				['overview-signal-recent', '#recent', 'recent-section']
			] as const;

			for (const [signalId, hash, sectionId] of signals) {
				const signal = page.getByTestId(signalId);
				await expect(signal).toHaveAttribute('href', new RegExp(`/work${hash}$`));
				await signal.click();
				await expect.poll(() => new URL(page.url()).pathname).toBe('/work');
				await expect.poll(() => new URL(page.url()).hash).toBe(hash);
				await expect(page.getByTestId(sectionId)).toBeInViewport();
			}
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('opens a specific project detail from the project health row', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedExecutiveOverview(request);
		try {
			await page.goto(`${baseURL ?? ''}/work`);

			const row = page
				.getByTestId('project-health-row')
				.filter({ hasText: seeded.project.title })
				.first();
			await expect(row).toBeVisible();
			await expect(row).toContainText(/Blocked|Needs attention|On track|No date/);
			await expect(row).toContainText(/task|question|change/);
			await expect(row).not.toContainText(/\blinked\b/i);
			await expect(row).toHaveAttribute('href', new RegExp(`/work/projects/${seeded.project.id}$`));

			await row.click();
			await expect(page).toHaveURL(new RegExp(`/work/projects/${seeded.project.id}$`));
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('routes top Work search to read-only results and hides capture', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedExecutiveOverview(request);
		try {
			await page.goto(`${baseURL ?? ''}/work`);

			await expect(page.getByRole('button', { name: 'Capture work' })).toHaveCount(0);

			const search = page.getByPlaceholder('Search work...');
			await expect(search).toBeVisible();
			await search.fill(seeded.question.title);
			await search.press('Enter');

			await expect(page).toHaveURL(/\/work\/search\?q=/);
			await expect(page.getByRole('heading', { name: /Results for/ })).toBeVisible();
			await expect(page.getByTestId('work-search-results')).toContainText(seeded.question.title);

			await page.getByTestId('work-search-results').getByText(seeded.question.title).click();
			await expect(page).toHaveURL(new RegExp(`/work/decisions/${seeded.question.id}$`));
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('uses section rows for quick inspection and opens a standalone detail page', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedExecutiveOverview(request);
		try {
			await page.goto(`${baseURL ?? ''}/work/projects`);

			const row = page
				.getByTestId('work-section-row')
				.filter({ hasText: seeded.project.title })
				.first();
			await expect(row).toBeVisible();
			await row.click();

			await expect.poll(() => new URL(page.url()).pathname).toBe('/work/projects');
			await expect(row).toHaveAttribute('aria-pressed', 'true');
			await expect(page.getByTestId('work-quick-state')).toBeVisible();
			await expect(page.getByTestId('work-quick-state').locator('input, textarea')).toHaveCount(0);

			const openFullPage = page.getByRole('link', { name: 'Open full page' });
			await expect(openFullPage).toHaveAttribute(
				'href',
				new RegExp(`/work/projects/${seeded.project.id}$`)
			);
			await openFullPage.click();

			await expect(page).toHaveURL(new RegExp(`/work/projects/${seeded.project.id}$`));
			await expect(page.getByTestId('work-detail-page')).toBeVisible();
			await expect(page.getByPlaceholder('Search projects...')).toHaveCount(0);
			await expect(page.getByRole('heading', { name: 'Blockers' })).toBeVisible();
			await expect(
				page.getByRole('link').filter({ hasText: seeded.blockedChange.title }).first()
			).toBeVisible();
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('shows recent activity as one chronological log with clear labels', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedExecutiveOverview(request);
		try {
			await page.goto(`${baseURL ?? ''}/work`);

			await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
			await expect(page.getByTestId('recent-activity-list')).toHaveCount(1);
			await expect(page.getByTestId('recent-activity-list')).toContainText(seeded.question.title);
			await expect(page.getByText(/\blinked\b/i)).toHaveCount(0);
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});
});
