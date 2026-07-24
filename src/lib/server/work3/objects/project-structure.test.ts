// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
	projectProgress,
	projectRiskFlags,
	registerWork3Objects,
	satisfiedCriteria
} from '../index.js';
import { transferWork3OutboxOnce } from '../outbox.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';
import { isTerminalProjectWork } from './project-work.js';

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

	it('archival freezes child Phase and Milestone mutations until the Project is restored', async () => {
		const id = await activeProject();
		const phase = (
			await cmd<{ id: string }>('create_phase', undefined, {
				project_id: id,
				title: 'Frozen route'
			})
		).result.id;
		const milestone = (
			await cmd<{ id: string }>('create_milestone', undefined, {
				project_id: id,
				title: 'Frozen proof',
				success_condition: 'Proof is recorded'
			})
		).result.id;
		const task = await projectTask(id);
		await cmd('assign_to_project', undefined, { work_id: task, project_id: id, phase_id: phase });
		const proof = await cmd<{ id: string }>('link_work', undefined, {
			rel_type: 'contributes_to',
			source_id: task,
			target_id: milestone
		});
		await cmd('archive_project', id);

		await expect(cmd('activate_phase', phase)).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});
		await expect(
			cmd('achieve_milestone', milestone, {
				source_refs: [{ kind: 'file', ref: '/tmp/frozen-proof' }]
			})
		).rejects.toMatchObject({ code: 'transition_not_allowed' });
		await expect(
			cmd('link_work', undefined, {
				rel_type: 'contributes_to',
				source_id: task,
				target_id: milestone
			})
		).rejects.toMatchObject({ code: 'transition_not_allowed' });
		await expect(
			cmd('unlink_work', undefined, {
				link_id: proof.result.id,
				reason: 'Cannot mutate archived proof'
			})
		).rejects.toMatchObject({ code: 'transition_not_allowed' });

		await cmd('restore_project', id);
		await cmd('activate_phase', phase);
		await cmd('achieve_milestone', milestone, {
			source_refs: [{ kind: 'file', ref: '/tmp/restored-proof' }]
		});
		expect(loadPhase(getWork3Db(), phase)?.status).toBe('active');
		expect(loadMilestone(getWork3Db(), milestone)?.status).toBe('achieved');
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

	it('allows null-only cleanup of legacy next pointers on archived and terminal Projects', async () => {
		const archivedProject = await activeProject();
		const archivedTask = await projectTask(archivedProject, 'Legacy archived next');
		await cmd('set_current_next_item', archivedProject, { item_id: archivedTask });
		await cmd('archive_project', archivedProject);
		await expect(
			cmd('set_current_next_item', archivedProject, { item_id: archivedTask })
		).rejects.toMatchObject({ code: 'transition_not_allowed' });
		await expect(
			cmd('set_current_next_item', archivedProject, { item_id: '' })
		).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['restore_project']
		});
		getWork3Db()
			.prepare(`UPDATE tasks SET status = 'completed' WHERE entity_id = ?`)
			.run(archivedTask);
		await cmd('set_current_next_item', archivedProject, { item_id: '' });
		expect(loadProject(getWork3Db(), archivedProject)?.current_next_item_id).toBeNull();

		const terminalProject = await activeProject();
		const terminalTask = await projectTask(terminalProject, 'Legacy terminal next');
		await cmd('set_current_next_item', terminalProject, { item_id: terminalTask });
		getWork3Db()
			.prepare(`UPDATE projects SET status = 'completed' WHERE entity_id = ?`)
			.run(terminalProject);
		await expect(
			cmd('set_current_next_item', terminalProject, { item_id: terminalTask })
		).rejects.toMatchObject({ code: 'transition_not_allowed' });
		await cmd('set_current_next_item', terminalProject, { item_id: '' });
		expect(loadProject(getWork3Db(), terminalProject)?.current_next_item_id).toBeNull();
	});

	it('clears current-next on reassignment and derives legacy dangling pointers as missing', async () => {
		const first = await activeProject();
		const second = await activeProject();
		const task = await projectTask(first, 'Move between Projects');
		await cmd('set_current_next_item', first, { item_id: task });
		const reassigned = await cmd('assign_to_project', undefined, {
			work_id: task,
			project_id: second
		});
		const clearEvent = reassigned.events.find(
			(event) => event.event_type === 'project_next_item_cleared'
		);
		expect(clearEvent).toMatchObject({
			version_from: expect.any(Number),
			version_to: expect.any(Number)
		});
		expect(clearEvent!.version_to).toBe(clearEvent!.version_from! + 1);
		expect(loadProject(getWork3Db(), first)?.current_next_item_id).toBeNull();

		getWork3Db()
			.prepare(`UPDATE projects SET current_next_item_id = ? WHERE entity_id = ?`)
			.run(task, first);
		expect(projectHealth(getWork3Db(), loadProject(getWork3Db(), first)!)).toMatchObject({
			health: 'unknown',
			reason: expect.stringContaining('outside the Project')
		});
		expect(projectRiskFlags(getWork3Db(), loadProject(getWork3Db(), first)!)).toEqual(
			expect.arrayContaining([expect.objectContaining({ key: 'no_next_item' })])
		);
		const { getObjectReader } = await import('../read/registry.js');
		const projected = (await getObjectReader('project').get(first, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(projected).toMatchObject({
			current_next_item_id: task,
			current_next_valid: false
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
	it('keeps every unfinished Change rollback nonterminal', () => {
		expect(isTerminalProjectWork('change_request', 'cancelled', null, null)).toBe(true);
		expect(isTerminalProjectWork('change_request', 'cancelled', null, Date.now())).toBe(false);
		expect(isTerminalProjectWork('change_request', 'failed', null, Date.now())).toBe(false);
		expect(isTerminalProjectWork('change_request', 'rolled_back', null, Date.now())).toBe(true);
	});

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

	it('uses the full Project Work union for Phase activation and completion guards', async () => {
		const projectId = await activeProject();
		const phase = (
			await cmd<{ id: string }>('create_phase', undefined, {
				project_id: projectId,
				title: 'Resolve the route'
			})
		).result.id;
		const question = (
			await cmd<{ id: string }>('create_question', undefined, {
				area_id: areaId,
				question: 'Which route should be canonical?'
			})
		).result.id;
		await cmd('assign_to_project', undefined, {
			work_id: question,
			project_id: projectId,
			phase_id: phase
		});

		await cmd('activate_phase', phase);
		await expect(cmd('complete_phase', phase)).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});
		await cmd('withdraw_question', question, { reason: 'Answered outside the project' });
		await cmd('complete_phase', phase);
		expect(loadPhase(getWork3Db(), phase)?.status).toBe('completed');
	});

	it('keeps succeeded Changes open until verification passes in every Phase projection', async () => {
		const projectId = await activeProject();
		const phase = (
			await cmd<{ id: string }>('create_phase', undefined, {
				project_id: projectId,
				title: 'Deploy and verify'
			})
		).result.id;
		const change = (
			await cmd<{ id: string }>('create_change', undefined, {
				area_id: areaId,
				title: 'Deploy the ledger',
				scope_allowed: ['Project route'],
				targets: { routes: ['/work/projects/[id]'] },
				risk: { level: 'low' },
				acceptance_criteria: [{ id: 'c1', text: 'Ledger renders' }],
				plan: { title: 'Ledger deployment', steps: ['Build', 'Verify'] }
			})
		).result.id;
		await cmd('assign_to_project', undefined, {
			work_id: change,
			project_id: projectId,
			phase_id: phase
		});
		getWork3Db()
			.prepare(
				`UPDATE change_requests
				    SET execution_state = 'succeeded', verification_state = 'not_started'
				  WHERE entity_id = ?`
			)
			.run(change);

		await cmd('activate_phase', phase);
		await expect(cmd('complete_phase', phase)).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});
		const { getObjectReader } = await import('../read/registry.js');
		const phaseList = await getObjectReader('phase').list({
			view: 'list',
			filters: { project: projectId },
			limit: 10,
			offset: 0
		});
		expect(phaseList.items[0]).toMatchObject({
			open_work: 1,
			work_total: 1,
			work_completed: 0
		});
		const project = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(
			(project.work as Array<{ id: string; terminal: boolean }>).find((item) => item.id === change)
		).toMatchObject({ terminal: false });

		getWork3Db()
			.prepare(`UPDATE change_requests SET verification_state = 'passed' WHERE entity_id = ?`)
			.run(change);
		await cmd('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: change,
			target_id: projectId,
			criterion_id: 'cc1',
			source_refs: [{ kind: 'file', ref: '/tmp/verified-change' }]
		});
		expect(satisfiedCriteria(getWork3Db(), projectId).has('cc1')).toBe(true);
		await cmd('start_rollback', change);
		expect(satisfiedCriteria(getWork3Db(), projectId).has('cc1')).toBe(false);
		await expect(
			cmd('link_work', undefined, {
				rel_type: 'satisfies',
				source_id: change,
				target_id: projectId,
				criterion_id: 'cc1',
				source_refs: [{ kind: 'file', ref: '/tmp/stale-change-proof' }]
			})
		).rejects.toMatchObject({ code: 'transition_requirements_not_met' });
		await expect(cmd('complete_phase', phase)).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});
		expect(projectProgress(getWork3Db(), projectId)).toMatchObject({
			work_open: 1,
			work_completed: 0
		});

		await cmd('complete_rollback', change, { summary: 'Restored the prior deployment' });
		await cmd('complete_phase', phase);
		expect(loadPhase(getWork3Db(), phase)?.status).toBe('completed');
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
		await expect(
			cmd('achieve_milestone', milestone, {
				source_refs: [{ kind: 'url', ref: 'https://app.example/health' }],
				waive_sources_reason: 'Operator waiver'
			})
		).rejects.toMatchObject({
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

	it('keeps an earlier source waiver visible in history after re-achievement', async () => {
		const projectId = await activeProject();
		const milestone = (
			await cmd<{ id: string }>('create_milestone', undefined, {
				project_id: projectId,
				title: 'Generation checkpoint',
				success_condition: 'Each generation is auditable'
			})
		).result.id;
		await cmd('achieve_milestone', milestone, {
			waive_sources_reason: 'Legacy environment had no durable capture'
		});
		await cmd('reopen_milestone', milestone, { reason: 'A new generation is required' });
		await cmd('achieve_milestone', milestone, {
			source_refs: [{ kind: 'file', ref: '/tmp/current-generation-proof' }]
		});
		transferWork3OutboxOnce();

		const { getObjectReader } = await import('../read/registry.js');
		const detail = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		const achievementSummaries = (
			detail.history as Array<{ event_type: string; subject_id: string; summary: string }>
		)
			.filter(
				(event) => event.subject_id === milestone && event.event_type === 'milestone_achieved'
			)
			.map((event) => event.summary);
		expect(achievementSummaries).toEqual(
			expect.arrayContaining([
				expect.stringContaining('sources waived: Legacy environment had no durable capture')
			])
		);
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
		const satisfaction = await cmd<{ id: string }>('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: milestone,
			source_refs: [{ kind: 'file', ref: '/tmp/cancelled-milestone-proof' }]
		});

		const cancelled = await cmd('cancel_milestone', milestone, { reason: 'No longer meaningful' });
		expect(cancelled.events.some((event) => event.event_type === 'satisfies_invalidated')).toBe(
			true
		);
		expect(
			getWork3Db()
				.prepare('SELECT invalidated_at FROM relationships WHERE id = ?')
				.get(satisfaction.result.id)
		).toMatchObject({ invalidated_at: expect.any(Number) });
		await expect(
			cmd('link_work', undefined, {
				rel_type: 'satisfies',
				source_id: task,
				target_id: milestone,
				source_refs: [{ kind: 'file', ref: '/tmp/late-cancelled-proof' }]
			})
		).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['reopen_milestone']
		});
		await cmd('reopen_milestone', milestone, { reason: 'Meaningful again' });
		expect(loadMilestone(getWork3Db(), milestone)?.status).toBe('planned');
	});

	it('keeps reopened Milestone satisfaction proof historical across re-achievement', async () => {
		const projectId = await activeProject();
		const milestone = (
			await cmd<{ id: string }>('create_milestone', undefined, {
				project_id: projectId,
				title: 'Versioned checkpoint',
				success_condition: 'The current result is proven'
			})
		).result.id;
		const task = await projectTask(projectId, 'Produce reusable proof');
		await completeTask(task);
		const oldLink = await cmd<{ id: string }>('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: milestone,
			source_refs: [{ kind: 'file', ref: '/tmp/old-milestone-proof' }]
		});
		await cmd('achieve_milestone', milestone, {
			source_refs: [{ kind: 'file', ref: '/tmp/old-achievement-proof' }]
		});
		await cmd('reopen_milestone', milestone, { reason: 'The checkpoint must be proven again' });

		const { getObjectReader } = await import('../read/registry.js');
		const reopened = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(
			(reopened.milestones as Array<Record<string, unknown>>).find(
				(entry) => entry.id === milestone
			)
		).toMatchObject({
			proof_historical: true,
			satisfactions: [],
			historical_satisfactions: [
				expect.objectContaining({
					id: oldLink.result.id,
					source_refs: [{ kind: 'file', ref: '/tmp/old-milestone-proof' }]
				})
			]
		});

		const newLink = await cmd<{ id: string }>('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: milestone,
			source_refs: [{ kind: 'file', ref: '/tmp/new-milestone-proof' }]
		});
		expect(newLink.result.id).not.toBe(oldLink.result.id);
		await cmd('achieve_milestone', milestone, {
			source_refs: [{ kind: 'file', ref: '/tmp/new-achievement-proof' }]
		});
		const achievedAgain = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(
			(achievedAgain.milestones as Array<Record<string, unknown>>).find(
				(entry) => entry.id === milestone
			)
		).toMatchObject({
			proof_historical: false,
			source_refs: [{ kind: 'file', ref: '/tmp/new-achievement-proof' }],
			satisfactions: [expect.objectContaining({ id: newLink.result.id })],
			historical_satisfactions: [expect.objectContaining({ id: oldLink.result.id })]
		});
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

		const { getObjectReader } = await import('../read/registry.js');
		const detail = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		const criterion = (
			detail.completion_criteria as Array<{
				id: string;
				satisfactions: Array<{ source_revision: string; source_refs: unknown[] }>;
			}>
		).find((entry) => entry.id === 'cc1');
		expect(criterion?.satisfactions[0]).toMatchObject({
			source_revision: expect.any(String),
			source_refs: [{ kind: 'file', ref: '/tmp/x', label: 'Proof' }]
		});
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

	it('full Project projections include typed current work across all four Work families', async () => {
		const projectId = await activeProject();
		const taskId = await projectTask(projectId, 'Implement the route');
		const questionId = (
			await cmd<{ id: string }>('create_question', undefined, {
				area_id: areaId,
				question: 'Which route should operators use?',
				target_at: Date.now() + 86_400_000
			})
		).result.id;
		const decisionId = (
			await cmd<{ id: string }>('create_decision', undefined, {
				area_id: areaId,
				title: 'Choose the operator route',
				prompt: 'Which route should be canonical?',
				consequence_of_no_decision: 'Navigation remains ambiguous',
				deciders: ['fred'],
				options: [
					{ id: 'ledger', label: 'Project ledger' },
					{ id: 'browse', label: 'Browse surface' }
				],
				recommendation: { option_id: 'ledger' }
			})
		).result.id;
		const changeId = (
			await cmd<{ id: string }>('create_change', undefined, {
				area_id: areaId,
				title: 'Deploy the ledger',
				scope_allowed: ['Project route'],
				targets: { routes: ['/work/projects/[id]'] },
				risk: { level: 'low' },
				acceptance_criteria: [{ id: 'c1', text: 'Ledger renders' }],
				plan: { title: 'Ledger deployment', steps: ['Build', 'Verify'] }
			})
		).result.id;
		for (const workId of [questionId, decisionId, changeId]) {
			await cmd('assign_to_project', undefined, { work_id: workId, project_id: projectId });
		}

		const { getObjectReader } = await import('../read/registry.js');
		const detail = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		const work = detail.work as Array<Record<string, unknown>>;

		expect(work.map((item) => item.type).sort()).toEqual([
			'change_request',
			'decision',
			'question',
			'task'
		]);
		expect(work.find((item) => item.id === taskId)).toMatchObject({
			type: 'task',
			title: 'Implement the route',
			terminal: false
		});
		expect(work.find((item) => item.id === questionId)).toMatchObject({
			type: 'question',
			due_at: expect.any(Number),
			terminal: false
		});
		expect(work.find((item) => item.id === decisionId)).toMatchObject({
			type: 'decision',
			title: 'Choose the operator route',
			terminal: false
		});
		expect(work.find((item) => item.id === changeId)).toMatchObject({
			type: 'change_request',
			secondary_state: 'not_started',
			terminal: false
		});
	});

	it('merges assigned Work, Plans, Reviews, and Authorizations into Project history', async () => {
		const projectId = await activeProject();
		const task = await projectTask(projectId, 'Finish an auditable outcome');
		await completeTask(task);
		const change = await cmd<{ id: string; plan_id: string }>('create_change', undefined, {
			area_id: areaId,
			title: 'Ship an audited change',
			scope_allowed: ['Project ledger'],
			targets: { routes: ['/work/projects/[id]'] },
			risk: { level: 'low' },
			acceptance_criteria: [{ id: 'c1', text: 'History is complete' }],
			plan: { title: 'Audited change plan', steps: ['Implement', 'Verify'] }
		});
		await cmd('assign_to_project', undefined, {
			work_id: change.result.id,
			project_id: projectId
		});
		await cmd('submit_plan', change.result.plan_id);
		const planRevision = getWork3Db()
			.prepare(
				`SELECT id FROM plan_revisions
				  WHERE parent_id = ? AND state = 'submitted' AND is_current = 1`
			)
			.get(change.result.plan_id) as { id: string };
		await cmd('create_review', undefined, {
			subject_id: change.result.plan_id,
			subject_revision: planRevision.id,
			outcome: 'approved',
			summary: 'The route and checks are sound',
			source_refs: [{ kind: 'file', ref: '/tmp/project-review-proof', label: 'Review proof' }]
		});
		await cmd('authorize_change', change.result.id, {}, person);
		transferWork3OutboxOnce();

		const { getObjectReader } = await import('../read/registry.js');
		const detail = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		const history = detail.history as Array<{
			event_type: string;
			authority_act: boolean;
			source_refs: unknown[];
		}>;
		expect(history.map((event) => event.event_type)).toEqual(
			expect.arrayContaining([
				'task_completed',
				'work_assigned',
				'plan_submitted',
				'review_created',
				'authorization_granted'
			])
		);
		expect(history.map((event) => event.event_type)).not.toContain('change_created');
		expect(history.find((event) => event.event_type === 'review_created')).toMatchObject({
			source_refs: [{ kind: 'file', ref: '/tmp/project-review-proof', label: 'Review proof' }]
		});
		expect(history.find((event) => event.event_type === 'authorization_granted')).toMatchObject({
			authority_act: true
		});
	});

	it('includes Phase-attached Plans and their Reviews as static Project history', async () => {
		const projectId = await activeProject();
		const phase = (
			await cmd<{ id: string }>('create_phase', undefined, {
				project_id: projectId,
				title: 'Reviewed route'
			})
		).result.id;
		const plan = await cmd<{ id: string }>('create_plan', undefined, {
			work_item_id: phase,
			title: 'Phase execution plan',
			steps: ['Execute the reviewed route']
		});
		await cmd('submit_plan', plan.result.id);
		const revision = getWork3Db()
			.prepare(
				`SELECT id FROM plan_revisions
				  WHERE parent_id = ? AND state = 'submitted' AND is_current = 1`
			)
			.get(plan.result.id) as { id: string };
		const review = await cmd<{ id: string }>('create_review', undefined, {
			subject_id: plan.result.id,
			subject_revision: revision.id,
			outcome: 'approved',
			summary: 'The Phase route is ready'
		});
		transferWork3OutboxOnce();

		const { getObjectReader } = await import('../read/registry.js');
		const history = ((await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!.history ?? []) as Array<{ event_type: string; subject_id: string }>;
		expect(
			history
				.filter((event) => event.subject_id === plan.result.id)
				.map((event) => event.event_type)
		).toEqual(expect.arrayContaining(['plan_created', 'plan_submitted']));
		expect(history).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					event_type: 'review_created',
					subject_id: review.result.id
				})
			])
		);
	});

	it('batches canonical Project-history lookups for large assignment histories', async () => {
		const projectId = await activeProject();
		for (let index = 0; index < 205; index += 1) {
			await projectTask(projectId, `Historical work ${index}`);
		}
		transferWork3OutboxOnce();

		const db = getWork3Db();
		const prepare = vi.spyOn(db, 'prepare');
		const { getObjectReader } = await import('../read/registry.js');
		await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		});

		const canonicalHistoryQueries = prepare.mock.calls
			.map(([sql]) => sql)
			.filter(
				(sql) =>
					sql.includes('FROM plans') ||
					sql.includes('FROM reviews') ||
					sql.includes('FROM authorizations')
			);
		expect(canonicalHistoryQueries.length).toBeGreaterThan(3);
		expect(
			Math.max(...canonicalHistoryQueries.map((sql) => [...sql.matchAll(/\?/g)].length))
		).toBeLessThanOrEqual(200);
		prepare.mockRestore();
	});

	it('scopes Work history to the Project assignment intervals it actually belonged to', async () => {
		const first = await activeProject();
		const second = await activeProject();
		const task = (
			await cmd<{ id: string }>('create_task', undefined, {
				area_id: areaId,
				title: 'Move with bounded history'
			})
		).result.id;
		const firstAssignment = await cmd('assign_to_project', undefined, {
			work_id: task,
			project_id: first
		});
		expect(firstAssignment.events[0]).toMatchObject({
			event_type: 'work_assigned',
			version_from: 1,
			version_to: 2
		});
		await cmd('ready_task', task, { owner: 'agent:main' });
		await cmd('start_task', task);
		await cmd('set_current_next_item', first, { item_id: task });
		await cmd('assign_to_project', undefined, { work_id: task, project_id: second });
		await cmd('complete_task', task, { result_summary: 'Completed after reassignment' });
		transferWork3OutboxOnce();

		const { getObjectReader } = await import('../read/registry.js');
		const firstHistory = (
			(await getObjectReader('project').get(first, {
				view: 'full',
				filters: {},
				limit: 1,
				offset: 0
			}))!.history as Array<{
				event_type: string;
				subject_id: string;
				version_from: number | null;
				version_to: number | null;
			}>
		).filter(
			(event) => event.subject_id === task || event.event_type === 'project_next_item_cleared'
		);
		const secondHistory = (
			(await getObjectReader('project').get(second, {
				view: 'full',
				filters: {},
				limit: 1,
				offset: 0
			}))!.history as Array<{ event_type: string; subject_id: string }>
		).filter((event) => event.subject_id === task);

		expect(firstHistory.map((event) => event.event_type)).toEqual(
			expect.arrayContaining([
				'work_assigned',
				'task_ready',
				'task_started',
				'project_next_item_cleared'
			])
		);
		expect(firstHistory.map((event) => event.event_type)).not.toContain('task_created');
		expect(firstHistory.map((event) => event.event_type)).not.toContain('task_completed');
		expect(
			firstHistory.find((event) => event.event_type === 'project_next_item_cleared')
		).toMatchObject({
			version_from: expect.any(Number),
			version_to: expect.any(Number)
		});

		expect(secondHistory.map((event) => event.event_type)).toEqual(
			expect.arrayContaining(['work_assigned', 'task_completed'])
		);
		expect(secondHistory.map((event) => event.event_type)).not.toContain('task_created');
		expect(secondHistory.map((event) => event.event_type)).not.toContain('task_ready');
		expect(secondHistory.map((event) => event.event_type)).not.toContain('task_started');
	});

	it('uses pending assignment outbox boundaries before falling back to legacy history', async () => {
		const projectId = await activeProject();
		const task = (
			await cmd<{ id: string }>('create_task', undefined, {
				area_id: areaId,
				title: 'Join with a pending assignment event'
			})
		).result.id;
		transferWork3OutboxOnce();
		await cmd('assign_to_project', undefined, { work_id: task, project_id: projectId });
		const pending = getWork3Db()
			.prepare(
				`SELECT COUNT(*) AS count FROM event_outbox
				  WHERE event_type = 'work_assigned' AND transferred_at IS NULL`
			)
			.get() as { count: number };
		expect(pending.count).toBe(1);

		const { getObjectReader } = await import('../read/registry.js');
		const history = (
			(await getObjectReader('project').get(projectId, {
				view: 'full',
				filters: {},
				limit: 1,
				offset: 0
			}))!.history as Array<{ event_type: string; subject_id: string }>
		).filter((event) => event.subject_id === task);
		expect(history.map((event) => event.event_type)).not.toContain('task_created');
	});

	it('projects Milestone proof and child/proof events into the Project ledger', async () => {
		const projectId = await activeProject();
		const phase = (
			await cmd<{ id: string }>('create_phase', undefined, {
				project_id: projectId,
				title: 'Proof phase'
			})
		).result.id;
		const milestone = (
			await cmd<{ id: string }>('create_milestone', undefined, {
				project_id: projectId,
				title: 'Proof checkpoint',
				success_condition: 'The result is verified'
			})
		).result.id;
		const task = await projectTask(projectId, 'Produce the evidence');
		await cmd('assign_to_project', undefined, {
			work_id: task,
			project_id: projectId,
			phase_id: phase
		});
		await cmd('link_work', undefined, {
			rel_type: 'contributes_to',
			source_id: task,
			target_id: milestone,
			source_refs: [{ kind: 'file', ref: '/tmp/milestone-contribution' }]
		});
		await cmd('link_work', undefined, {
			rel_type: 'contributes_to',
			source_id: task,
			target_id: projectId,
			criterion_id: 'cc1',
			source_refs: [{ kind: 'file', ref: '/tmp/criterion-contribution' }]
		});
		await cmd('link_work', undefined, {
			rel_type: 'contributes_to',
			source_id: task,
			target_id: projectId,
			source_refs: [{ kind: 'file', ref: '/tmp/project-contribution' }]
		});
		await completeTask(task);
		await cmd('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: milestone,
			criterion_id: 'cc1',
			source_refs: [{ kind: 'file', ref: '/tmp/milestone-proof', label: 'Proof' }]
		});
		await cmd('waive_completion_criterion', projectId, {
			criterion_id: 'cc1',
			reason: 'Covered by the Milestone checkpoint',
			authority_source: {
				kind: 'human_statement',
				ref: 'operator:criterion-waiver',
				label: 'Operator criterion-waiver instruction'
			}
		});
		transferWork3OutboxOnce();

		const { getObjectReader } = await import('../read/registry.js');
		expect(getObjectReader('project').knownFields).toContain('unscoped_contributions');
		const project = (await getObjectReader('project').get(projectId, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		const projectedMilestone = (
			project.milestones as Array<{
				id: string;
				proof_historical: boolean;
				contributions: Array<{ source_id: string; source_refs: unknown[] }>;
				satisfactions: Array<{ source_id: string; source_refs: unknown[] }>;
			}>
		).find((entry) => entry.id === milestone);
		expect(projectedMilestone).toMatchObject({
			proof_historical: false,
			contributions: [
				{
					source_id: task,
					source_refs: [{ kind: 'file', ref: '/tmp/milestone-contribution' }]
				}
			],
			satisfactions: [
				{
					source_id: task,
					source_refs: [{ kind: 'file', ref: '/tmp/milestone-proof', label: 'Proof' }]
				}
			]
		});
		expect(
			(
				project.completion_criteria as Array<{
					id: string;
					contributions: Array<{ source_id: string; source_refs: unknown[] }>;
					satisfactions: unknown[];
				}>
			).find((criterion) => criterion.id === 'cc1')
		).toMatchObject({
			contributions: [
				{
					source_id: task,
					source_refs: [{ kind: 'file', ref: '/tmp/criterion-contribution' }]
				}
			],
			satisfactions: []
		});
		expect(project.unscoped_contributions).toEqual([
			expect.objectContaining({
				source_id: task,
				target_id: projectId,
				source_refs: [{ kind: 'file', ref: '/tmp/project-contribution' }]
			})
		]);
		const projectRelationships = (
			project.relationships as { incoming: Array<{ target_id: string }> }
		).incoming;
		expect(projectRelationships.every((link) => link.target_id === projectId)).toBe(true);
		expect(projectRelationships.some((link) => link.target_id === milestone)).toBe(false);
		const history = project.history as Array<{
			event_type: string;
			authority_act: boolean;
			source_refs: unknown[];
		}>;
		expect(history.map((event) => event.event_type)).toEqual(
			expect.arrayContaining(['phase_created', 'milestone_created', 'work_linked'])
		);
		expect(history.find((event) => event.event_type === 'criterion_waived')).toMatchObject({
			authority_act: true,
			source_refs: [
				{
					kind: 'human_statement',
					ref: 'operator:criterion-waiver',
					label: 'Operator criterion-waiver instruction'
				}
			]
		});
	});

	it('derives independent operator risk flags on the server', async () => {
		const now = Date.now();
		const projectId = await createProject({ target_at: now - 60_000 });
		await cmd('plan_project', projectId);
		await cmd('activate_project', projectId, {
			plan_not_required_reason: 'Small exploratory effort'
		});

		expect(projectRiskFlags(getWork3Db(), loadProject(getWork3Db(), projectId)!, now)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: 'past_target' }),
				expect.objectContaining({ key: 'no_next_item' }),
				expect.objectContaining({ key: 'open_criteria' })
			])
		);
	});

	it('counts blocked and terminal Work across all four Project Work families', async () => {
		const projectId = await activeProject();
		const nextTask = await projectTask(projectId, 'Continue delivery');
		await cmd('set_current_next_item', projectId, { item_id: nextTask });
		const question = (
			await cmd<{ id: string }>('create_question', undefined, {
				area_id: areaId,
				question: 'What is the vendor ETA?'
			})
		).result.id;
		await cmd('assign_to_project', undefined, { work_id: question, project_id: projectId });
		await cmd('create_blocker', undefined, {
			blocked_id: question,
			source_kind: 'external',
			source_label: 'Vendor',
			reason: 'Vendor has not supplied an ETA',
			resolution_condition: 'Vendor supplies an ETA'
		});

		expect(projectProgress(getWork3Db(), projectId)).toMatchObject({
			work_open: 2,
			work_blocked: 1,
			work_completed: 0
		});
		expect(projectRiskFlags(getWork3Db(), loadProject(getWork3Db(), projectId)!)).toEqual(
			expect.arrayContaining([expect.objectContaining({ key: 'blocked_work' })])
		);
		expect(projectHealth(getWork3Db(), loadProject(getWork3Db(), projectId)!)).toMatchObject({
			health: 'at_risk',
			reason: '1 blocked Work item(s) in the Project'
		});

		await cmd('withdraw_question', question, { reason: 'Vendor input is no longer required' });
		expect(projectProgress(getWork3Db(), projectId)).toMatchObject({
			work_open: 1,
			work_blocked: 0,
			work_completed: 1
		});
		expect(
			projectRiskFlags(getWork3Db(), loadProject(getWork3Db(), projectId)!).some(
				(flag) => flag.key === 'blocked_work'
			)
		).toBe(false);
	});

	it('counts distinct blocked Work identities even when their states match', async () => {
		const projectId = await activeProject();
		const first = await projectTask(projectId, 'First blocked item');
		const second = await projectTask(projectId, 'Second blocked item');
		for (const blockedId of [first, second]) {
			await cmd('create_blocker', undefined, {
				blocked_id: blockedId,
				source_kind: 'external',
				source_label: 'Shared dependency',
				reason: 'The shared dependency is unavailable',
				resolution_condition: 'The shared dependency becomes available'
			});
		}

		expect(projectProgress(getWork3Db(), projectId)).toMatchObject({
			work_open: 2,
			work_blocked: 2,
			work_completed: 0
		});
	});

	it('keeps satisfied and waived criteria disjoint in progress and risk calculations', async () => {
		const projectId = await createProject({
			completion_criteria: [
				{ id: 'cc1', text: 'All gates pass' },
				{ id: 'cc2', text: 'Operator approval is recorded' }
			]
		});
		await cmd('plan_project', projectId);
		await cmd('activate_project', projectId, {
			plan_not_required_reason: 'Small exploratory effort'
		});
		await cmd(
			'waive_completion_criterion',
			projectId,
			{ criterion_id: 'cc1', reason: 'Temporarily descoped' },
			person
		);
		const task = await projectTask(projectId, 'Prove the first criterion anyway');
		await completeTask(task);
		await cmd('link_work', undefined, {
			rel_type: 'satisfies',
			source_id: task,
			target_id: projectId,
			criterion_id: 'cc1',
			source_refs: [{ kind: 'file', ref: '/tmp/criterion-proof' }]
		});

		expect(projectProgress(getWork3Db(), projectId)).toMatchObject({
			criteria_total: 2,
			criteria_satisfied: 1,
			criteria_waived: 0
		});
		expect(projectRiskFlags(getWork3Db(), loadProject(getWork3Db(), projectId)!)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					key: 'open_criteria',
					label: '1 completion criterion is still open'
				})
			])
		);
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
