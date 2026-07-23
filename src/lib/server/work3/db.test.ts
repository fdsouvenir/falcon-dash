// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	allocateEntityId,
	appendRevision,
	bumpEntityVersion,
	closeWork3Dbs,
	currentRevision,
	getWork3Db,
	getWork3EventsDb,
	insertEntity,
	loadEntity,
	revisionHistory
} from './index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from './testing.js';

let context: Work3TestContext;

beforeEach(() => {
	context = setupWork3TestDbs();
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('work3 migrations', () => {
	it('applies numbered migrations to both databases and records them', () => {
		const workDb = getWork3Db();
		const eventsDb = getWork3EventsDb();

		const workMigrations = workDb
			.prepare('SELECT id, name FROM schema_migrations ORDER BY id')
			.all() as { id: number; name: string }[];
		expect(workMigrations.length).toBeGreaterThanOrEqual(1);
		expect(workMigrations[0]).toMatchObject({ id: 1, name: '001_foundation.sql' });

		const eventMigrations = eventsDb
			.prepare('SELECT id, name FROM schema_migrations ORDER BY id')
			.all() as { id: number; name: string }[];
		expect(eventMigrations[0]).toMatchObject({ id: 1, name: '001_event_log.sql' });

		// Foundation tables exist in the right databases.
		expect(() => workDb.prepare('SELECT COUNT(*) FROM event_outbox').get()).not.toThrow();
		expect(() => workDb.prepare('SELECT COUNT(*) FROM idempotency_keys').get()).not.toThrow();
		expect(() => eventsDb.prepare('SELECT COUNT(*) FROM events').get()).not.toThrow();
	});

	it('is idempotent across reopen', () => {
		getWork3Db();
		closeWork3Dbs();
		const workDb = getWork3Db();
		const count = workDb.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as {
			count: number;
		};
		expect(count.count).toBeGreaterThanOrEqual(1);
	});
});

describe('entity envelope', () => {
	it('allocates sequential type-prefixed public ids per type', () => {
		const db = getWork3Db();
		expect(allocateEntityId(db, 'task')).toBe('t1');
		expect(allocateEntityId(db, 'task')).toBe('t2');
		expect(allocateEntityId(db, 'question')).toBe('q1');
		expect(allocateEntityId(db, 'task')).toBe('t3');
		expect(allocateEntityId(db, 'phase')).toBe('ph1');
	});

	it('inserts and loads envelopes with version 1', () => {
		const db = getWork3Db();
		const id = allocateEntityId(db, 'task');
		const now = Date.now();
		insertEntity(db, { id, type: 'task', now });
		const loaded = loadEntity(db, id);
		expect(loaded).toMatchObject({ id, type: 'task', area_id: null, version: 1 });
	});

	it('bumps version optimistically and rejects a stale from-version', () => {
		const db = getWork3Db();
		const id = allocateEntityId(db, 'task');
		insertEntity(db, { id, type: 'task', now: Date.now() });
		expect(bumpEntityVersion(db, id, 1, Date.now())).toBe(2);
		expect(bumpEntityVersion(db, id, 1, Date.now())).toBeNull();
		expect(bumpEntityVersion(db, id, 2, Date.now())).toBe(3);
	});
});

describe('revision tables', () => {
	function createScratchRevisionTable(): void {
		getWork3Db().exec(`CREATE TABLE test_revisions (
			id TEXT PRIMARY KEY,
			parent_id TEXT NOT NULL,
			supersedes TEXT,
			is_current INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL,
			body TEXT NOT NULL
		)`);
	}

	it('appends immutable revisions with supersedes links and one current row', () => {
		createScratchRevisionTable();
		const db = getWork3Db();

		const first = appendRevision(db, 'test_revisions', {
			parentId: 'pl1',
			now: Date.now(),
			columns: { body: 'v1' }
		});
		expect(first.supersedes).toBeNull();

		const second = appendRevision(db, 'test_revisions', {
			parentId: 'pl1',
			now: Date.now() + 1,
			columns: { body: 'v2' }
		});
		expect(second.supersedes).toBe(first.id);

		const current = currentRevision(db, 'test_revisions', 'pl1');
		expect(current?.id).toBe(second.id);

		const history = revisionHistory(db, 'test_revisions', 'pl1');
		expect(history).toHaveLength(2);
		expect(history[0].id).toBe(first.id);
		expect(history[0].is_current).toBe(0);
		expect(history[1].is_current).toBe(1);
	});

	it('keeps revision chains independent per parent', () => {
		createScratchRevisionTable();
		const db = getWork3Db();
		appendRevision(db, 'test_revisions', {
			parentId: 'pl1',
			now: Date.now(),
			columns: { body: 'a' }
		});
		const other = appendRevision(db, 'test_revisions', {
			parentId: 'pl2',
			now: Date.now(),
			columns: { body: 'b' }
		});
		expect(other.supersedes).toBeNull();
		expect(revisionHistory(db, 'test_revisions', 'pl1')).toHaveLength(1);
		expect(revisionHistory(db, 'test_revisions', 'pl2')).toHaveLength(1);
	});
});
