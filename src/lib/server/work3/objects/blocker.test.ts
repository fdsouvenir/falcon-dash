// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import { executeCommand, getWork3Db, loadEntity, registerWork3Objects } from '../index.js';
import { loadBlocker } from './blocker.js';
import { loadTask } from './task.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/** Blocker contract tests (template from task.test.ts). */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };

async function cmd<T = Record<string, unknown>>(
	command: string,
	target?: string,
	payload: Record<string, unknown> = {}
) {
	return executeCommand<T>({
		command,
		actor: agent,
		target: target ?? null,
		expected_version: target ? loadEntity(getWork3Db(), target)!.version : undefined,
		payload
	});
}

let areaId: string;
let taskId: string;

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	areaId = (await cmd<{ id: string }>('create_area', undefined, { title: 'Ops' })).result.id;
	taskId = (
		await cmd<{ id: string }>('create_task', undefined, { area_id: areaId, title: 'Blocked work' })
	).result.id;
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

function externalBlockerPayload(overrides: Record<string, unknown> = {}) {
	return {
		blocked_id: taskId,
		source_kind: 'external',
		source_label: 'Vendor',
		reason: 'Vendor outage',
		resolution_condition: 'Service restored',
		...overrides
	};
}

describe('create_blocker', () => {
	it('creates an active blocker without touching the blocked lifecycle', async () => {
		const created = await cmd<{ id: string }>(
			'create_blocker',
			undefined,
			externalBlockerPayload()
		);
		expect(loadBlocker(getWork3Db(), created.result.id)).toMatchObject({
			blocked_id: taskId,
			state: 'active'
		});
		expect(loadTask(getWork3Db(), taskId)?.status).toBe('backlog');
	});

	it('only actionable Work may be blocked', async () => {
		await expect(
			cmd('create_blocker', undefined, externalBlockerPayload({ blocked_id: areaId }))
		).rejects.toMatchObject({ code: 'invariant_violation' });
	});

	it('terminal Work cannot be blocked', async () => {
		await cmd('ready_task', taskId, { owner: 'agent:main' });
		await cmd('start_task', taskId);
		await cmd('complete_task', taskId, { result_summary: 'Done' });
		await expect(cmd('create_blocker', undefined, externalBlockerPayload())).rejects.toMatchObject({
			code: 'invariant_violation'
		});
	});

	it('an item cannot block itself', async () => {
		await expect(
			cmd('create_blocker', undefined, {
				blocked_id: taskId,
				source_kind: 'work',
				source_work_id: taskId,
				reason: 'x',
				resolution_condition: 'y'
			})
		).rejects.toMatchObject({ code: 'invariant_violation' });
	});

	it('work-sourced blockers need an existing source; non-work sources need a label', async () => {
		await expect(
			cmd('create_blocker', undefined, {
				blocked_id: taskId,
				source_kind: 'work',
				reason: 'x',
				resolution_condition: 'y'
			})
		).rejects.toMatchObject({ code: 'validation_failed' });
		await expect(
			cmd('create_blocker', undefined, {
				blocked_id: taskId,
				source_kind: 'person',
				reason: 'x',
				resolution_condition: 'y'
			})
		).rejects.toMatchObject({ code: 'validation_failed' });
	});

	it('duplicate active blockers are idempotent no-ops returning the existing record', async () => {
		const first = await cmd<{ id: string }>('create_blocker', undefined, externalBlockerPayload());
		const duplicate = await cmd<{ id: string }>(
			'create_blocker',
			undefined,
			externalBlockerPayload({ reason: 'Different words, same source' })
		);
		expect(duplicate.noop).toBe(true);
		expect(duplicate.result.id).toBe(first.result.id);

		// A different source is a distinct blocker.
		const other = await cmd<{ id: string }>(
			'create_blocker',
			undefined,
			externalBlockerPayload({ source_label: 'Another vendor' })
		);
		expect(other.noop).toBe(false);
	});
});

describe('resolve_blocker / invalidate_blocker', () => {
	it('resolves with actor, timestamp, summary, and optional source refs', async () => {
		const blocker = (
			await cmd<{ id: string }>('create_blocker', undefined, externalBlockerPayload())
		).result.id;
		const resolved = await cmd('resolve_blocker', blocker, {
			summary: 'Service restored overnight',
			source_refs: [{ kind: 'url', ref: 'https://status.vendor.example/incident/1' }]
		});
		expect(resolved.events[0]).toMatchObject({
			event_type: 'blocker_resolved',
			actor: agent,
			source_refs: [{ kind: 'url', ref: 'https://status.vendor.example/incident/1' }]
		});
		expect(loadBlocker(getWork3Db(), blocker)).toMatchObject({
			state: 'resolved',
			resolved_summary: 'Service restored overnight'
		});
	});

	it('requires a resolution summary and an invalidation reason', async () => {
		const blocker = (
			await cmd<{ id: string }>('create_blocker', undefined, externalBlockerPayload())
		).result.id;
		await expect(cmd('resolve_blocker', blocker)).rejects.toMatchObject({
			code: 'validation_failed'
		});
		await expect(cmd('invalidate_blocker', blocker)).rejects.toMatchObject({
			code: 'validation_failed'
		});
	});

	it('resolution preserves history; terminal blockers reject the other transition', async () => {
		const blocker = (
			await cmd<{ id: string }>('create_blocker', undefined, externalBlockerPayload())
		).result.id;
		await cmd('resolve_blocker', blocker, { summary: 'Cleared' });

		const repeat = await cmd('resolve_blocker', blocker, { summary: 'Cleared again' });
		expect(repeat.noop).toBe(true);
		expect(loadBlocker(getWork3Db(), blocker)?.resolved_summary).toBe('Cleared');

		await expect(cmd('invalidate_blocker', blocker, { reason: 'x' })).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});
	});

	it('invalidation records the reason and unblocks the target', async () => {
		const blocker = (
			await cmd<{ id: string }>('create_blocker', undefined, externalBlockerPayload())
		).result.id;
		await cmd('ready_task', taskId, { owner: 'agent:main' });
		await expect(cmd('start_task', taskId)).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});

		await cmd('invalidate_blocker', blocker, { reason: 'Was never actually blocking' });
		const started = await cmd('start_task', taskId);
		expect(started.result).toMatchObject({ status: 'in_progress' });
	});
});
