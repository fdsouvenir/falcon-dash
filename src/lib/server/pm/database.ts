import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { env } from '$env/dynamic/private';

// Type definitions for database entities
export interface Category {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
	sort_order: number;
	created_at: number;
}

export interface Subcategory {
	id: string;
	category_id: string;
	name: string;
	description: string | null;
	sort_order: number;
	created_at: number;
}

export interface Project {
	id: number;
	category_id: string;
	subcategory_id: string | null;
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

export interface Plan {
	id: number;
	project_id: number;
	title: string;
	description: string | null;
	result: string | null;
	status: string;
	sort_order: number;
	version: number;
	created_by: string;
	created_at: number;
	updated_at: number;
}

export interface PlanVersion {
	id: number;
	plan_id: number;
	version: number;
	description: string | null;
	result: string | null;
	status: string;
	created_by: string;
	created_at: number;
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
-- Categories (was domains, slug IDs)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Subcategories (was focuses, slug IDs)
CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Projects (P-# IDs)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT NOT NULL REFERENCES categories(id),
  subcategory_id TEXT REFERENCES subcategories(id),
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

-- Plans (new table)
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  result TEXT,
  status TEXT CHECK(status IN ('planning','assigned','in_progress','needs_review','complete','cancelled')) DEFAULT 'planning',
  sort_order INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT 'user',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Plan versions (new table)
CREATE TABLE IF NOT EXISTS plan_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  description TEXT,
  result TEXT,
  status TEXT,
  created_by TEXT DEFAULT 'system',
  created_at INTEGER DEFAULT (unixepoch())
);

-- Activities (A-# IDs, project feed)
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  actor TEXT NOT NULL,
  action TEXT CHECK(action IN ('created','updated','commented','status_changed','reopened','closed','plan_created','plan_updated','plan_status_changed')) NOT NULL,
  target_type TEXT CHECK(target_type IN ('project','plan')) NOT NULL,
  target_id INTEGER NOT NULL,
  target_title TEXT,
  details TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Migration metadata
CREATE TABLE IF NOT EXISTS pm_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category_id);
CREATE INDEX IF NOT EXISTS idx_projects_subcategory ON projects(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_due ON projects(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_activity ON projects(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);

-- Views
CREATE VIEW IF NOT EXISTS v_active_projects AS
SELECT p.*, c.name as category_name, s.name as subcategory_name
FROM projects p
JOIN categories c ON p.category_id = c.id
LEFT JOIN subcategories s ON p.subcategory_id = s.id
WHERE p.status IN ('todo', 'in_progress', 'review');

-- Plan dependencies
CREATE TABLE IF NOT EXISTS plan_dependencies (
  plan_id INTEGER NOT NULL,
  depends_on_plan_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (plan_id, depends_on_plan_id),
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  CHECK (plan_id != depends_on_plan_id)
);
CREATE INDEX IF NOT EXISTS idx_plan_deps_plan ON plan_dependencies(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_deps_depends ON plan_dependencies(depends_on_plan_id);

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

-- FTS triggers for plans
CREATE TRIGGER IF NOT EXISTS trg_plans_insert AFTER INSERT ON plans BEGIN
  INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
  VALUES ('plan', NEW.id, NEW.project_id, NEW.title, COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.result, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_plans_update AFTER UPDATE ON plans BEGIN
  DELETE FROM pm_search WHERE entity_type = 'plan' AND entity_id = OLD.id;
  INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
  VALUES ('plan', NEW.id, NEW.project_id, NEW.title, COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.result, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_plans_delete AFTER DELETE ON plans BEGIN
  DELETE FROM pm_search WHERE entity_type = 'plan' AND entity_id = OLD.id;
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

			// Seed default categories if none exist
			seedDefaultCategories(instance);
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

/**
 * Seed default categories if none exist
 */
function seedDefaultCategories(db: Database.Database): void {
	const count = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };

	if (count.count === 0) {
		const insert = db.prepare(`
			INSERT INTO categories (id, name, description, color, sort_order)
			VALUES (?, ?, ?, ?, ?)
		`);

		insert.run('personal', 'Personal', 'Personal projects and tasks', '#60a5fa', 0);
		insert.run('work', 'Work', 'Work-related projects and tasks', '#a78bfa', 1);

		console.log('🌱 Seeded default categories');
	}
}
