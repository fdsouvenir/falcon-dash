import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

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

export interface Milestone {
	id: number;
	name: string;
	due_date: string | null;
	description: string | null;
	created_at: number;
}

export interface Project {
	id: number;
	focus_id: string;
	title: string;
	description: string | null;
	status: string;
	milestone_id: number | null;
	due_date: string | null;
	priority: string | null;
	external_ref: string | null;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}

export interface Task {
	id: number;
	parent_project_id: number | null;
	parent_task_id: number | null;
	title: string;
	body: string | null;
	status: string;
	due_date: string | null;
	priority: string | null;
	milestone_id: number | null;
	external_ref: string | null;
	sort_order: number;
	created_at: number;
	updated_at: number;
	last_activity_at: number;
}

export interface Comment {
	id: number;
	target_type: string;
	target_id: number;
	body: string;
	author: string;
	created_at: number;
}

export interface Block {
	blocker_id: number;
	blocked_id: number;
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

export interface Attachment {
	id: number;
	target_type: string;
	target_id: number;
	file_path: string;
	file_name: string;
	description: string | null;
	added_by: string;
	created_at: number;
}

export interface SyncMapping {
	id: number;
	entity_type: string;
	entity_id: number;
	external_system: string;
	external_id: string;
	external_url: string | null;
	synced_at: number | null;
	sync_state: string;
	sync_metadata: string | null;
	created_at: number;
}

// Database schema SQL
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

-- Milestones (M-# IDs)
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  due_date TEXT,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Projects (P-# IDs)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('todo','in_progress','review','done','cancelled','archived')) DEFAULT 'todo',
  milestone_id INTEGER REFERENCES milestones(id),
  due_date TEXT,
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  external_ref TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_activity_at INTEGER DEFAULT (unixepoch())
);

-- Tasks (T-# IDs, also subtasks via parent_task_id)
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_project_id INTEGER REFERENCES projects(id),
  parent_task_id INTEGER REFERENCES tasks(id),
  title TEXT NOT NULL,
  body TEXT,
  status TEXT CHECK(status IN ('todo','in_progress','review','done','cancelled','archived')) DEFAULT 'todo',
  due_date TEXT,
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  milestone_id INTEGER REFERENCES milestones(id),
  external_ref TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_activity_at INTEGER DEFAULT (unixepoch()),
  CHECK (
    (parent_project_id IS NOT NULL AND parent_task_id IS NULL) OR
    (parent_project_id IS NULL AND parent_task_id IS NOT NULL)
  )
);

-- Comments (C-# IDs)
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT CHECK(target_type IN ('project','task')) NOT NULL,
  target_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Blocks (dependencies between tasks)
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES tasks(id),
  blocked_id INTEGER NOT NULL REFERENCES tasks(id),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Activities (A-# IDs, project feed)
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  actor TEXT NOT NULL,
  action TEXT CHECK(action IN ('created','updated','commented','status_changed','reopened','closed')) NOT NULL,
  target_type TEXT CHECK(target_type IN ('project','task','comment')) NOT NULL,
  target_id INTEGER NOT NULL,
  target_title TEXT,
  details TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Attachments (file references on projects/tasks)
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT CHECK(target_type IN ('project','task')) NOT NULL,
  target_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  description TEXT,
  added_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Sync Mappings (for external system integration)
CREATE TABLE IF NOT EXISTS sync_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT CHECK(entity_type IN ('domain','focus','milestone','project','task','comment')) NOT NULL,
  entity_id INTEGER NOT NULL,
  external_system TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_url TEXT,
  synced_at INTEGER,
  sync_state TEXT CHECK(sync_state IN ('synced','pending_push','pending_pull','conflict')) DEFAULT 'synced',
  sync_metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(entity_type, entity_id, external_system)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_focuses_domain ON focuses(domain_id);
CREATE INDEX IF NOT EXISTS idx_projects_focus ON projects(focus_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_due ON projects(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_activity ON projects(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_activity ON tasks(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_target ON attachments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_mappings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_system ON sync_mappings(external_system);
CREATE INDEX IF NOT EXISTS idx_sync_state ON sync_mappings(sync_state);

-- Views
CREATE VIEW IF NOT EXISTS v_blocked_tasks AS
SELECT t.*, b.blocker_id
FROM tasks t
JOIN blocks b ON b.blocked_id = t.id
WHERE t.status NOT IN ('done', 'cancelled');

CREATE VIEW IF NOT EXISTS v_active_projects AS
SELECT p.*, d.name as domain_name, f.name as focus_name
FROM projects p
JOIN focuses f ON p.focus_id = f.id
JOIN domains d ON f.domain_id = d.id
WHERE p.status IN ('todo', 'in_progress', 'review');
`;

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get database path from config or use default
 */
function getDbPath(): string {
	// TODO: make this configurable via config system
	// For now, use default: ~/.openclaw/data/pm.db
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
		db = new Database(dbPath);

		// Enable WAL mode for better concurrency
		db.pragma('journal_mode = WAL');

		// Enable foreign key constraints
		db.pragma('foreign_keys = ON');

		// Initialize schema
		initSchema();
	}

	return db;
}

/**
 * Initialize database schema
 */
export function initSchema(): void {
	const database = getDb();
	database.exec(SCHEMA);
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
