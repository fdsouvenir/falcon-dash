import type Database from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { env } from '$env/dynamic/private';

export const WORK_SCHEMA = `
CREATE TABLE IF NOT EXISTS work_areas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  parent_area_id TEXT REFERENCES work_areas(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('area','project','task','decision','routine','observation','change')),
  area_id TEXT REFERENCES work_areas(id),
  parent_item_id INTEGER REFERENCES work_items(id),
  title TEXT NOT NULL,
  description TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog','planning','ready','in_progress','waiting','needs_review','blocked','scheduled','complete','cancelled','archived')),
  owner TEXT,
  waiting_on TEXT,
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  next_action TEXT,
  approval_required INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  scheduled_at TEXT,
  stale_after TEXT,
  result TEXT,
  legacy_project_id INTEGER,
  legacy_plan_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_activity_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS work_relationships (
  from_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  to_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK(relation_type IN ('depends_on','blocks','relates_to','derived_from')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (from_item_id, to_item_id, relation_type),
  CHECK (from_item_id != to_item_id)
);

CREATE TABLE IF NOT EXISTS work_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  observed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS work_evidence_refs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id INTEGER REFERENCES work_items(id) ON DELETE CASCADE,
  observation_id INTEGER REFERENCES work_observations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  summary TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (work_item_id IS NOT NULL OR observation_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS work_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id INTEGER REFERENCES work_items(id) ON DELETE CASCADE,
  actor TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS work_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  body TEXT,
  result TEXT,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS work_routine_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('ok','no_action','failed','blocked','escalated')),
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  summary TEXT,
  output_ref TEXT
);

CREATE TABLE IF NOT EXISTS work_migration_map (
  legacy_type TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  work_type TEXT NOT NULL,
  work_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (legacy_type, legacy_id)
);

CREATE TABLE IF NOT EXISTS work_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_work_items_type ON work_items(type);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_items_area ON work_items(area_id);
CREATE INDEX IF NOT EXISTS idx_work_items_parent ON work_items(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_work_items_legacy_project ON work_items(legacy_project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_legacy_plan ON work_items(legacy_plan_id);
CREATE INDEX IF NOT EXISTS idx_work_items_activity ON work_items(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_work_evidence_item ON work_evidence_refs(work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_evidence_observation ON work_evidence_refs(observation_id);
CREATE INDEX IF NOT EXISTS idx_work_activity_item ON work_activity(work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_routine_runs_item ON work_routine_runs(routine_item_id);
`;

let db: Database.Database | null = null;
let initialized = false;

export function getWorkDbPath(): string {
	const explicitDbPath =
		process.env.FALCON_DASH_WORK_DATABASE_PATH ?? env.FALCON_DASH_WORK_DATABASE_PATH;
	if (explicitDbPath) return explicitDbPath;

	const explicitDataDir = process.env.FALCON_DASH_DATA_DIR ?? env.FALCON_DASH_DATA_DIR;
	if (explicitDataDir) return join(explicitDataDir, 'work.db');

	return join(homedir(), '.openclaw', 'data', 'falcon-dash', 'work.db');
}

export function getLegacyPmDbPath(): string {
	const explicitLegacyPath =
		process.env.FALCON_DASH_ARCHIVED_WORK_SOURCE_DATABASE_PATH ??
		env.FALCON_DASH_ARCHIVED_WORK_SOURCE_DATABASE_PATH;
	if (explicitLegacyPath) return explicitLegacyPath;

	return join(homedir(), '.openclaw', 'data', 'pm.db');
}

export function ensureWorkSchema(db: Database.Database = getWorkDb()): void {
	db.exec(WORK_SCHEMA);
	initialized = true;
}

export function getWorkDb(): Database.Database {
	if (!db) {
		const dbPath = getWorkDbPath();
		mkdirSync(dirname(dbPath), { recursive: true });
		db = new DatabaseConstructor(dbPath);
		db.pragma('journal_mode = WAL');
		db.pragma('foreign_keys = ON');
	}
	if (!initialized) ensureWorkSchema(db);
	return db;
}

export function openLegacyPmDb(): Database.Database {
	const dbPath = getLegacyPmDbPath();
	if (!existsSync(dbPath)) {
		throw new Error(`Legacy PM database not found: ${dbPath}`);
	}
	const legacyDb = new DatabaseConstructor(dbPath, { readonly: true, fileMustExist: true });
	legacyDb.pragma('foreign_keys = ON');
	return legacyDb;
}

export function closeWorkDb(): void {
	if (db) {
		db.close();
		db = null;
	}
	initialized = false;
}

export function resetWorkSchemaForTests(): void {
	initialized = false;
}
