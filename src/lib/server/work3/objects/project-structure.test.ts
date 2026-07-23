// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	activeLinks,
	executeCommand,
	getWork3Db,
	loadEntity,
	loadMilestone,
	loadPhase,
	loadProject,
	projectHealth,
	registerWork3Objects,
	satisfiedCriteria
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * Project-structure contract tests (#339 release-gate evidence): Project/
 * Phase/Milestone lifecycles, typed relationships (allowed pairs, cycles,
 * satisfies pinning), and deterministic reconciliation with recovery.
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

async function createProject(overrides: Record<string, unknown> = {}): Promise<string> {
	const created = await cmd<{ id: string }>('create_project', undefined, {
		area_id: areaId,
		title: 'Ship the v3 cutover',
		desired_outcome: 'v3 replaces v2 as the daily driver',
		scope_included: ['work module'],
		owner: 'agent:main',
		completion_criteria: [{ id: 'cc1', text: 'All gates pass' }],
		...overrides
	});
	return created.result.id;
}

async function plannedProject(): Promise<string> {
	const id = await createProject();
	await cmd('plan_project', id);
	return id;
}

async function activeProject(): Promise<string> {
	const id = await plannedProject();
	await cmd('activate_project', id, { plan_not_required_reason: 'Exploratory project' });
	return id;
}

async function projectTask(projectId: string, title = 'Do the work'): Promise<string> {
	const task = await cmd<{ id: string }>('create_task', undefined, { area_id: areaId, title });
	await cmd('assign_to_project', undefined, { work_id: task.result.id, project_id: projectId });
	return task.result.id;
}

async function completeTask(taskId: string): Promise<void> {
	await cmd('ready_task', taskId, { owner: 'agent:main' });
	await cmd('start_task', taskId);
	await cmd('complete_task', taskId, { result_summary: 'Done' });
}

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	areaId = (await cmd<{ id: string }>('create_area', undefined, { title: 'Ops' })).result.id;
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('Project lifecycle', () => {
	it('plan_project requires outcome, scope, owner, and at least one criterion', async () => {
		const bare = await cmd<{ id: string }>('create_project', undefined, {
			area_id: areaId,
			title: 'Bare'
		});
		await expect(cmd('plan_project', bare.result.id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			details: { missing: ['desired_outcome', 'scope_included', 'owner', 'completion_criteria'] }
		});
		const full = await createProject();
		const planned = await cmd('plan_project', full);
		expect(planned.result).toMatchObject({ status: 'planned' });
	});

	it('activation requires a submitted Plan or an explicit plan_not_required reason', async () => {
		const id = await plannedProject();
		await expect(cmd('activate_project', id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});
		await cmd('activate_project', id, { plan_not_required_reason: 'Small exploratory effort' });
		expect(loadProject(getWork3Db(), id)?.status).toBe('active');
	});

	it('activation accepts a submitted attached Plan', async () => {
		const id = await plannedProject();
		const plan = await cmd<{ id: string }>('create_plan', undefined, {
			work_item_id: id,
			title: 'Route',
			steps: ['step 1']
		});
		await cmd('submit_plan', plan.result.id);
		await cmd('activate_project', id);
		expect(loadProject(getWork3Db(), id)).toMatchObject({
			status: 'active',
			plan_id: plan.result.id
		});
	});

	it('completion requires satisfied/waived criteria and a cleared next item', async () => {
		const id = await activeProject();
		const task = await projectTask(id);
		await cmd('set_current_next_item', id, { item_id: task, expected_version: undefined });

		await expect(cmd('complete_project', id, { outcome_summary: 'Done' })).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			alternatives: ['link_work', 'waive_completion_criterion']
		});

		// Prove the criterion with a revision-pinned satisfies assertion.
		await completeTask(task); // reconciliation also clears the next pointer
		await cmd('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: id,
			criterion_id: 'cc1',
			source_refs: [{ kind: 'file', ref: '/tmp/proof', label: 'Proof' }]
		});

		const completed = await cmd('complete_project', id, { outcome_summary: 'Cutover shipped' });
		expect(completed.result).toMatchObject({ status: 'completed' });
	});

	it('waive_completion_criterion is authority-creating', async () => {
		const id = await activeProject();
		await expect(
			cmd('waive_completion_criterion', id, { criterion_id: 'cc1', reason: 'Descoped' })
		).rejects.toMatchObject({ code: 'authority_required' });
		await cmd(
			'waive_completion_criterion',
			id,
			{ criterion_id: 'cc1', reason: 'Descoped' },
			person
		);
		const completed = await cmd('complete_project', id, { outcome_summary: 'Done via waiver' });
		expect(completed.result).toMatchObject({ status: 'completed' });
	});

	it('cancel requires reason + child disposition; reopen requires a new next item', async () => {
		const id = await activeProject();
		const task = await projectTask(id);
		await expect(cmd('cancel_project', id, { reason: 'x' })).rejects.toMatchObject({
			code: 'validation_failed'
		});
		await cmd('cancel_project', id, {
			reason: 'Priorities changed',
			child_disposition: 'Tasks return to Area backlog'
		});
		expect(loadProject(getWork3Db(), id)?.status).toBe('cancelled');

		await expect(
			cmd('reopen_project', id, { reason: 'Back on', current_next_item_id: 't999' })
		).rejects.toMatchObject({
			code: 'not_found'
		});
		await cmd('reopen_project', id, { reason: 'Back on', current_next_item_id: task });
		expect(loadProject(getWork3Db(), id)).toMatchObject({
			status: 'active',
			current_next_item_id: task
		});
	});

	it('archival is orthogonal and blocks ordinary mutations until restored', async () => {
		const id = await activeProject();
		await cmd('archive_project', id);
		const row = loadProject(getWork3Db(), id)!;
		expect(row.status).toBe('active'); // lifecycle outcome preserved
		await expect(cmd('update_project', id, { title: 'Nope' })).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['restore_project']
		});
		await cmd('restore_project', id);
		await cmd('update_project', id, { title: 'Renamed' });
	});

	it('current-next validation: in-project, actionable, nonterminal only', async () => {
		const id = await activeProject();
		const outsideTask = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Elsewhere'
		});
		await expect(
			cmd('set_current_next_item', id, { item_id: outsideTask.result.id })
		).rejects.toMatchObject({ code: 'invariant_violation' });

		const task = await projectTask(id);
		await completeTask(task);
		await expect(cmd('set_current_next_item', id, { item_id: task })).rejects.toMatchObject({
			code: 'invariant_violation'
		});
	});

	it('health derives from the current next item; overrides need reason + expiry', async () => {
		const id = await activeProject();
		expect(projectHealth(getWork3Db(), loadProject(getWork3Db(), id)!).health).toBe('unknown');

		const task = await projectTask(id);
		await cmd('set_current_next_item', id, { item_id: task });
		expect(projectHealth(getWork3Db(), loadProject(getWork3Db(), id)!).health).toBe('on_track');

		await cmd('create_blocker', undefined, {
			blocked_id: task,
			source_kind: 'external',
			source_label: 'Vendor',
			reason: 'Waiting on vendor',
			resolution_condition: 'Vendor responds'
		});
		expect(projectHealth(getWork3Db(), loadProject(getWork3Db(), id)!).health).toBe('blocked');

		await expect(
			cmd('set_project_health_override', id, { health: 'on_track', reason: 'Vendor confirmed ETA' })
		).rejects.toMatchObject({ code: 'validation_failed' }); // no expiry
		await cmd('set_project_health_override', id, {
			health: 'on_track',
			reason: 'Vendor confirmed ETA',
			expires_at: Date.now() + 86_400_000
		});
		const health = projectHealth(getWork3Db(), loadProject(getWork3Db(), id)!);
		expect(health).toMatchObject({ health: 'on_track', overridden: true });
	});
});

describe('Phase lifecycle', () => {
	it('empty Phases cannot activate; activation completes the prior Phase when its work is done', async () => {
		const projectId = await activeProject();
		const phase1 = (
			await cmd<{ id: string }>('create_phase', undefined, {
				project_id: projectId,
				title: 'Build'
			})
		).result.id;
		const phase2 = (
			await cmd<{ id: string }>('create_phase', undefined, {
				project_id: projectId,
				title: 'Verify'
			})
		).result.id;

		await expect(cmd('activate_phase', phase1)).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});

		const task1 = await projectTask(projectId, 'Build it');
		await cmd('assign_to_project', undefined, {
			work_id: task1,
			project_id: projectId,
			phase_id: phase1
		});
		await cmd('activate_phase', phase1);
		expect(loadPhase(getWork3Db(), phase1)?.status).toBe('active');

		const task2 = await projectTask(projectId, 'Verify it');
		await cmd('assign_to_project', undefined, {
			work_id: task2,
			project_id: projectId,
			phase_id: phase2
		});

		// Prior phase has open work: activation is rejected without parallel.
		await expect(cmd('activate_phase', phase2)).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			alternatives: ['complete_phase', 'skip_phase']
		});

		await completeTask(task1);
		const activated = await cmd('activate_phase', phase2);
		expect(activated.events.some((event) => event.event_type === 'phase_completed')).toBe(true);
		expect(loadPhase(getWork3Db(), phase1)?.status).toBe('completed');
	});

	it('parallel activation needs the explicit exception', async () => {
		const projectId = await activeProject();
		const phase1 = (
			await cmd<{ id: string }>('create_phase', undefined, { project_id: projectId, title: 'A' })
		).result.id;
		const phase2 = (
			await cmd<{ id: string }>('create_phase', undefined, { project_id: projectId, title: 'B' })
		).result.id;
		const task1 = await projectTask(projectId, 'A work');
		const task2 = await projectTask(projectId, 'B work');
		await cmd('assign_to_project', undefined, {
			work_id: task1,
			project_id: projectId,
			phase_id: phase1
		});
		await cmd('assign_to_project', undefined, {
			work_id: task2,
			project_id: projectId,
			phase_id: phase2
		});
		await cmd('activate_phase', phase1);
		await cmd('activate_phase', phase2, { parallel: true });
		expect(loadPhase(getWork3Db(), phase1)?.status).toBe('active');
		expect(loadPhase(getWork3Db(), phase2)?.status).toBe('active');
	});

	it('skip requires a reason (and disposition when work is open); reopen restores planned', async () => {
		const projectId = await activeProject();
		const phase = (
			await cmd<{ id: string }>('create_phase', undefined, {
				project_id: projectId,
				title: 'Doomed'
			})
		).result.id;
		const task = await projectTask(projectId, 'Orphan work');
		await cmd('assign_to_project', undefined, {
			work_id: task,
			project_id: projectId,
			phase_id: phase
		});

		await expect(cmd('skip_phase', phase, { reason: 'Descoped' })).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});
		await cmd('skip_phase', phase, {
			reason: 'Descoped',
			work_disposition: 'Work moves to backlog'
		});
		expect(loadPhase(getWork3Db(), phase)?.status).toBe('skipped');

		await cmd('reopen_phase', phase, { reason: 'Back in scope' });
		expect(loadPhase(getWork3Db(), phase)?.status).toBe('planned');
	});
});

describe('Milestone lifecycle', () => {
	it('achievement requires sources unless explicitly waived; repeat is a no-op', async () => {
		const projectId = await activeProject();
		const milestone = (
			await cmd<{ id: string }>('create_milestone', undefined, {
				project_id: projectId,
				title: 'First deploy',
				success_condition: 'App serves traffic in prod'
			})
		).result.id;

		await expect(cmd('achieve_milestone', milestone)).rejects.toMatchObject({
			code: 'validation_failed'
		});
		await cmd('achieve_milestone', milestone, {
			source_refs: [{ kind: 'url', ref: 'https://app.example/health', label: 'Health check' }]
		});
		expect(loadMilestone(getWork3Db(), milestone)?.status).toBe('achieved');
		const repeat = await cmd('achieve_milestone', milestone, {
			source_refs: [{ kind: 'url', ref: 'https://app.example/health' }]
		});
		expect(repeat.noop).toBe(true);
	});

	it('cancel and reopen require reasons; contributing work never auto-achieves', async () => {
		const projectId = await activeProject();
		const milestone = (
			await cmd<{ id: string }>('create_milestone', undefined, {
				project_id: projectId,
				title: 'M',
				success_condition: 'Condition observed'
			})
		).result.id;
		const task = await projectTask(projectId);
		await cmd('link_work', undefined, {
			rel_type: 'contributes_to',
			source_id: task,
			target_id: milestone
		});
		await completeTask(task);
		// Contribution does not imply satisfaction (doc 03).
		expect(loadMilestone(getWork3Db(), milestone)?.status).toBe('planned');

		await cmd('cancel_milestone', milestone, { reason: 'No longer meaningful' });
		await cmd('reopen_milestone', milestone, { reason: 'Meaningful again' });
		expect(loadMilestone(getWork3Db(), milestone)?.status).toBe('planned');
	});
});

describe('typed relationships', () => {
	it('enforces allowed type pairs and forbids self-links', async () => {
		const projectId = await activeProject();
		const task = await projectTask(projectId);
		await expect(
			cmd('link_work', undefined, { rel_type: 'depends_on', source_id: task, target_id: task })
		).rejects.toMatchObject({ code: 'invariant_violation' });
		await expect(
			cmd('link_work', undefined, { rel_type: 'implements', source_id: task, target_id: projectId })
		).rejects.toMatchObject({ code: 'invariant_violation' }); // implements targets decisions
		await expect(
			cmd('link_work', undefined, { rel_type: 'depends_on', source_id: projectId, target_id: task })
		).rejects.toMatchObject({ code: 'invariant_violation' }); // projects are not dependency sources
	});

	it('duplicate active links are idempotent no-ops; removal is audited history', async () => {
		const projectId = await activeProject();
		const task1 = await projectTask(projectId, 'One');
		const task2 = await projectTask(projectId, 'Two');
		const first = await cmd<{ id: string }>('link_work', undefined, {
			rel_type: 'depends_on',
			source_id: task1,
			target_id: task2
		});
		const repeat = await cmd<{ id: string }>('link_work', undefined, {
			rel_type: 'depends_on',
			source_id: task1,
			target_id: task2
		});
		expect(repeat.noop).toBe(true);
		expect(repeat.result.id).toBe(first.result.id);

		const removed = await cmd('unlink_work', undefined, {
			link_id: first.result.id,
			reason: 'Not actually dependent'
		});
		expect(removed.events[0].event_type).toBe('work_unlinked');
		// Row preserved for audit; link no longer active.
		expect(activeLinks(getWork3Db(), { sourceId: task1 })).toHaveLength(0);
		const row = getWork3Db()
			.prepare('SELECT removed_at FROM relationships WHERE id = ?')
			.get(first.result.id) as {
			removed_at: number | null;
		};
		expect(row.removed_at).not.toBeNull();
	});

	it('prevents depends_on cycles', async () => {
		const projectId = await activeProject();
		const a = await projectTask(projectId, 'A');
		const b = await projectTask(projectId, 'B');
		const c = await projectTask(projectId, 'C');
		await cmd('link_work', undefined, { rel_type: 'depends_on', source_id: a, target_id: b });
		await cmd('link_work', undefined, { rel_type: 'depends_on', source_id: b, target_id: c });
		await expect(
			cmd('link_work', undefined, { rel_type: 'depends_on', source_id: c, target_id: a })
		).rejects.toMatchObject({ code: 'invariant_violation' });
	});

	it('satisfies requires a terminal supporting result, sources, and a valid criterion', async () => {
		const projectId = await activeProject();
		const task = await projectTask(projectId);
		await expect(
			cmd('link_work', undefined, {
				rel_type: 'satisfies',
				source_id: task,
				target_id: projectId,
				criterion_id: 'cc1',
				source_refs: [{ kind: 'file', ref: '/tmp/x' }]
			})
		).rejects.toMatchObject({ code: 'transition_requirements_not_met' }); // not terminal

		await completeTask(task);
		await expect(
			cmd('link_work', undefined, {
				rel_type: 'satisfies',
				source_id: task,
				target_id: projectId,
				criterion_id: 'bogus',
				source_refs: [{ kind: 'file', ref: '/tmp/x' }]
			})
		).rejects.toMatchObject({ code: 'not_found' });
		await expect(
			cmd('link_work', undefined, {
				rel_type: 'satisfies',
				source_id: task,
				target_id: projectId,
				criterion_id: 'cc1'
			})
		).rejects.toMatchObject({ code: 'validation_failed' }); // sources required

		const linked = await cmd<{ id: string }>('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: projectId,
			criterion_id: 'cc1',
			source_refs: [{ kind: 'file', ref: '/tmp/x', label: 'Proof' }]
		});
		expect(linked.ok).toBe(true);
		expect(satisfiedCriteria(getWork3Db(), projectId).has('cc1')).toBe(true);
	});

	it('definitive empty projections: no relationships means empty arrays, not omissions', async () => {
		const projectId = await activeProject();
		const { getObjectReader } = await import('../read/registry.js');
		const detail = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(detail.relationships).toEqual({ incoming: [] });
		expect(detail.phases).toEqual([]);
		expect(detail.milestones).toEqual([]);
	});
});

describe('deterministic reconciliation and recovery (gate 6 partial)', () => {
	it('terminal work clears current-next pointers with an explicit audit event', async () => {
		const projectId = await activeProject();
		const task = await projectTask(projectId);
		await cmd('set_current_next_item', projectId, { item_id: task });

		await cmd('ready_task', task, { owner: 'agent:main' });
		await cmd('start_task', task);
		const completed = await cmd('complete_task', task, { result_summary: 'Done' });

		expect(loadProject(getWork3Db(), projectId)?.current_next_item_id).toBeNull();
		expect(completed.events.some((event) => event.event_type === 'project_next_item_cleared')).toBe(
			true
		);
		// The Project is now explicitly inconsistent (unknown health) — actionable, not silent.
		expect(projectHealth(getWork3Db(), loadProject(getWork3Db(), projectId)!).health).toBe(
			'unknown'
		);
	});

	it('supportive terminal results auto-resolve blockers sourced from them; cancellation leaves them for explicit resolution', async () => {
		const projectId = await activeProject();
		const blockerSource = await projectTask(projectId, 'Prerequisite');
		const blocked = await projectTask(projectId, 'Blocked work');
		await cmd('create_blocker', undefined, {
			blocked_id: blocked,
			source_kind: 'work',
			source_work_id: blockerSource,
			reason: 'Needs prerequisite',
			resolution_condition: 'Prerequisite completed'
		});

		await completeTask(blockerSource);
		const state = getWork3Db()
			.prepare(`SELECT state FROM blockers WHERE source_work_id = ?`)
			.get(blockerSource) as { state: string };
		expect(state.state).toBe('resolved');

		// Ambiguous case: a cancelled source leaves the blocker active.
		const source2 = await projectTask(projectId, 'Another prerequisite');
		const blocked2 = await projectTask(projectId, 'Blocked again');
		await cmd('create_blocker', undefined, {
			blocked_id: blocked2,
			source_kind: 'work',
			source_work_id: source2,
			reason: 'Needs it',
			resolution_condition: 'It exists'
		});
		await cmd('cancel_task', source2, { reason: 'Descoped' });
		const state2 = getWork3Db()
			.prepare(`SELECT state FROM blockers WHERE source_work_id = ?`)
			.get(source2) as { state: string };
		expect(state2.state).toBe('active');
	});

	it('reopening invalidates revision-pinned satisfies; re-proving recovers (recovery procedure)', async () => {
		const projectId = await activeProject();
		const task = await projectTask(projectId);
		await completeTask(task);
		await cmd('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: projectId,
			criterion_id: 'cc1',
			source_refs: [{ kind: 'file', ref: '/tmp/x', label: 'Proof' }]
		});
		expect(satisfiedCriteria(getWork3Db(), projectId).has('cc1')).toBe(true);

		// Reopen: the assertion is invalidated, completion is barred again.
		const reopened = await cmd('reopen_task', task, { reason: 'Result was wrong' });
		expect(reopened.events.some((event) => event.event_type === 'satisfies_invalidated')).toBe(
			true
		);
		expect(satisfiedCriteria(getWork3Db(), projectId).has('cc1')).toBe(false);
		await expect(
			cmd('complete_project', projectId, { outcome_summary: 'x' })
		).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});

		// Recovery: redo the work, assert satisfaction again with fresh sources.
		await cmd('start_task', task);
		await cmd('complete_task', task, { result_summary: 'Redone correctly' });
		await cmd('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: projectId,
			criterion_id: 'cc1',
			source_refs: [{ kind: 'file', ref: '/tmp/x2', label: 'New proof' }]
		});
		expect(satisfiedCriteria(getWork3Db(), projectId).has('cc1')).toBe(true);
		const completed = await cmd('complete_project', projectId, {
			outcome_summary: 'Recovered and shipped'
		});
		expect(completed.result).toMatchObject({ status: 'completed' });
	});
});
