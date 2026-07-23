// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import { executeCommand, getWork3Db, loadEntity, registerWork3Objects } from '../index.js';
import { loadArea } from './area.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/** Area contract tests (template from task.test.ts). */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };

async function cmd<T = Record<string, unknown>>(
	command: string,
	target?: string,
	payload: Record<string, unknown> = {},
	options: { idempotencyKey?: string } = {}
) {
	return executeCommand<T>({
		command,
		actor: agent,
		target: target ?? null,
		expected_version: target ? loadEntity(getWork3Db(), target)!.version : undefined,
		idempotency_key: options.idempotencyKey,
		payload
	});
}

async function createArea(title = 'Ops'): Promise<string> {
	const created = await cmd<{ id: string }>('create_area', undefined, { title });
	return created.result.id;
}

beforeEach(() => {
	context = setupWork3TestDbs();
	registerWork3Objects();
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('create_area / update_area', () => {
	it('creates an active Area and edits non-lifecycle fields', async () => {
		const id = await createArea();
		expect(loadArea(getWork3Db(), id)).toMatchObject({ title: 'Ops', state: 'active' });

		await cmd('update_area', id, { summary: 'Everything operational' });
		expect(loadArea(getWork3Db(), id)?.summary).toBe('Everything operational');
	});

	it('update with no changes is a no-op; title is required at creation', async () => {
		const id = await createArea();
		const noop = await cmd('update_area', id, {});
		expect(noop.noop).toBe(true);
		await expect(cmd('create_area', undefined, {})).rejects.toMatchObject({
			code: 'validation_failed'
		});
	});
});

describe('archive_area / restore_area', () => {
	it('archives an empty Area and restores it', async () => {
		const id = await createArea();
		await cmd('archive_area', id);
		expect(loadArea(getWork3Db(), id)).toMatchObject({ state: 'archived' });

		await cmd('restore_area', id);
		expect(loadArea(getWork3Db(), id)).toMatchObject({ state: 'active', archived_at: null });
	});

	it('refuses to archive with active Work unless an exception reason is given', async () => {
		const id = await createArea();
		await cmd('create_task', undefined, { area_id: id, title: 'Live task' });

		await expect(cmd('archive_area', id)).rejects.toMatchObject({
			code: 'transition_requirements_not_met'
		});
		const archived = await cmd('archive_area', id, { exception_reason: 'Winding down anyway' });
		expect(archived.noop).toBe(false);
		expect(loadArea(getWork3Db(), id)?.state).toBe('archived');
	});

	it('archiving never changes contained Work (doc 01)', async () => {
		const id = await createArea();
		const task = await cmd<{ id: string }>('create_task', undefined, {
			area_id: id,
			title: 'Survives archive'
		});
		await cmd('archive_area', id, { exception_reason: 'test' });
		const row = getWork3Db()
			.prepare('SELECT status FROM tasks WHERE entity_id = ?')
			.get(task.result.id) as { status: string };
		expect(row.status).toBe('backlog');
	});

	it('archived Areas reject ordinary mutations and new Work until restored', async () => {
		const id = await createArea();
		await cmd('archive_area', id);
		await expect(cmd('update_area', id, { title: 'Nope' })).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['restore_area']
		});
		await expect(cmd('create_task', undefined, { area_id: id, title: 'X' })).rejects.toMatchObject({
			code: 'invariant_violation'
		});

		await cmd('restore_area', id);
		const created = await cmd('create_task', undefined, { area_id: id, title: 'X' });
		expect(created.ok).toBe(true);
	});

	it('repeated archive/restore are idempotent no-ops', async () => {
		const id = await createArea();
		await cmd('archive_area', id);
		const again = await cmd('archive_area', id);
		expect(again.noop).toBe(true);

		await cmd('restore_area', id);
		const restoreAgain = await cmd('restore_area', id);
		expect(restoreAgain.noop).toBe(true);
	});
});
