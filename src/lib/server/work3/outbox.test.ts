// @vitest-environment node

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	allocateEntityId,
	closeWork3Dbs,
	executeCommand,
	getWork3Db,
	getWork3EventsDb,
	getWork3OutboxDiagnostics,
	insertEntity,
	kickWork3Outbox,
	listWork3Events,
	registerCommand,
	transferWork3OutboxOnce
} from './index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from './testing.js';

/**
 * Outbox → Event Log transfer contract (#333 release-gate evidence, gate 6
 * partial): idempotent transfer across two databases, pruning after a safety
 * window, and observable (never silent) failure diagnostics.
 */

let context: Work3TestContext;

function registerNoteCommand(): void {
	registerCommand({
		name: 'note_test_event',
		targetType: null,
		summary: 'Emit a synthetic event',
		requiresTarget: false,
		execute: (ctx) => {
			const id = allocateEntityId(ctx.db, 'finding');
			insertEntity(ctx.db, { id, type: 'finding', now: ctx.now });
			return {
				result: { id },
				events: [
					{
						event_type: 'test_noted',
						subject_type: 'finding',
						subject_id: id,
						summary: `Noted ${id}`,
						version_from: null,
						version_to: 1,
						payload: { detail: ctx.payload.detail ?? null },
						source_refs: [{ kind: 'message', ref: 'test-msg-1' }]
					}
				]
			};
		}
	});
}

beforeEach(() => {
	context = setupWork3TestDbs();
	registerNoteCommand();
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

const system = { kind: 'system', id: 'test', label: 'Test' } as const;

describe('outbox transfer', () => {
	it('moves outbox rows into the Event Log and marks them transferred', async () => {
		await executeCommand({ command: 'note_test_event', actor: system, payload: { detail: 'x' } });

		// The post-commit kick is async; transfer deterministically here.
		const { transferred } = transferWork3OutboxOnce();
		expect(transferred).toBeGreaterThanOrEqual(1);

		const events = listWork3Events({ eventType: 'test_noted' });
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			event_type: 'test_noted',
			summary: expect.stringContaining('Noted'),
			payload: { detail: 'x' },
			source_refs: [{ kind: 'message', ref: 'test-msg-1' }],
			actor: { kind: 'system', id: 'test' }
		});

		const pending = getWork3Db()
			.prepare('SELECT COUNT(*) AS count FROM event_outbox WHERE transferred_at IS NULL')
			.get() as { count: number };
		expect(pending.count).toBe(0);
	});

	it('is idempotent: re-transfer inserts no duplicate events', async () => {
		await executeCommand({ command: 'note_test_event', actor: system });
		transferWork3OutboxOnce();

		// Force the row back to pending to simulate a crash after events insert
		// but before the transferred_at mark.
		getWork3Db().prepare('UPDATE event_outbox SET transferred_at = NULL').run();
		const second = transferWork3OutboxOnce();
		expect(second.transferred).toBeGreaterThanOrEqual(1);

		const count = getWork3EventsDb().prepare('SELECT COUNT(*) AS count FROM events').get() as {
			count: number;
		};
		expect(count.count).toBe(1);
	});

	it('prunes delivered rows after the safety window and keeps recent ones', async () => {
		await executeCommand({ command: 'note_test_event', actor: system });
		transferWork3OutboxOnce();

		let rows = getWork3Db().prepare('SELECT COUNT(*) AS count FROM event_outbox').get() as {
			count: number;
		};
		expect(rows.count).toBe(1); // delivered but inside the window

		// Age the transferred row beyond the window, then prune.
		getWork3Db().prepare('UPDATE event_outbox SET transferred_at = transferred_at - 10000').run();
		const { pruned } = transferWork3OutboxOnce({ pruneWindowMs: 5000 });
		expect(pruned).toBe(1);

		rows = getWork3Db().prepare('SELECT COUNT(*) AS count FROM event_outbox').get() as {
			count: number;
		};
		expect(rows.count).toBe(0);
		// Pruning never touches the Event Log.
		expect(listWork3Events({ eventType: 'test_noted' })).toHaveLength(1);
	});

	it('transfers automatically from the post-commit kick', async () => {
		await executeCommand({ command: 'note_test_event', actor: system });
		// kick uses setImmediate; wait one macrotask.
		await new Promise((resolve) => setImmediate(resolve));
		await new Promise((resolve) => setImmediate(resolve));
		expect(listWork3Events({ eventType: 'test_noted' })).toHaveLength(1);
	});
});

describe('outbox diagnostics', () => {
	it('reports pending backlog and transfer success', async () => {
		await executeCommand({ command: 'note_test_event', actor: system });
		let diagnostics = getWork3OutboxDiagnostics();
		expect(diagnostics.pending).toBe(1);
		expect(diagnostics.oldest_pending_age_ms).not.toBeNull();

		transferWork3OutboxOnce();
		diagnostics = getWork3OutboxDiagnostics();
		expect(diagnostics.pending).toBe(0);
		expect(diagnostics.last_success_at).not.toBeNull();
		expect(diagnostics.last_error).toBeNull();
	});

	it('surfaces transfer failures instead of staying silent, and recovers', async () => {
		await executeCommand({ command: 'note_test_event', actor: system });

		// Break the Event Log destination: point it at a directory.
		const badPath = join(context.tempDir, 'events-as-dir');
		mkdirSync(badPath);
		closeWork3Dbs();
		const goodPath = process.env.FALCON_DASH_WORK3_EVENTS_DATABASE_PATH!;
		process.env.FALCON_DASH_WORK3_EVENTS_DATABASE_PATH = badPath;

		kickWork3Outbox();
		await new Promise((resolve) => setImmediate(resolve));
		await new Promise((resolve) => setImmediate(resolve));

		let diagnostics = getWork3OutboxDiagnostics();
		expect(diagnostics.last_error).not.toBeNull();
		expect(diagnostics.pending).toBe(1);

		// Recovery: restore the destination and transfer again.
		closeWork3Dbs();
		process.env.FALCON_DASH_WORK3_EVENTS_DATABASE_PATH = goodPath;
		transferWork3OutboxOnce();
		diagnostics = getWork3OutboxDiagnostics();
		expect(diagnostics.pending).toBe(0);
		expect(diagnostics.last_error).toBeNull();
		expect(listWork3Events({ eventType: 'test_noted' })).toHaveLength(1);
	});
});
