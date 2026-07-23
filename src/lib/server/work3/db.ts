import type Database from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { env } from '$env/dynamic/private';

/**
 * Dual-database storage for the v3 Work module (doc 06):
 * - work3.db        — canonical Work database (entities, type tables, outbox)
 * - work3-events.db — append-only Event Log
 *
 * Numbered migrations per database, tracked in a `schema_migrations` table.
 * This deliberately replaces v2's imperative, introspection-guarded rebuild
 * pipeline.
 */

const workMigrationModules = import.meta.glob('./migrations/work/*.sql', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const eventsMigrationModules = import.meta.glob('./migrations/events/*.sql', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

interface MigrationFile {
	id: number;
	name: string;
	sql: string;
}

function orderedMigrations(modules: Record<string, string>): MigrationFile[] {
	const files = Object.entries(modules).map(([path, sql]) => {
		const name = path.split('/').pop() ?? path;
		const match = /^(\d+)_/.exec(name);
		if (!match) {
			throw new Error(`work3 migration file is not numbered: ${name}`);
		}
		return { id: Number(match[1]), name, sql };
	});
	files.sort((a, b) => a.id - b.id);
	for (let i = 1; i < files.length; i++) {
		if (files[i].id === files[i - 1].id) {
			throw new Error(`work3 migration number collision: ${files[i - 1].name} / ${files[i].name}`);
		}
	}
	return files;
}

export function applyMigrations(db: Database.Database, migrations: MigrationFile[]): string[] {
	db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		applied_at INTEGER NOT NULL
	)`);
	const appliedRows = db.prepare('SELECT id, name FROM schema_migrations ORDER BY id').all() as {
		id: number;
		name: string;
	}[];
	const appliedById = new Map(appliedRows.map((row) => [row.id, row.name]));
	const appliedNow: string[] = [];
	for (const migration of migrations) {
		const existing = appliedById.get(migration.id);
		if (existing !== undefined) {
			if (existing !== migration.name) {
				throw new Error(
					`work3 migration ${migration.id} mismatch: applied as "${existing}", on disk as "${migration.name}"`
				);
			}
			continue;
		}
		const apply = db.transaction(() => {
			db.exec(migration.sql);
			db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
				migration.id,
				migration.name,
				Date.now()
			);
		});
		apply();
		appliedNow.push(migration.name);
	}
	return appliedNow;
}

function dataDir(): string {
	const explicit = process.env.FALCON_DASH_DATA_DIR ?? env.FALCON_DASH_DATA_DIR;
	if (explicit) return explicit;
	return join(homedir(), '.openclaw', 'data', 'falcon-dash');
}

export function getWork3DbPath(): string {
	const explicit =
		process.env.FALCON_DASH_WORK3_DATABASE_PATH ?? env.FALCON_DASH_WORK3_DATABASE_PATH;
	if (explicit) return explicit;
	return join(dataDir(), 'work3.db');
}

export function getWork3EventsDbPath(): string {
	const explicit =
		process.env.FALCON_DASH_WORK3_EVENTS_DATABASE_PATH ??
		env.FALCON_DASH_WORK3_EVENTS_DATABASE_PATH;
	if (explicit) return explicit;
	return join(dataDir(), 'work3-events.db');
}

function open(path: string): Database.Database {
	mkdirSync(dirname(path), { recursive: true });
	const db = new DatabaseConstructor(path);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return db;
}

let workDb: Database.Database | null = null;
let eventsDb: Database.Database | null = null;

export function getWork3Db(): Database.Database {
	if (!workDb) {
		workDb = open(getWork3DbPath());
		applyMigrations(workDb, orderedMigrations(workMigrationModules));
	}
	return workDb;
}

export function getWork3EventsDb(): Database.Database {
	if (!eventsDb) {
		eventsDb = open(getWork3EventsDbPath());
		applyMigrations(eventsDb, orderedMigrations(eventsMigrationModules));
	}
	return eventsDb;
}

export function closeWork3Dbs(): void {
	if (workDb) {
		workDb.close();
		workDb = null;
	}
	if (eventsDb) {
		eventsDb.close();
		eventsDb = null;
	}
}
