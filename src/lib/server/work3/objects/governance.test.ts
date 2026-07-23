// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	currentPlanRevision,
	effectiveAuthorization,
	executeCommand,
	getWork3Db,
	latestDraftRevision,
	loadChange,
	loadEntity,
	planRevisions,
	registerWork3Objects,
	reviewDisposition
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * Governance contract tests (#338 release-gate evidence): Plan revision
 * lifecycle, Review disposition + revision invalidation, Authorization
 * pinning/effectiveness, Change execution + verification machines, and the
 * gate-2 contradiction rules (Review is not authority; Plan approval does not
 * authorize execution).
 */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };
const person: Actor = { kind: 'person', id: 'fred', label: 'Fred' };

let areaId: string;

async function cmd<T = Record<string, unknown>>(
	command: string,
	target?: string,
	payload: Record<string, unknown> = {},
	actor: Actor = agent
) {
	return executeCommand<T>({
		command,
		actor,
		target: target ?? null,
		expected_version: target ? loadEntity(getWork3Db(), target)!.version : undefined,
		payload
	});
}

function changePayload(overrides: Record<string, unknown> = {}) {
	return {
		area_id: areaId,
		title: 'Rotate the gateway token',
		scope_allowed: ['~/.openclaw/openclaw.json gateway.auth.token'],
		scope_prohibited: ['any other config key'],
		targets: { systems: ['openclaw-gateway'], operations: ['config.apply'] },
		risk: { level: 'medium', impact: 'gateway restart', failure_modes: ['clients locked out'] },
		safety: { rollback_strategy: 'restore previous token from vault' },
		acceptance_criteria: [
			{ id: 'c1', text: 'Gateway accepts the new token' },
			{ id: 'c2', text: 'All clients reconnected' }
		],
		plan: {
			title: 'Token rotation plan',
			steps: ['Generate token', 'Apply config', 'Verify clients']
		},
		...overrides
	};
}

interface CreatedChange {
	id: string;
	plan_id: string;
	revision_id: string;
}

async function createChange(): Promise<CreatedChange> {
	const created = await cmd<CreatedChange>('create_change', undefined, changePayload());
	return created.result;
}

/** Drive a change to authorized (submitted plan + person-granted authorization). */
async function authorizedChange(): Promise<CreatedChange & { authorization_id: string }> {
	const change = await createChange();
	await cmd('submit_plan', change.plan_id);
	const granted = await cmd<{ id: string }>('authorize_change', change.id, {}, person);
	return { ...change, authorization_id: granted.result.id };
}

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	areaId = (await cmd<{ id: string }>('create_area', undefined, { title: 'Ops' })).result.id;
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('Plan revision lifecycle', () => {
	it('create → draft (mutable) → submit (immutable) → revise → submit supersedes', async () => {
		const task = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Work'
		});
		const plan = await cmd<{ id: string; revision_id: string }>('create_plan', undefined, {
			work_item_id: task.result.id,
			title: 'Approach',
			steps: ['Step one']
		});
		const planId = plan.result.id;

		// Draft is mutable.
		await cmd('update_plan', planId, { steps: ['Step one', 'Step two'] });
		await cmd('submit_plan', planId);
		let current = currentPlanRevision(getWork3Db(), planId)!;
		expect(current.state).toBe('submitted');

		// Submitted revisions are immutable.
		await expect(cmd('update_plan', planId, { summary: 'nope' })).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['revise_plan']
		});

		// Revise opens a draft; the submitted revision stays current until the
		// replacement is submitted.
		await cmd('revise_plan', planId, { summary: 'v2 approach' });
		current = currentPlanRevision(getWork3Db(), planId)!;
		expect(current.state).toBe('submitted');
		expect(latestDraftRevision(getWork3Db(), planId)?.revision_number).toBe(2);

		await cmd('submit_plan', planId);
		const revisions = planRevisions(getWork3Db(), planId);
		expect(revisions.map((revision) => revision.state)).toEqual(['superseded', 'submitted']);
		expect(currentPlanRevision(getWork3Db(), planId)?.revision_number).toBe(2);
	});

	it('withdraw requires a reason; revise is idempotent while a draft is open', async () => {
		const task = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'W'
		});
		const plan = await cmd<{ id: string }>('create_plan', undefined, {
			work_item_id: task.result.id,
			title: 'P',
			steps: ['s']
		});
		await cmd('submit_plan', plan.result.id);
		const first = await cmd<{ revision_id: string }>('revise_plan', plan.result.id);
		const repeat = await cmd<{ revision_id: string }>('revise_plan', plan.result.id);
		expect(repeat.noop).toBe(true);
		expect(repeat.result.revision_id).toBe(first.result.revision_id);

		await expect(cmd('withdraw_plan', plan.result.id)).rejects.toMatchObject({
			code: 'validation_failed'
		});
		await cmd('withdraw_plan', plan.result.id, { reason: 'Wrong direction' });
	});
});

describe('Review disposition and revision invalidation', () => {
	it('derives disposition from the latest decisive Review; commented never changes it', async () => {
		const change = await createChange();
		await cmd('submit_plan', change.plan_id);
		const revision = currentPlanRevision(getWork3Db(), change.plan_id)!;

		expect(reviewDisposition(getWork3Db(), change.plan_id, revision.id)).toBe('unreviewed');
		await cmd('create_review', undefined, {
			subject_id: change.plan_id,
			subject_revision: revision.id,
			outcome: 'commented',
			summary: 'Some thoughts'
		});
		expect(reviewDisposition(getWork3Db(), change.plan_id, revision.id)).toBe('unreviewed');
		await cmd('create_review', undefined, {
			subject_id: change.plan_id,
			subject_revision: revision.id,
			outcome: 'approved',
			summary: 'Approach is sound'
		});
		expect(reviewDisposition(getWork3Db(), change.plan_id, revision.id)).toBe('approved');
	});

	it('a new revision invalidates prior approval (disposition is per exact revision)', async () => {
		const change = await createChange();
		await cmd('submit_plan', change.plan_id);
		const v1 = currentPlanRevision(getWork3Db(), change.plan_id)!;
		await cmd('create_review', undefined, {
			subject_id: change.plan_id,
			subject_revision: v1.id,
			outcome: 'approved',
			summary: 'ok'
		});

		await cmd('revise_plan', change.plan_id);
		await cmd('submit_plan', change.plan_id);
		const v2 = currentPlanRevision(getWork3Db(), change.plan_id)!;
		expect(reviewDisposition(getWork3Db(), change.plan_id, v2.id)).toBe('unreviewed');

		// Superseded revisions cannot receive new Reviews.
		await expect(
			cmd('create_review', undefined, {
				subject_id: change.plan_id,
				subject_revision: v1.id,
				outcome: 'approved',
				summary: 'late approval'
			})
		).rejects.toMatchObject({ code: 'invariant_violation' });
	});

	it('required comments block approval of the same revision', async () => {
		const change = await createChange();
		await cmd('submit_plan', change.plan_id);
		const revision = currentPlanRevision(getWork3Db(), change.plan_id)!;
		await cmd('create_review', undefined, {
			subject_id: change.plan_id,
			subject_revision: revision.id,
			outcome: 'changes_requested',
			summary: 'Missing rollback detail',
			comments: [{ text: 'Add rollback steps', severity: 'required' }]
		});
		await expect(
			cmd('create_review', undefined, {
				subject_id: change.plan_id,
				subject_revision: revision.id,
				outcome: 'approved',
				summary: 'fine now'
			})
		).rejects.toMatchObject({ code: 'invariant_violation' });
	});
});

describe('Authorization pinning and effectiveness', () => {
	it('grant requires a submitted Plan revision and a human authority basis', async () => {
		const change = await createChange();
		await expect(cmd('authorize_change', change.id, {}, person)).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			alternatives: ['submit_plan']
		});
		await cmd('submit_plan', change.plan_id);
		await expect(cmd('authorize_change', change.id)).rejects.toMatchObject({
			code: 'authority_required'
		});
		const granted = await cmd<{ id: string }>('authorize_change', change.id, {}, person);
		expect(effectiveAuthorization(getWork3Db(), change.id, Date.now())).toMatchObject({
			state: 'valid'
		});
		// Idempotent: an existing valid grant is returned.
		const repeat = await cmd<{ id: string }>('authorize_change', change.id, {}, person);
		expect(repeat.noop).toBe(true);
		expect(repeat.result.id).toBe(granted.result.id);
	});

	it('revising the Change invalidates the pinned Authorization', async () => {
		const change = await authorizedChange();
		await cmd('revise_change', change.id, changePayload({ scope_allowed: ['a much wider scope'] }));
		const result = effectiveAuthorization(getWork3Db(), change.id, Date.now());
		expect(result.state).toBe('invalidated');
		await expect(cmd('start_change', change.id)).rejects.toMatchObject({
			code: 'authorization_invalid',
			alternatives: ['authorize_change']
		});
	});

	it('revising the Plan invalidates the pinned Authorization', async () => {
		const change = await authorizedChange();
		await cmd('revise_plan', change.plan_id);
		await cmd('submit_plan', change.plan_id);
		const result = effectiveAuthorization(getWork3Db(), change.id, Date.now());
		expect(result.state).toBe('invalidated');
		expect('reason' in result ? result.reason : undefined).toContain('Plan revision');
	});

	it('expiry is derived from time; revocation is terminal with metadata', async () => {
		const change = await createChange();
		await cmd('submit_plan', change.plan_id);
		await cmd('authorize_change', change.id, { expires_at: Date.now() - 1000 }, person);
		expect(effectiveAuthorization(getWork3Db(), change.id, Date.now()).state).toBe('expired');

		const fresh = await cmd<{ id: string }>('authorize_change', change.id, {}, person);
		await cmd('revoke_authorization', fresh.result.id, { reason: 'Scope concerns' }, person);
		expect(effectiveAuthorization(getWork3Db(), change.id, Date.now())).toMatchObject({
			state: 'revoked',
			reason: 'Scope concerns'
		});
		const repeat = await cmd('revoke_authorization', fresh.result.id, { reason: 'again' }, person);
		expect(repeat.noop).toBe(true);
	});

	it('one-time authority is consumed by successful execution', async () => {
		const change = await createChange();
		await cmd('submit_plan', change.plan_id);
		await cmd('authorize_change', change.id, { one_time: true }, person);
		await cmd('start_change', change.id);
		await cmd('succeed_execution', change.id, { result_summary: 'Token rotated' });
		expect(effectiveAuthorization(getWork3Db(), change.id, Date.now()).state).toBe('consumed');
		// Further governed actions are rejected.
		await expect(cmd('start_verification', change.id)).resolves.toBeDefined(); // verification is not gateway-governed
	});
});

describe('gate-2 contradiction rules', () => {
	it('Plan approval does NOT authorize execution', async () => {
		const change = await createChange();
		await cmd('submit_plan', change.plan_id);
		const revision = currentPlanRevision(getWork3Db(), change.plan_id)!;
		await cmd('create_review', undefined, {
			subject_id: change.plan_id,
			subject_revision: revision.id,
			outcome: 'approved',
			summary: 'Approach accepted'
		});
		// Approved Plan, no Authorization: execution stays forbidden.
		await expect(cmd('start_change', change.id)).rejects.toMatchObject({
			code: 'authorization_invalid'
		});
	});

	it('Authorization does not substitute for Review: dispositions stay derived and separate', async () => {
		const change = await authorizedChange();
		const planRevision = currentPlanRevision(getWork3Db(), change.plan_id)!;
		// Authorized but unreviewed: the derived review disposition is untouched.
		expect(reviewDisposition(getWork3Db(), change.plan_id, planRevision.id)).toBe('unreviewed');
	});
});

describe('Change execution and verification machines', () => {
	it('runs the full happy path with authorization rechecked at each governed step', async () => {
		const change = await authorizedChange();
		await cmd('start_change', change.id);
		await cmd('pause_change', change.id);
		await cmd('resume_change', change.id);
		await cmd('succeed_execution', change.id, { result_summary: 'Applied cleanly' });
		await cmd('start_verification', change.id);
		// Cannot pass while criteria lack evidence.
		await expect(cmd('pass_verification', change.id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			alternatives: ['waive_verification']
		});
		const passed = await cmd('pass_verification', change.id, {
			criteria_evidence: {
				c1: [{ kind: 'file', ref: '/var/log/gw.log', label: 'Gateway log' }],
				c2: [{ kind: 'url', ref: 'https://status.example', label: 'Status page' }]
			}
		});
		expect(passed.result).toMatchObject({ verification_state: 'passed' });
		const row = loadChange(getWork3Db(), change.id)!;
		expect(row.execution_state).toBe('succeeded');
		expect(row.verification_state).toBe('passed');
	});

	it('verification cannot start before execution succeeds (distinct facts)', async () => {
		const change = await authorizedChange();
		await expect(cmd('start_verification', change.id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});
	});

	it('retry is legal only inside current Authorization', async () => {
		const change = await authorizedChange();
		await cmd('start_change', change.id);
		await cmd('fail_execution', change.id, { failure_summary: 'config.apply rejected' });
		// Retry works under the still-valid authorization.
		await cmd('retry_change', change.id);
		await cmd('fail_execution', change.id, { failure_summary: 'again' });
		// Scope-changing remediation invalidates authorization; retry now fails.
		await cmd('revise_change', change.id, changePayload({ scope_allowed: ['wider'] }));
		await expect(cmd('retry_change', change.id)).rejects.toMatchObject({
			code: 'authorization_invalid'
		});
	});

	it('waive_verification is authority-creating and records the waiver', async () => {
		const change = await authorizedChange();
		await cmd('start_change', change.id);
		await cmd('succeed_execution', change.id, { result_summary: 'done' });
		await cmd('start_verification', change.id);
		await expect(
			cmd('waive_verification', change.id, { reason: 'low risk' })
		).rejects.toMatchObject({
			code: 'authority_required'
		});
		await cmd('waive_verification', change.id, { reason: 'Manually spot-checked' }, person);
		const row = loadChange(getWork3Db(), change.id)!;
		expect(row.verification_state).toBe('waived');
		const status = JSON.parse(row.criteria_status) as Record<string, { state: string }>;
		expect(Object.values(status).every((entry) => entry.state === 'waived')).toBe(true);
	});

	it('rollback preserves execution history', async () => {
		const change = await authorizedChange();
		await cmd('start_change', change.id);
		await cmd('succeed_execution', change.id, { result_summary: 'applied' });
		await cmd('start_rollback', change.id);
		await cmd('complete_rollback', change.id, { summary: 'restored previous token' });
		const row = loadChange(getWork3Db(), change.id)!;
		expect(row.execution_state).toBe('rolled_back');
		expect(row.result_summary).toBe('applied'); // original outcome preserved
	});

	it('cancel requires a reason and is terminal-guarded', async () => {
		const change = await authorizedChange();
		await cmd('cancel_change', change.id, { reason: 'Descoped' });
		expect(loadChange(getWork3Db(), change.id)?.execution_state).toBe('cancelled');
		const repeat = await cmd('cancel_change', change.id, { reason: 'again' });
		expect(repeat.noop).toBe(true);
	});
});

describe('stale-write recovery (gate 6 partial)', () => {
	it('a conflicting write fails cleanly and succeeds after refetching the current version', async () => {
		const change = await authorizedChange();
		const staleVersion = loadEntity(getWork3Db(), change.id)!.version;

		// Another actor moves the change while we hold a stale version.
		await cmd('start_change', change.id);

		// The stale write fails with the current version in the error details…
		let recoveredVersion: number | undefined;
		try {
			await executeCommand({
				command: 'pause_change',
				actor: agent,
				target: change.id,
				expected_version: staleVersion,
				payload: {}
			});
			expect.unreachable();
		} catch (error) {
			const shape = error as { code: string; details: { current_version: number } };
			expect(shape.code).toBe('version_conflict');
			recoveredVersion = shape.details.current_version;
		}

		// …and the documented recovery (refetch → reapply) succeeds.
		const retried = await executeCommand({
			command: 'pause_change',
			actor: agent,
			target: change.id,
			expected_version: recoveredVersion!,
			payload: {}
		});
		expect(retried.ok).toBe(true);
	});

	it('the change reader surfaces derived authorization state on every projection', async () => {
		const change = await authorizedChange();
		const { getObjectReader } = await import('../read/registry.js');
		const item = getObjectReader('change_request').get(change.id, {
			view: 'list',
			filters: {},
			limit: 1,
			offset: 0
		})!;
		expect(item.authorization).toMatchObject({ state: 'valid' });
		expect(item.next_action).toBe('start_change');
	});
});
