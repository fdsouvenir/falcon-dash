// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	executeCommand,
	getWork3Db,
	loadEntity,
	loadTask,
	registerWork3Objects
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * CONTRACT-TEST TEMPLATE (#335 release-gate evidence, gate 1).
 *
 * Every object family copies this structure. For each semantic command:
 *   1. legal transitions from every legal source state
 *   2. illegal transitions → transition_not_allowed with valid alternatives
 *   3. guards → transition_requirements_not_met / validation_failed
 *   4. repeating an already-achieved transition → successful semantic no-op
 *   5. idempotency-key replay returns the original result, no new effects
 *   6. stale expected_version → version_conflict, no partial effects
 *   7. type-specific contradiction rules
 */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };

async function cmd<T = Record<string, unknown>>(
	command: string,
	target?: string,
	payload: Record<string, unknown> = {},
	options: { expectedVersion?: number; idempotencyKey?: string } = {}
) {
	return executeCommand<T>({
		command,
		actor: agent,
		target: target ?? null,
		expected_version: options.expectedVersion,
		idempotency_key: options.idempotencyKey,
		payload
	});
}

/** Current envelope version — commands in tests always pass the live version. */
function versionOf(id: string): number {
	return loadEntity(getWork3Db(), id)!.version;
}

async function transition(command: string, target: string, payload: Record<string, unknown> = {}) {
	return cmd(command, target, payload, { expectedVersion: versionOf(target) });
}

let areaId: string;

async function createTask(payload: Record<string, unknown> = {}): Promise<string> {
	const created = await cmd<{ id: string }>('create_task', undefined, {
		area_id: areaId,
		title: 'Write the report',
		...payload
	});
	return created.result.id;
}

/** Drive a task to the given status through legal transitions. */
async function taskAt(status: string, payload: Record<string, unknown> = {}): Promise<string> {
	const id = await createTask(payload);
	if (status === 'backlog') return id;
	await transition('ready_task', id, { owner: 'agent:main' });
	if (status === 'ready') return id;
	if (status === 'waiting') {
		await transition('wait_task', id, {
			waiting_on: 'fred',
			reason: 'Needs input',
			resume_condition: 'Fred replies'
		});
		return id;
	}
	await transition('start_task', id);
	if (status === 'in_progress') return id;
	if (status === 'in_review') {
		await transition('submit_task_for_review', id, { result_summary: 'Draft ready' });
		return id;
	}
	if (status === 'completed') {
		await transition('complete_task', id, { result_summary: 'Done' });
		return id;
	}
	if (status === 'cancelled') {
		await transition('cancel_task', id, { reason: 'Not needed' });
		return id;
	}
	throw new Error(`unhandled status ${status}`);
}

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	const area = await cmd<{ id: string }>('create_area', undefined, { title: 'Ops' });
	areaId = area.result.id;
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('create_task', () => {
	it('creates a backlog Task in an active Area', async () => {
		const created = await cmd<{ id: string; status: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Write the report',
			priority: 'high',
			owner: 'agent:main'
		});
		expect(created.result.status).toBe('backlog');
		const envelope = loadEntity(getWork3Db(), created.result.id)!;
		expect(envelope).toMatchObject({ type: 'task', area_id: areaId, version: 1 });
	});

	it('requires title and a valid active Area', async () => {
		await expect(cmd('create_task', undefined, { area_id: areaId })).rejects.toMatchObject({
			code: 'validation_failed'
		});
		await expect(
			cmd('create_task', undefined, { area_id: 'a999', title: 'X' })
		).rejects.toMatchObject({ code: 'validation_failed' });

		await transition('archive_area', areaId, {});
		await expect(
			cmd('create_task', undefined, { area_id: areaId, title: 'X' })
		).rejects.toMatchObject({ code: 'invariant_violation' });
	});

	it('rejects unknown priority values loudly', async () => {
		await expect(
			cmd('create_task', undefined, { area_id: areaId, title: 'X', priority: 'mega' })
		).rejects.toMatchObject({ code: 'validation_failed' });
	});
});

describe('ready_task', () => {
	it('moves backlog → ready when an owner exists', async () => {
		const id = await createTask({ owner: 'agent:main' });
		const result = await transition('ready_task', id);
		expect(result.result).toMatchObject({ status: 'ready' });
		expect(versionOf(id)).toBe(2);
	});

	it('accepts an owner in the payload', async () => {
		const id = await createTask();
		const result = await transition('ready_task', id, { owner: 'agent:main' });
		expect(result.result).toMatchObject({ status: 'ready', owner: 'agent:main' });
	});

	it('requires an owner', async () => {
		const id = await createTask();
		await expect(transition('ready_task', id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			details: { missing: ['owner'] }
		});
	});

	it('is a semantic no-op when already ready', async () => {
		const id = await taskAt('ready');
		const repeat = await transition('ready_task', id);
		expect(repeat.noop).toBe(true);
		expect(versionOf(id)).toBe(2);
	});

	it('rejects illegal source states with alternatives', async () => {
		const id = await taskAt('completed');
		await expect(transition('ready_task', id)).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['reopen_task']
		});
	});
});

describe('start_task', () => {
	it('moves ready → in_progress', async () => {
		const id = await taskAt('ready');
		const result = await transition('start_task', id);
		expect(result.result).toMatchObject({ status: 'in_progress' });
	});

	it('cannot start from backlog', async () => {
		const id = await createTask();
		await expect(transition('start_task', id)).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});
	});

	it('cannot start a blocked Task; unblocking clears the guard', async () => {
		const id = await taskAt('ready');
		const blocker = await cmd<{ id: string }>('create_blocker', undefined, {
			blocked_id: id,
			source_kind: 'external',
			source_label: 'Vendor API',
			reason: 'Waiting on vendor credentials',
			resolution_condition: 'Credentials arrive'
		});

		await expect(transition('start_task', id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			alternatives: ['resolve_blocker', 'invalidate_blocker']
		});
		// Blocking never rewrites lifecycle.
		expect(loadTask(getWork3Db(), id)?.status).toBe('ready');

		await transition('resolve_blocker', blocker.result.id, { summary: 'Credentials received' });
		const started = await transition('start_task', id);
		expect(started.result).toMatchObject({ status: 'in_progress' });
	});

	it('is a semantic no-op when already in progress', async () => {
		const id = await taskAt('in_progress');
		const repeat = await transition('start_task', id);
		expect(repeat.noop).toBe(true);
	});
});

describe('wait_task / resume_task', () => {
	it('requires structured waiting metadata', async () => {
		const id = await taskAt('in_progress');
		await expect(transition('wait_task', id, { waiting_on: 'fred' })).rejects.toMatchObject({
			code: 'validation_failed'
		});
	});

	it('stores waiting metadata and resumes to the prior status', async () => {
		const id = await taskAt('in_progress');
		await transition('wait_task', id, {
			waiting_on: 'fred',
			reason: 'Needs sign-off',
			resume_condition: 'Fred approves',
			follow_up_at: Date.now() + 86_400_000
		});
		let row = loadTask(getWork3Db(), id)!;
		expect(row.status).toBe('waiting');
		expect(row.waiting_on).toBe('fred');
		expect(row.waiting_resume_status).toBe('in_progress');

		await transition('resume_task', id);
		row = loadTask(getWork3Db(), id)!;
		expect(row.status).toBe('in_progress');
		// Resume clears waiting metadata (doc 02).
		expect(row.waiting_on).toBeNull();
		expect(row.waiting_reason).toBeNull();
		expect(row.waiting_since).toBeNull();
	});

	it('resumes a ready-waiting Task back to ready and honors an explicit destination', async () => {
		const id = await taskAt('waiting'); // waited from ready
		const resumed = await transition('resume_task', id);
		expect(resumed.result).toMatchObject({ status: 'ready' });

		await transition('wait_task', id, {
			waiting_on: 'ops',
			reason: 'Window closed',
			resume_condition: 'Window opens'
		});
		const explicit = await transition('resume_task', id, { to: 'ready' });
		expect(explicit.result).toMatchObject({ status: 'ready' });
	});

	it('wait is a no-op when already waiting; resume is a no-op when not waiting', async () => {
		const id = await taskAt('waiting');
		const repeat = await transition('wait_task', id, {
			waiting_on: 'someone-else',
			reason: 'x',
			resume_condition: 'y'
		});
		expect(repeat.noop).toBe(true);
		expect(loadTask(getWork3Db(), id)?.waiting_on).toBe('fred');

		await transition('resume_task', id);
		const resumeAgain = await transition('resume_task', id);
		expect(resumeAgain.noop).toBe(true);
	});
});

describe('submit_task_for_review / accept_task', () => {
	it('submits in_progress output for review, bumping the output revision', async () => {
		const id = await taskAt('in_progress');
		const submitted = await transition('submit_task_for_review', id, {
			result_summary: 'Draft v1'
		});
		expect(submitted.result).toMatchObject({ status: 'in_review', output_revision: 1 });
	});

	it('requires a result summary to submit', async () => {
		const id = await taskAt('in_progress');
		await expect(transition('submit_task_for_review', id)).rejects.toMatchObject({
			code: 'validation_failed'
		});
	});

	it('requires an approving Review of the current output revision before acceptance', async () => {
		const id = await taskAt('in_review');
		await expect(transition('accept_task', id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			details: { review_disposition: 'unreviewed' },
			alternatives: ['create_review']
		});
	});

	it('accepts reviewed output and completes with completed_at', async () => {
		const id = await taskAt('in_review');
		await cmd('create_review', undefined, {
			subject_id: id,
			subject_revision: '1',
			outcome: 'approved',
			summary: 'Output looks correct'
		});
		const accepted = await transition('accept_task', id);
		expect(accepted.result).toMatchObject({ status: 'completed' });
		const row = loadTask(getWork3Db(), id)!;
		expect(row.completed_at).not.toBeNull();
		expect(row.result_summary).toBe('Draft ready');
	});

	it('changes requested returns the Task to in_progress deterministically', async () => {
		const id = await taskAt('in_review');
		await cmd('create_review', undefined, {
			subject_id: id,
			subject_revision: '1',
			outcome: 'changes_requested',
			summary: 'Needs another pass',
			comments: [{ text: 'Cover the error path', severity: 'required' }]
		});
		expect(loadTask(getWork3Db(), id)?.status).toBe('in_progress');
	});

	it('cannot accept a Task that is not in review', async () => {
		const id = await taskAt('in_progress');
		await expect(transition('accept_task', id)).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});
	});
});

describe('complete_task', () => {
	it('completes in_progress directly with a result summary', async () => {
		const id = await taskAt('in_progress');
		const completed = await transition('complete_task', id, { result_summary: 'Shipped' });
		expect(completed.result).toMatchObject({ status: 'completed' });
	});

	it('requires result_summary (transition_requirements_not_met)', async () => {
		const id = await taskAt('in_progress');
		await expect(transition('complete_task', id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met',
			details: { missing: ['result_summary'] }
		});
	});

	it('repeated completion is an idempotent no-op (doc 01 invariant)', async () => {
		const id = await taskAt('completed');
		const repeat = await transition('complete_task', id, { result_summary: 'Done again' });
		expect(repeat.noop).toBe(true);
		expect(loadTask(getWork3Db(), id)?.result_summary).toBe('Done');
	});

	it('cannot complete from ready, waiting, or backlog', async () => {
		for (const status of ['backlog', 'ready', 'waiting']) {
			const id = await taskAt(status);
			await expect(transition('complete_task', id, { result_summary: 'x' })).rejects.toMatchObject({
				code: 'transition_not_allowed'
			});
		}
	});
});

describe('cancel_task', () => {
	it('cancels any nonterminal state with a reason', async () => {
		for (const status of ['backlog', 'ready', 'in_progress', 'waiting', 'in_review']) {
			const id = await taskAt(status);
			const cancelled = await transition('cancel_task', id, { reason: 'Descoped' });
			expect(cancelled.result).toMatchObject({ status: 'cancelled' });
			expect(loadTask(getWork3Db(), id)?.cancel_reason).toBe('Descoped');
		}
	});

	it('requires a reason', async () => {
		const id = await createTask();
		await expect(transition('cancel_task', id)).rejects.toMatchObject({
			code: 'validation_failed'
		});
	});

	it('cannot cancel a completed Task; repeat cancel is a no-op', async () => {
		const completed = await taskAt('completed');
		await expect(transition('cancel_task', completed, { reason: 'x' })).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});

		const cancelled = await taskAt('cancelled');
		const repeat = await transition('cancel_task', cancelled, { reason: 'again' });
		expect(repeat.noop).toBe(true);
	});
});

describe('reopen_task', () => {
	it('reopens terminal Tasks to ready with a reason, clearing terminal metadata', async () => {
		for (const status of ['completed', 'cancelled']) {
			const id = await taskAt(status);
			const reopened = await transition('reopen_task', id, { reason: 'Missed a case' });
			expect(reopened.result).toMatchObject({ status: 'ready' });
			const row = loadTask(getWork3Db(), id)!;
			expect(row.completed_at).toBeNull();
			expect(row.cancelled_at).toBeNull();
			expect(row.cancel_reason).toBeNull();
			expect(row.result_summary).toBeNull();
		}
	});

	it('requires a reason and a terminal source state', async () => {
		const terminal = await taskAt('completed');
		await expect(transition('reopen_task', terminal)).rejects.toMatchObject({
			code: 'validation_failed'
		});
		const active = await taskAt('in_progress');
		await expect(transition('reopen_task', active, { reason: 'x' })).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});
	});
});

describe('optimistic concurrency and idempotency (template §5–6)', () => {
	it('stale expected_version → version_conflict with no partial effects', async () => {
		const id = await taskAt('ready');
		const staleVersion = versionOf(id);
		await transition('wait_task', id, {
			waiting_on: 'fred',
			reason: 'x',
			resume_condition: 'y'
		});
		await expect(
			cmd('start_task', id, {}, { expectedVersion: staleVersion })
		).rejects.toMatchObject({
			code: 'version_conflict',
			details: { expected_version: staleVersion }
		});
		expect(loadTask(getWork3Db(), id)?.status).toBe('waiting');
	});

	it('idempotency-key replay returns the original result without re-executing', async () => {
		const id = await taskAt('ready');
		const version = versionOf(id);
		const first = await cmd(
			'start_task',
			id,
			{},
			{ expectedVersion: version, idempotencyKey: 'k1' }
		);
		const replay = await cmd(
			'start_task',
			id,
			{},
			{ expectedVersion: version, idempotencyKey: 'k1' }
		);
		expect(replay.replayed).toBe(true);
		expect(replay.result).toEqual(first.result);
		expect(versionOf(id)).toBe(version + 1);
	});

	it('same key with a different payload → idempotency_conflict', async () => {
		const id = await taskAt('in_progress');
		const version = versionOf(id);
		await cmd(
			'complete_task',
			id,
			{ result_summary: 'A' },
			{ expectedVersion: version, idempotencyKey: 'k2' }
		);
		await expect(
			cmd(
				'complete_task',
				id,
				{ result_summary: 'B' },
				{ expectedVersion: version, idempotencyKey: 'k2' }
			)
		).rejects.toMatchObject({ code: 'idempotency_conflict' });
	});
});

describe('contradiction rules (template §7)', () => {
	it('terminal transitions clear waiting metadata and invalidate active blockers atomically', async () => {
		const id = await taskAt('waiting');
		await cmd('create_blocker', undefined, {
			blocked_id: id,
			source_kind: 'person',
			source_label: 'Fred',
			reason: 'Needs approval',
			resolution_condition: 'Approval given'
		});

		const cancelled = await transition('cancel_task', id, { reason: 'Descoped' });
		const row = loadTask(getWork3Db(), id)!;
		expect(row.waiting_on).toBeNull();

		const blockerEvent = cancelled.events.find((e) => e.event_type === 'blocker_invalidated');
		expect(blockerEvent).toBeDefined();
		const blockers = getWork3Db()
			.prepare(`SELECT state FROM blockers WHERE blocked_id = ?`)
			.all(id) as Array<{ state: string }>;
		expect(blockers.every((blocker) => blocker.state === 'invalidated')).toBe(true);
	});

	it('a Task may be waiting and blocked simultaneously; blocked takes projection precedence', async () => {
		const id = await taskAt('waiting');
		await cmd('create_blocker', undefined, {
			blocked_id: id,
			source_kind: 'external',
			source_label: 'Vendor',
			reason: 'Outage',
			resolution_condition: 'Service restored'
		});
		const { getObjectReader } = await import('../read/registry.js');
		const item = (await getObjectReader('task').get(id, {
			view: 'list',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(item.status).toBe('waiting');
		expect(item.actionability).toBe('blocked');
	});

	it('lifecycle fields are command-owned: every status change flows through commands and the Event Log', async () => {
		const id = await taskAt('completed');
		const outbox = getWork3Db()
			.prepare(
				`SELECT event_type FROM event_outbox WHERE subject_id = ? ORDER BY occurred_at ASC, id ASC`
			)
			.all(id) as Array<{ event_type: string }>;
		expect(outbox.map((row) => row.event_type)).toEqual([
			'task_created',
			'task_ready',
			'task_started',
			'task_completed'
		]);
	});
});
