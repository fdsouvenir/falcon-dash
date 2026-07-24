import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';

interface Created {
	id: string;
}

interface AcceptanceData {
	marker: string;
	project: Created & { title: string };
	decision: Created & { title: string };
	change: Created & { title: string };
	task: Created;
}

async function apiCommand<T>(
	request: APIRequestContext,
	token: string,
	command: string,
	body: { target?: string; expected_version?: number; payload?: Record<string, unknown> }
): Promise<T> {
	const response = await request.post(`/api/v3/commands/${command}`, {
		headers: { authorization: `Bearer ${token}` },
		data: {
			target: body.target,
			expected_version: body.expected_version,
			idempotency_key: `e2e-${command}-${Date.now()}-${Math.random()}`,
			payload: body.payload ?? {}
		}
	});
	const payload = (await response.json()) as { result?: T; code?: string; message?: string };
	expect(response.ok(), `${command}: ${JSON.stringify(payload)}`).toBe(true);
	return payload.result as T;
}

async function seedAcceptanceData(
	request: APIRequestContext,
	projectName: string
): Promise<AcceptanceData> {
	const marker = `hummingbird${Date.now()}${Math.floor(Math.random() * 100_000)}`;
	const agentId = `e2e-${projectName.replaceAll(/[^A-Za-z0-9_-]/g, '-')}-${marker}`;
	const tokenResponse = await request.post('/api/work3/tokens', {
		data: { agent_id: agentId, label: 'Work v3 UI acceptance' }
	});
	const tokenPayload = (await tokenResponse.json()) as { token?: string; error?: string };
	expect(tokenResponse.ok(), JSON.stringify(tokenPayload)).toBe(true);
	const token = tokenPayload.token!;

	const area = await apiCommand<Created>(request, token, 'create_area', {
		payload: { title: `Acceptance ${marker}` }
	});
	const projectTitle = `${marker} — Restore operator confidence across a deliberately long Project title that must wrap without clipping at narrow widths`;
	const project = await apiCommand<Created>(request, token, 'create_project', {
		payload: {
			area_id: area.id,
			title: projectTitle,
			summary: `${marker} is a realistic high-density acceptance fixture.`,
			desired_outcome: `${marker} verifies every Work v3 operator surface at desktop and mobile widths.`,
			why_it_matters: 'Operators need trustworthy triage, governance, and evidence.',
			scope_included: ['Work overview', 'Project Ledger', 'Governance surfaces'],
			scope_excluded: ['In-product agent composer'],
			owner: 'agent:e2e',
			completion_criteria: [{ id: 'ui', text: 'All rendered acceptance checks pass' }]
		}
	});
	const decisionTitle = `${marker} — Choose the safe release path while preserving complete decision context`;
	const decision = await apiCommand<Created>(request, token, 'create_decision', {
		payload: {
			area_id: area.id,
			title: decisionTitle,
			prompt: 'Which release path should the operator authorize?',
			context: 'The package must remain scannable at high density.',
			stakes: 'A poor choice can block the release.',
			consequence_of_no_decision: 'The release remains blocked.',
			deciders: ['fred'],
			options: [
				{ id: 'staged', label: 'Staged rollout', summary: 'Lower risk with checkpoints.' },
				{ id: 'direct', label: 'Direct rollout', summary: 'Faster with greater exposure.' }
			],
			recommendation: { option_id: 'staged', rationale: 'It preserves a rollback checkpoint.' }
		}
	});
	const changeTitle = `${marker} — Apply the governed release configuration`;
	const change = await apiCommand<Created>(request, token, 'create_change', {
		payload: {
			area_id: area.id,
			title: changeTitle,
			summary: 'Acceptance fixture for Review and Authorization separation.',
			scope_allowed: ['release configuration'],
			scope_prohibited: ['credentials'],
			targets: { systems: ['falcon-dash'], operations: ['config.apply'] },
			risk: { level: 'medium', impact: 'temporary deployment interruption' },
			safety: { rollback_strategy: 'restore the previous configuration' },
			acceptance_criteria: [{ id: 'healthy', text: 'Health endpoint remains green' }],
			plan: {
				title: 'Governed release plan',
				steps: ['Capture current state', 'Apply configuration', 'Verify health']
			}
		}
	});
	const task = await apiCommand<Created>(request, token, 'create_task', {
		payload: {
			area_id: area.id,
			title: `${marker} — Preserve stale form input`,
			summary: 'Original summary'
		}
	});

	return {
		marker,
		project: { ...project, title: projectTitle },
		decision: { ...decision, title: decisionTitle },
		change: { ...change, title: changeTitle },
		task
	};
}

async function expectNoHorizontalOverflow(page: Page) {
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
	).toBe(false);
}

test.describe('Work v3 rendered acceptance', () => {
	test('keeps the six contract surfaces usable at target desktop and mobile widths', async ({
		page,
		request,
		baseURL
	}, testInfo) => {
		await page.setViewportSize(
			testInfo.project.name === 'mobile-chrome'
				? { width: 390, height: 844 }
				: { width: 1280, height: 800 }
		);
		const data = await seedAcceptanceData(request, testInfo.project.name);
		const visit = async (path: string) => {
			const response = await page.goto(`${baseURL ?? ''}${path}`);
			expect(response?.status(), path).toBe(200);
			await expectNoHorizontalOverflow(page);
		};

		await visit('/work');
		await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: /^Needs your call/ })).toBeVisible();

		await visit(`/work/projects/${data.project.id}`);
		await expect(
			page.getByRole('heading', { name: data.project.title, exact: true })
		).toBeVisible();
		for (const section of ['status', 'route', 'proof', 'current-work', 'history']) {
			await expect(page.locator(`#${section}`)).toBeVisible();
		}

		await visit(`/work/decisions/${data.decision.id}`);
		await expect(
			page.getByRole('heading', { name: data.decision.title, exact: true })
		).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'What is at stake', exact: true })
		).toBeVisible();
		await expect(page.getByText('Recommended', { exact: true }).first()).toBeVisible();

		await visit(`/work/changes/${data.change.id}`);
		await expect(page.getByRole('heading', { name: data.change.title, exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Reviews', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Authorizations', exact: true })).toBeVisible();
		await expect(page.getByText('never execution authority', { exact: false })).toBeVisible();

		await visit('/work/automations');
		await expect(page.getByRole('heading', { name: 'Automations', exact: true })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Runtime inventory', exact: true })
		).toBeVisible();

		await visit(`/work/browse?type=project&q=${encodeURIComponent(data.marker)}`);
		await expect(page.getByText(data.project.title, { exact: true }).first()).toBeVisible();
		await expect(page.locator('mark').first()).toContainText(data.marker);

		await visit('/work/browse?type=not-a-work-type');
		await expect(page.getByRole('alert')).toContainText('Unknown Browse type');
	});

	test('preserves stale command input and keeps keyboard order inside the CommandBar', async ({
		page,
		request,
		baseURL
	}, testInfo) => {
		await page.setViewportSize(
			testInfo.project.name === 'mobile-chrome'
				? { width: 390, height: 844 }
				: { width: 1280, height: 800 }
		);
		const data = await seedAcceptanceData(request, `${testInfo.project.name}-stale`);
		await page.goto(`${baseURL ?? ''}/work/tasks/${data.task.id}`);

		if (testInfo.project.name === 'mobile-chrome') {
			await page.locator('[data-command-bar-mobile]').getByRole('button').click();
			await page
				.getByRole('toolbar', { name: 'Available commands' })
				.getByRole('button', { name: 'Edit task' })
				.click();
		}

		let form = page.locator('form[data-command="update_task"]');
		await expect(form).toBeVisible();
		const moreOptions = form.getByRole('button', { name: 'More options' });
		await expect(moreOptions).toHaveAttribute('aria-controls', /.+/);
		await moreOptions.focus();
		await page.keyboard.press('Tab');
		await expect(form.getByRole('button', { name: 'Edit task', exact: true })).toBeFocused();
		await moreOptions.click();
		await expect(moreOptions).toHaveAttribute('data-state', 'open');

		const preserved = `Preserved summary ${data.marker}`;
		await form.locator('[name="payload_summary"]').fill(preserved);
		await form.locator('[name="expected_version"]').evaluate((element) => {
			(element as HTMLInputElement).value = '0';
		});
		await form.getByRole('button', { name: 'Edit task', exact: true }).click();

		const feedback = page.locator('[data-command-feedback="error"]');
		await expect(feedback).toContainText('version_conflict');
		await expect(feedback).toContainText('Your input is preserved');

		form = page.locator('form[data-command="update_task"]');
		const summary = form.locator('[name="payload_summary"]');
		if (!(await summary.isVisible())) {
			await form.getByRole('button', { name: 'More options' }).click();
		}
		await expect(summary).toHaveValue(preserved);
		if (testInfo.project.name === 'mobile-chrome') {
			await expect(page.locator('[data-command-sheet]')).toBeVisible();
		}
	});
});
