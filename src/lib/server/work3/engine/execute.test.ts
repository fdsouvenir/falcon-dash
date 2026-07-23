// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Work3Error } from '$lib/work3-shared/errors.js';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	allocateEntityId,
	executeCommand,
	getWork3Db,
	insertEntity,
	loadEntity,
	onWork3Event,
	registerCommand
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * Transition-engine contract tests (#333 release-gate evidence): transitions,
 * guards, idempotent replay, stale-version conflict, unknown commands, async
 * pre-guard race protection. Uses a synthetic `test_tasks` head table so the
 * engine is proven independent of any real object type.
 */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };

interface TestTaskRow {
	entity_id: string;
	title: string;
	status: string;
}

function registerTestCommands(): void {
	registerCommand({
		name: 'create_test_task',
		targetType: null,
		summary: 'Create a synthetic task',
		requiresTarget: false,
		validate: (payload) => {
			if (typeof payload.title !== 'string' || payload.title.length === 0) {
				throw new Work3Error('validation_failed', 'title is required');
			}
		},
		execute: (ctx) => {
			const id = allocateEntityId(ctx.db, 'task');
			insertEntity(ctx.db, { id, type: 'task', now: ctx.now });
			ctx.db
				.prepare('INSERT INTO test_tasks (entity_id, title, status) VALUES (?, ?, ?)')
				.run(id, ctx.payload.title, 'backlog');
			return {
				result: { id },
				events: [
					{
						event_type: 'test_task_created',
						subject_type: 'task',
						subject_id: id,
						summary: `Created test task ${id}`,
						version_from: null,
						version_to: 1
					}
				]
			};
		}
	});

	registerCommand({
		name: 'start_test_task',
		targetType: 'task',
		summary: 'Move a synthetic task to in_progress',
		requiresTarget: true,
		legalSourceStates: ['backlog'],
		guards: [
			(ctx) => {
				const row = ctx.db
					.prepare('SELECT * FROM test_tasks WHERE entity_id = ?')
					.get(ctx.targetId) as TestTaskRow;
				if (row.status !== 'backlog' && row.status !== 'in_progress') {
					throw new Work3Error('transition_not_allowed', `Cannot start from ${row.status}`, {
						details: { status: row.status },
						alternatives: ['create_test_task']
					});
				}
			}
		],
		execute: (ctx) => {
			const row = ctx.db
				.prepare('SELECT * FROM test_tasks WHERE entity_id = ?')
				.get(ctx.targetId) as TestTaskRow;
			if (row.status === 'in_progress') {
				return { result: { id: ctx.targetId, status: 'in_progress' }, events: [], noop: true };
			}
			ctx.db
				.prepare('UPDATE test_tasks SET status = ? WHERE entity_id = ?')
				.run('in_progress', ctx.targetId);
			return {
				result: { id: ctx.targetId, status: 'in_progress' },
				events: [
					{
						event_type: 'test_task_started',
						subject_type: 'task',
						subject_id: ctx.targetId!,
						summary: `Started test task ${ctx.targetId}`
					}
				]
			};
		}
	});

	registerCommand({
		name: 'guarded_test_command',
		targetType: 'task',
		summary: 'Command with an async pre-guard',
		requiresTarget: true,
		preGuards: [
			async (ctx) => {
				if (ctx.payload.fail_pre_guard) {
					throw new Work3Error('authority_required', 'Pre-guard rejected');
				}
				if (ctx.payload.mutate_during_pre_guard) {
					// Simulate a concurrent commit while the async phase is in flight.
					ctx.db
						.prepare('UPDATE entities SET version = version + 1 WHERE id = ?')
						.run(ctx.targetId);
				}
				await Promise.resolve();
			}
		],
		execute: (ctx) => ({
			result: { ok: true },
			events: [
				{
					event_type: 'test_guarded_ran',
					subject_type: 'task',
					subject_id: ctx.targetId!,
					summary: 'Guarded command ran'
				}
			]
		})
	});
}

async function createTask(title = 'A test task'): Promise<string> {
	const created = await executeCommand<{ id: string }>({
		command: 'create_test_task',
		actor: agent,
		payload: { title }
	});
	return created.result.id;
}

beforeEach(() => {
	context = setupWork3TestDbs();
	getWork3Db().exec(`CREATE TABLE test_tasks (
		entity_id TEXT PRIMARY KEY REFERENCES entities(id),
		title TEXT NOT NULL,
		status TEXT NOT NULL
	)`);
	registerTestCommands();
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('command dispatch', () => {
	it('fails loudly on unknown commands with the known-command list', async () => {
		await expect(executeCommand({ command: 'frobnicate', actor: agent })).rejects.toMatchObject({
			code: 'unknown_command',
			alternatives: expect.arrayContaining(['create_test_task', 'start_test_task'])
		});
	});

	it('rejects payloads that fail validation', async () => {
		await expect(
			executeCommand({ command: 'create_test_task', actor: agent, payload: {} })
		).rejects.toMatchObject({ code: 'validation_failed' });
	});

	it('requires a target and expected_version for targeted commands', async () => {
		await expect(
			executeCommand({ command: 'start_test_task', actor: agent })
		).rejects.toMatchObject({ code: 'validation_failed' });

		const id = await createTask();
		await expect(
			executeCommand({ command: 'start_test_task', actor: agent, target: id })
		).rejects.toMatchObject({ code: 'validation_failed' });
	});

	it('returns not_found for missing targets', async () => {
		await expect(
			executeCommand({
				command: 'start_test_task',
				actor: agent,
				target: 't999',
				expected_version: 1
			})
		).rejects.toMatchObject({ code: 'not_found' });
	});

	it('rejects a target of the wrong type', async () => {
		const db = getWork3Db();
		const id = allocateEntityId(db, 'question');
		insertEntity(db, { id, type: 'question', now: Date.now() });
		await expect(
			executeCommand({ command: 'start_test_task', actor: agent, target: id, expected_version: 1 })
		).rejects.toMatchObject({ code: 'validation_failed' });
	});
});

describe('transitions and guards', () => {
	it('applies a legal transition, bumps the version, and emits events', async () => {
		const id = await createTask();
		const seen: string[] = [];
		const unsubscribe = onWork3Event((event) => seen.push(event.event_type));

		const result = await executeCommand({
			command: 'start_test_task',
			actor: agent,
			target: id,
			expected_version: 1
		});

		expect(result.ok).toBe(true);
		expect(result.noop).toBe(false);
		expect(result.events).toHaveLength(1);
		expect(result.events[0]).toMatchObject({
			event_type: 'test_task_started',
			subject_id: id,
			version_from: 1,
			version_to: 2,
			actor: agent
		});
		expect(loadEntity(getWork3Db(), id)?.version).toBe(2);
		expect(seen).toContain('test_task_started');
		unsubscribe();
	});

	it('rejects an illegal transition with transition_not_allowed and alternatives', async () => {
		const id = await createTask();
		getWork3Db().prepare('UPDATE test_tasks SET status = ? WHERE entity_id = ?').run('done', id);

		await expect(
			executeCommand({ command: 'start_test_task', actor: agent, target: id, expected_version: 1 })
		).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['create_test_task']
		});
		// Rejection leaves no partial effects.
		expect(loadEntity(getWork3Db(), id)?.version).toBe(1);
		const outbox = getWork3Db()
			.prepare('SELECT COUNT(*) AS count FROM event_outbox WHERE subject_id = ?')
			.get(id) as { count: number };
		expect(outbox.count).toBe(1); // only the creation event
	});

	it('treats an already-achieved transition as a successful no-op', async () => {
		const id = await createTask();
		await executeCommand({
			command: 'start_test_task',
			actor: agent,
			target: id,
			expected_version: 1
		});

		const repeat = await executeCommand({
			command: 'start_test_task',
			actor: agent,
			target: id,
			expected_version: 2
		});
		expect(repeat.ok).toBe(true);
		expect(repeat.noop).toBe(true);
		expect(repeat.events).toHaveLength(0);
		// No version bump on a semantic no-op.
		expect(loadEntity(getWork3Db(), id)?.version).toBe(2);
	});
});

describe('optimistic concurrency', () => {
	it('rejects a stale expected_version with the current version in details', async () => {
		const id = await createTask();
		await executeCommand({
			command: 'start_test_task',
			actor: agent,
			target: id,
			expected_version: 1
		});

		await expect(
			executeCommand({ command: 'start_test_task', actor: agent, target: id, expected_version: 1 })
		).rejects.toMatchObject({
			code: 'version_conflict',
			details: { current_version: 2, expected_version: 1 }
		});
	});

	it('catches a version change during the async pre-guard phase', async () => {
		const id = await createTask();
		await expect(
			executeCommand({
				command: 'guarded_test_command',
				actor: agent,
				target: id,
				expected_version: 1,
				payload: { mutate_during_pre_guard: true }
			})
		).rejects.toMatchObject({ code: 'version_conflict' });
	});

	it('propagates pre-guard failures without mutating state', async () => {
		const id = await createTask();
		await expect(
			executeCommand({
				command: 'guarded_test_command',
				actor: agent,
				target: id,
				expected_version: 1,
				payload: { fail_pre_guard: true }
			})
		).rejects.toMatchObject({ code: 'authority_required' });
		expect(loadEntity(getWork3Db(), id)?.version).toBe(1);
	});
});

describe('idempotency keys', () => {
	it('replays the original result for the same key and payload', async () => {
		const id = await createTask();
		const first = await executeCommand({
			command: 'start_test_task',
			actor: agent,
			target: id,
			expected_version: 1,
			idempotency_key: 'retry-1',
			payload: {}
		});

		const replay = await executeCommand({
			command: 'start_test_task',
			actor: agent,
			target: id,
			expected_version: 1,
			idempotency_key: 'retry-1',
			payload: {}
		});

		expect(replay.replayed).toBe(true);
		expect(replay.result).toEqual(first.result);
		expect(replay.events.map((event) => event.id)).toEqual(first.events.map((event) => event.id));
		// The replay produced no new canonical effects or outbox rows.
		expect(loadEntity(getWork3Db(), id)?.version).toBe(2);
		const outbox = getWork3Db()
			.prepare('SELECT COUNT(*) AS count FROM event_outbox WHERE event_type = ?')
			.get('test_task_started') as { count: number };
		expect(outbox.count).toBe(1);
	});

	it('rejects the same key with a different payload', async () => {
		const id = await createTask();
		await executeCommand({
			command: 'guarded_test_command',
			actor: agent,
			target: id,
			expected_version: 1,
			idempotency_key: 'retry-2',
			payload: {}
		});

		await expect(
			executeCommand({
				command: 'guarded_test_command',
				actor: agent,
				target: id,
				expected_version: 2,
				idempotency_key: 'retry-2',
				payload: { different: true }
			})
		).rejects.toMatchObject({ code: 'idempotency_conflict' });
	});

	it('scopes keys by actor', async () => {
		const id = await createTask();
		await executeCommand({
			command: 'start_test_task',
			actor: agent,
			target: id,
			expected_version: 1,
			idempotency_key: 'shared-key',
			payload: {}
		});

		// A different actor with the same key is not a replay; it executes and
		// no-ops semantically because the task is already started.
		const other = await executeCommand({
			command: 'start_test_task',
			actor: { kind: 'person', id: 'fred', label: 'Fred' },
			target: id,
			expected_version: 2,
			idempotency_key: 'shared-key',
			payload: {}
		});
		expect(other.replayed).toBe(false);
		expect(other.noop).toBe(true);
	});
});
