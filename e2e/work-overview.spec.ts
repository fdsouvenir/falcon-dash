import type { APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

type SeededWorkItem = {
	id: number;
	title: string;
};

type SeededWorkCategory = {
	id: string;
	title: string;
};

const packageVersion = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
) as { version: string };

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
			...defaultTypedFields(body),
			...body
		}
	});
	expect(response.ok()).toBe(true);
	return (await response.json()) as SeededWorkItem;
}

async function createWorkCategory(
	request: APIRequestContext,
	body: Record<string, unknown>
): Promise<SeededWorkCategory> {
	const response = await request.post('/api/work/categories', {
		data: {
			status: 'active',
			...body
		}
	});
	expect(response.ok()).toBe(true);
	return (await response.json()) as SeededWorkCategory;
}

function defaultTypedFields(body: Record<string, unknown>): Record<string, unknown> {
	if (body.type === 'decision') {
		return {
			decision_question: body.title,
			options: ['Approve', 'Defer'],
			recommended_option: body.next_action ?? 'Approve',
			consequence_of_no_decision: 'Related work remains waiting.'
		};
	}
	if (body.type === 'open_question') {
		return {
			question_text: body.title,
			why_it_matters: 'The answer changes the next step.',
			answerer: body.waiting_on ?? 'operator'
		};
	}
	if (body.type === 'change_request') {
		return {
			change_scope: body.description ?? body.title,
			risk: body.priority ?? 'normal',
			verification_plan: body.next_action ?? 'Verify the change request.'
		};
	}
	if (body.type === 'automation') {
		return {
			trigger_type: 'heartbeat',
			schedule: body.scheduled_at
		};
	}
	return {};
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
		type: 'change_request',
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
			type: 'next_step',
			parent_item_id: project.id,
			title: `E2E send stakeholder brief ${stamp}`,
			status: 'ready',
			due_date: isoDaysFromNow(1),
			next_action: 'Send the brief'
		})
	);

	items.push(
		await createWorkItem(request, {
			type: 'automation',
			parent_item_id: project.id,
			title: `E2E run readiness sweep ${stamp}`,
			status: 'scheduled',
			scheduled_at: isoDaysFromNow(2),
			next_action: 'Run the readiness sweep'
		})
	);

	return { project, question, blockedChange, items };
}

async function seedUrgentOverdueProject(request: APIRequestContext) {
	const stamp = Date.now();
	const items: SeededWorkItem[] = [];
	const project = await createWorkItem(request, {
		type: 'project',
		title: `E2E urgent overdue project ${stamp}`,
		description: 'An urgent project that should not be its own blocker.',
		status: 'in_progress',
		priority: 'urgent',
		due_date: isoDaysFromNow(-10),
		next_action: 'Review the overdue project state'
	});
	items.push(project);

	items.push(
		await createWorkItem(request, {
			type: 'decision',
			parent_item_id: project.id,
			title: `E2E overdue project decision ${stamp}`,
			status: 'needs_review',
			waiting_on: 'operator',
			next_action: 'Decide whether to reset the launch date'
		})
	);

	return { project, items };
}

async function seedLongQuestion(request: APIRequestContext) {
	const stamp = Date.now();
	const question = await createWorkItem(request, {
		type: 'open_question',
		title: `E2E long question brief ${stamp}`,
		status: 'needs_review',
		waiting_on: 'operator',
		next_action: 'Approve the safe internal workspace setup path',
		body: `## Objective
Set up the internal workspace as the operating control room.

## Current Verified State
- The agency token exists.
- The internal location has reusable workflows.

## Approval Gate
Execution requires approval before any write batch.

## Legacy Version History
- v1 planning notes that should not dominate the first screen.`
	});

	return { question, items: [question] };
}

async function seedScrollableProjects(request: APIRequestContext) {
	const stamp = Date.now();
	const items: SeededWorkItem[] = [];
	const target = await createWorkItem(request, {
		type: 'project',
		title: `E2E lower selected project ${stamp}`,
		description: 'A project created first so later seeded rows push it lower in the list.',
		status: 'in_progress',
		next_action: 'Inspect this lower project without losing the quick detail pane'
	});
	items.push(target);

	for (let index = 0; index < 10; index += 1) {
		items.push(
			await createWorkItem(request, {
				type: 'project',
				title: `E2E scroll filler project ${stamp}-${index}`,
				description: 'A filler project that gives the section list enough height to scroll.',
				status: 'in_progress',
				next_action: 'Keep the selected target below the first viewport'
			})
		);
	}

	return { target, items };
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

async function archiveWorkCategories(request: APIRequestContext, categories: SeededWorkCategory[]) {
	await Promise.all(
		categories.map((category) =>
			request.patch(`/api/work/categories/${category.id}`, {
				data: { status: 'archived' }
			})
		)
	);
}

test.describe('work overview executive status board', () => {
	test.describe.configure({ mode: 'serial' });

	test('uses Work as the home surface and keeps shell chrome focused', async ({
		page,
		baseURL
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(`${baseURL ?? ''}/`);

		await expect.poll(() => new URL(page.url()).pathname).toBe('/work');
		await expect(page.getByRole('navigation', { name: 'Falcon Dash modules' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Shell' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Work' }).first()).toBeVisible();
		await expect(page.getByText(`v${packageVersion.version}`, { exact: true })).toBeVisible();
		await expect(page.getByText(/Gateway:/)).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Run checks' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Help' })).toHaveCount(0);
	});

	test('removes Shell from mobile primary navigation', async ({ page, baseURL }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${baseURL ?? ''}/work`);

		await expect(page.getByRole('link', { name: 'Shell', exact: true })).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Work', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Vault', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Channels', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Labs', exact: true })).toBeVisible();
	});

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

			for (const removedPreview of [
				'Oldest waiting',
				'Highest risk',
				'Next due',
				'Latest update'
			]) {
				await expect(page.getByText(removedPreview, { exact: true })).toHaveCount(0);
			}
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('routes portfolio aggregates to filtered project lists', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedExecutiveOverview(request);
		try {
			await page.goto(`${baseURL ?? ''}/work`);

			await expect(page.getByTestId('project-portfolio')).toBeVisible();
			await expect(page.getByRole('heading', { name: 'Project portfolio' })).toBeVisible();
			await expect(page.getByRole('heading', { name: 'Project health' })).toHaveCount(0);
			await expect(page.getByTestId('project-health-row')).toHaveCount(0);
			await expect(page.getByText('Active outcomes', { exact: true })).toHaveCount(0);
			await expect(page.getByText('Projects blocked directly or by child work')).toHaveCount(0);

			const blockedMetric = page.getByTestId('project-portfolio-metric-blocked');
			await expect(blockedMetric).toHaveAttribute('href', /\/work\/projects\?focus=blocked$/);
			await blockedMetric.click();

			await expect(page).toHaveURL(/\/work\/projects\?focus=blocked$/);
			await expect(
				page.locator('button[aria-pressed="true"]').filter({ hasText: 'Blocked' })
			).toBeVisible();
			await expect(
				page.getByTestId('work-section-row').filter({ hasText: seeded.project.title }).first()
			).toBeVisible();

			const search = page.getByPlaceholder('Search projects...');
			await search.fill(seeded.project.title);
			await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(seeded.project.title);
			await page.reload();
			await expect(
				page.getByTestId('work-section-row').filter({ hasText: seeded.project.title }).first()
			).toBeVisible();
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('persists text size preferences and avoids overflow with larger text', async ({
		page,
		baseURL
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(`${baseURL ?? ''}/settings`);
		await page.getByRole('button', { name: 'Preferences' }).click();
		await expect(page.getByText('Text size', { exact: true })).toBeVisible();
		await expect(page.getByTestId('settings-preferences-panel')).toHaveAttribute(
			'data-hydrated',
			'true'
		);
		await page.getByRole('button', { name: /Extra large/ }).click();

		await expect(page.locator('html')).toHaveAttribute('data-text-size', 'extra-large');
		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('data-text-size', 'extra-large');

		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(`${baseURL ?? ''}/work`);
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
				)
			)
			.toBe(true);

		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${baseURL ?? ''}/work`);
		await expect(page.locator('html')).toHaveAttribute('data-text-size', 'extra-large');
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
				)
			)
			.toBe(true);
	});

	test('renders type-aware primary filters on section pages', async ({ page, baseURL }) => {
		const expectations = [
			['projects', ['Blocked', 'Overdue', 'Needs decision', 'No next move', 'Stale']],
			[
				'change-requests',
				['Needs approval', 'Waiting on you', 'Waiting on agent', 'Blocked', 'Recent']
			],
			[
				'open-questions',
				['Needs answer', 'Needs review', 'Waiting on agent', 'High impact', 'Answered']
			],
			[
				'decisions',
				['Needs decision', 'Needs review', 'Waiting on agent', 'High impact', 'Decided']
			],
			['next-steps', ['Due today', 'Due this week', 'Overdue', 'Blocked', 'Waiting']],
			['automations', ['Scheduled soon', 'Overdue run', 'Blocked', 'No cadence', 'Recent result']],
			['findings', ['Needs triage', 'Linked to work', 'Unlinked', 'Recent']]
		] as const;

		for (const [section, labels] of expectations) {
			await page.goto(`${baseURL ?? ''}/work/${section}`);
			for (const label of labels) {
				await expect(page.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
			}
			await expect(page.getByText('More', { exact: true })).toBeVisible();
		}
	});

	test('renders settings as a grouped directory with top-level category creation', async ({
		page,
		request,
		baseURL
	}) => {
		const stamp = Date.now();
		const category = await createWorkCategory(request, {
			kind: 'category',
			title: `E2E settings category ${stamp}`,
			description: 'A seeded category for settings directory coverage.'
		});
		const subcategory = await createWorkCategory(request, {
			kind: 'subcategory',
			parent_category_id: category.id,
			title: `E2E settings subcategory ${stamp}`,
			description: 'A seeded subcategory for settings directory coverage.'
		});

		try {
			await page.setViewportSize({ width: 1440, height: 900 });
			await page.goto(`${baseURL ?? ''}/work/settings`);

			await expect(page.getByTestId('work-settings-add-category')).toBeVisible();
			await expect(page.getByTestId('work-settings')).not.toContainText('Linked projects');
			await expect(page.getByTestId('work-settings-directory')).toContainText(category.title);
			await expect(page.getByTestId('work-settings-directory')).toContainText(subcategory.title);
			await expect(page.getByTestId('work-settings-directory')).not.toContainText(
				'Add subcategory'
			);

			await page.getByTestId('work-settings-add-category').click();
			await expect(page.getByTestId('work-settings-drawer')).toContainText('New category');
			await expect(page.getByTestId('work-settings-drawer').getByLabel('Name')).toBeVisible();

			await page.getByTestId('work-settings-directory').getByText(category.title).click();
			await expect(page.getByTestId('work-settings-drawer')).toContainText('Edit category');
			await expect(page.getByTestId('work-settings-drawer')).toContainText(category.title);
			await page.getByRole('button', { name: 'Add subcategory to this category' }).click();
			await expect(page.getByTestId('work-settings-drawer')).toContainText('New subcategory');
			await expect(page.getByTestId('work-settings-drawer')).toContainText(category.title);
			await expect(page.getByTestId('work-settings-drawer').getByLabel('Category')).toBeVisible();

			await page.getByTestId('work-settings-directory').getByText(subcategory.title).click();
			await expect(page.getByTestId('work-settings-drawer')).toContainText('Edit subcategory');
			await expect(page.getByTestId('work-settings-drawer')).toContainText(subcategory.title);
		} finally {
			await archiveWorkCategories(request, [subcategory, category]);
		}
	});

	test('routes top Work search to read-only results and hides capture', async ({
		page,
		request,
		baseURL
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
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
			await page.setViewportSize({ width: 1440, height: 720 });
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

	test('keeps desktop quick detail visible when selecting a scrolled list row', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedScrollableProjects(request);
		try {
			await page.setViewportSize({ width: 1440, height: 720 });
			await page.goto(`${baseURL ?? ''}/work/projects`);

			const row = page
				.getByTestId('work-section-row')
				.filter({ hasText: seeded.target.title })
				.first();
			await row.scrollIntoViewIfNeeded();
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
			await expect(page.getByRole('heading', { name: 'Projects' })).toBeInViewport();
			await expect(page.getByPlaceholder('Search projects...')).toBeInViewport();
			await row.click();

			await expect.poll(() => new URL(page.url()).pathname).toBe('/work/projects');
			await expect(row).toHaveAttribute('aria-pressed', 'true');
			await expect(page.getByTestId('work-quick-state')).toBeInViewport();
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('opens full detail on desktop section row double click', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedExecutiveOverview(request);
		try {
			await page.setViewportSize({ width: 1440, height: 720 });
			await page.goto(`${baseURL ?? ''}/work/projects`);

			const row = page
				.getByTestId('work-section-row')
				.filter({ hasText: seeded.project.title })
				.first();
			await expect(row).toBeVisible();
			await row.dblclick();

			await expect(page).toHaveURL(new RegExp(`/work/projects/${seeded.project.id}$`));
			await expect(page.getByTestId('work-detail-page')).toBeVisible();
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('routes mobile section taps directly to detail without quick inspection', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedExecutiveOverview(request);
		try {
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(`${baseURL ?? ''}/work/projects`);

			await expect(page.getByTestId('work-quick-state')).toHaveCount(0);
			const row = page
				.getByTestId('work-section-row')
				.filter({ hasText: seeded.project.title })
				.first();
			await expect(row).toBeVisible();
			await row.click();

			await expect(page).toHaveURL(new RegExp(`/work/projects/${seeded.project.id}$`));
			await expect(page.getByTestId('work-detail-page')).toBeVisible();
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('does not show an urgent overdue project as its own blocker', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedUrgentOverdueProject(request);
		try {
			await page.goto(`${baseURL ?? ''}/work/projects/${seeded.project.id}`);

			await expect(page.getByTestId('work-detail-page')).toBeVisible();
			await expect(page.getByRole('heading', { name: 'Health reasons' })).toBeVisible();
			await expect(page.getByText('Overdue').first()).toBeVisible();
			await expect(page.getByText('Urgent').first()).toBeVisible();
			await expect(page.getByRole('heading', { name: 'Blockers' })).toBeVisible();
			await expect(page.getByText('No active blockers.')).toBeVisible();
			await expect(page.getByRole('link').filter({ hasText: seeded.project.title })).toHaveCount(0);
		} finally {
			await archiveWorkItems(request, seeded.items);
		}
	});

	test('renders long questions as a sectioned brief instead of a raw text wall', async ({
		page,
		request,
		baseURL
	}) => {
		const seeded = await seedLongQuestion(request);
		try {
			await page.goto(`${baseURL ?? ''}/work/open-questions/${seeded.question.id}`);

			await expect(page.getByTestId('work-detail-page')).toBeVisible();
			await expect(page.getByText('Question Brief', { exact: true })).toBeVisible();
			await expect(page.getByTestId('question-primary-answer')).toContainText(
				'Approve the safe internal workspace setup path'
			);
			await expect(page.getByTestId('question-brief-sections')).toContainText('Objective');
			await expect(page.getByTestId('question-brief-sections')).toContainText('Approval Gate');

			const history = page.locator('details#legacy-version-history');
			await expect(history).toHaveCount(1);
			await expect(history).not.toHaveAttribute('open', '');
			await expect(page.getByTestId('question-brief-sections')).not.toContainText('## Objective');
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
