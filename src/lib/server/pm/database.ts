import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { env } from '$env/dynamic/private';

// Type definitions for database entities
export interface Domain {
	id: string;
	name: string;
	description: string | null;
	sort_order: number;
	created_at: number;
}

export interface Focus {
	id: string;
	domain_id: string;
	name: string;
	description: string | null;
	sort_order: number;
	created_at: number;
}

export interface Project {
	id: number;
	focus_id: string;
	title: string;
	description: string | null;
	body: string | null;
	status: string;
	due_date: string | null;
	priority: string | null;
	external_ref: string | null;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}

export interface Activity {
	id: number;
	project_id: number;
	actor: string;
	action: string;
	target_type: string;
	target_id: number;
	target_title: string | null;
	details: string | null;
	created_at: number;
}

// Database schema SQL (includes FTS5 tables and triggers inlined from search.ts)
const SCHEMA = `
-- Domains (slug IDs)
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Focuses (slug IDs)
CREATE TABLE IF NOT EXISTS focuses (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Projects (P-# IDs)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  title TEXT NOT NULL,
  description TEXT,
  body TEXT,
  status TEXT CHECK(status IN ('todo','in_progress','review','done','cancelled','archived')) DEFAULT 'todo',
  due_date TEXT,
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  external_ref TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_activity_at INTEGER DEFAULT (unixepoch())
);

-- Activities (A-# IDs, project feed)
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  actor TEXT NOT NULL,
  action TEXT CHECK(action IN ('created','updated','commented','status_changed','reopened','closed')) NOT NULL,
  target_type TEXT CHECK(target_type IN ('project')) NOT NULL,
  target_id INTEGER NOT NULL,
  target_title TEXT,
  details TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_focuses_domain ON focuses(domain_id);
CREATE INDEX IF NOT EXISTS idx_projects_focus ON projects(focus_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_due ON projects(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_activity ON projects(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);

-- Views
CREATE VIEW IF NOT EXISTS v_active_projects AS
SELECT p.*, d.name as domain_name, f.name as focus_name
FROM projects p
JOIN focuses f ON p.focus_id = f.id
JOIN domains d ON f.domain_id = d.id
WHERE p.status IN ('todo', 'in_progress', 'review');

-- FTS5 search table
CREATE VIRTUAL TABLE IF NOT EXISTS pm_search USING fts5(
  entity_type,
  entity_id UNINDEXED,
  project_id UNINDEXED,
  title,
  body,
  tokenize='porter unicode61'
);

-- FTS triggers for projects
CREATE TRIGGER IF NOT EXISTS trg_projects_insert AFTER INSERT ON projects BEGIN
  INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
  VALUES ('project', NEW.id, NEW.id, NEW.title, COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.body, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_update AFTER UPDATE ON projects BEGIN
  DELETE FROM pm_search WHERE entity_type = 'project' AND entity_id = OLD.id;
  INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
  VALUES ('project', NEW.id, NEW.id, NEW.title, COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.body, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_delete AFTER DELETE ON projects BEGIN
  DELETE FROM pm_search WHERE entity_type = 'project' AND entity_id = OLD.id;
END;
`;

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get database path from env vars or use default
 */
function getDbPath(): string {
	if (env.PM_DATABASE_PATH) {
		return env.PM_DATABASE_PATH;
	}
	if (env.OPENCLAW_DATA_DIR) {
		return join(env.OPENCLAW_DATA_DIR, 'pm.db');
	}
	const dataDir = join(homedir(), '.openclaw', 'data');
	return join(dataDir, 'pm.db');
}

/**
 * Get singleton database instance
 */
export function getDb(): Database.Database {
	if (!db) {
		const dbPath = getDbPath();
		const dbDir = dirname(dbPath);

		// Ensure directory exists
		mkdirSync(dbDir, { recursive: true });

		// Open database
		const instance = new Database(dbPath);

		try {
			// Enable WAL mode for better concurrency
			instance.pragma('journal_mode = WAL');

			// Enable foreign key constraints
			instance.pragma('foreign_keys = ON');

			// Initialize schema
			instance.exec(SCHEMA);
		} catch (err) {
			instance.close();
			throw err;
		}

		db = instance;
	}

	return db;
}

/**
 * Close database connection
 */
export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}
