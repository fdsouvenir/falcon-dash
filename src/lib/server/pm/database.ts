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

// Legacy interfaces for migration
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

			// Check if migration is needed
			const needsMigration = checkMigrationNeeded(instance);
			
			if (needsMigration) {
				runMigration(instance);
			}

			// Initialize schema
			instance.exec(SCHEMA);
			
			// Seed default categories if needed
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
 * Check if migration from old schema is needed
 */
function checkMigrationNeeded(db: Database.Database): boolean {
	try {
		// Check if old domains table exists and new categories table doesn't
		const hasDomains = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='domains'`).get();
		const hasCategories = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='categories'`).get();
		
		return hasDomains && !hasCategories;
	} catch {
		return false;
	}
}

/**
 * Run migration from domains/focuses to categories/subcategories
 */
function runMigration(db: Database.Database): void {
	console.log('🔄 Starting PM schema migration to v0.17.0...');
	
	// Start transaction
	const transaction = db.transaction(() => {
		// Create new tables first
		db.exec(`
			CREATE TABLE categories (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				color TEXT,
				sort_order INTEGER DEFAULT 0,
				created_at INTEGER DEFAULT (unixepoch())
			);
			
			CREATE TABLE subcategories (
				id TEXT PRIMARY KEY,
				category_id TEXT NOT NULL REFERENCES categories(id),
				name TEXT NOT NULL,
				description TEXT,
				sort_order INTEGER DEFAULT 0,
				created_at INTEGER DEFAULT (unixepoch())
			);
			
			CREATE TABLE projects_new (
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
		`);
		
		// Migrate domains to categories (add default colors)
		const domains = db.prepare('SELECT * FROM domains').all() as Domain[];
		const insertCategory = db.prepare(`
			INSERT INTO categories (id, name, description, color, sort_order, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`);
		
		for (const domain of domains) {
			// Set default colors based on common domain names
			let color = null;
			if (domain.name.toLowerCase().includes('personal')) color = '#60a5fa';
			else if (domain.name.toLowerCase().includes('work')) color = '#a78bfa';
			
			insertCategory.run(
				domain.id,
				domain.name,
				domain.description,
				color,
				domain.sort_order,
				domain.created_at
			);
		}
		
		// Migrate focuses to subcategories
		const focuses = db.prepare('SELECT * FROM focuses').all() as Focus[];
		const insertSubcategory = db.prepare(`
			INSERT INTO subcategories (id, category_id, name, description, sort_order, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`);
		
		for (const focus of focuses) {
			insertSubcategory.run(
				focus.id,
				focus.domain_id,
				focus.name,
				focus.description,
				focus.sort_order,
				focus.created_at
			);
		}
		
		// Migrate projects (focus_id becomes subcategory_id, get category_id from focus)
		const oldProjects = db.prepare(`
			SELECT p.*, f.domain_id 
			FROM projects p 
			JOIN focuses f ON p.focus_id = f.id
		`).all();
		
		const insertProject = db.prepare(`
			INSERT INTO projects_new (
				id, category_id, subcategory_id, title, description, body, 
				status, due_date, priority, external_ref, 
				created_at, updated_at, last_activity_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);
		
		for (const project of oldProjects) {
			insertProject.run(
				project.id,
				project.domain_id,  // category_id comes from focus.domain_id
				project.focus_id,   // subcategory_id is the old focus_id
				project.title,
				project.description,
				project.body,
				project.status,
				project.due_date,
				project.priority,
				project.external_ref,
				project.created_at,
				project.updated_at,
				project.last_activity_at
			);
		}
		
		// Drop old tables
		db.exec('DROP TABLE projects');
		db.exec('DROP TABLE focuses');
		db.exec('DROP TABLE domains');
		
		// Rename new projects table
		db.exec('ALTER TABLE projects_new RENAME TO projects');
		
		// Mark migration as complete
		db.prepare(`
			INSERT INTO pm_meta (key, value) 
			VALUES ('schema_version', '0.17.0')
			ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = (unixepoch())
		`).run();
	});
	
	transaction();
	console.log('✅ PM schema migration complete');
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
