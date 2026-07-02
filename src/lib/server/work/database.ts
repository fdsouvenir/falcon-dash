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
  type TEXT NOT NULL CHECK(type IN ('project','milestone','task','open_question','decision','automation','finding','change_request')),
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

CREATE TABLE IF NOT EXISTS work_project_details (
  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  goal TEXT,
  definition_of_done TEXT,
  why_it_matters TEXT,
  scope TEXT,
  non_scope TEXT,
  health TEXT CHECK(health IN ('on_track','at_risk','blocked','unknown')),
  operator TEXT,
  start_date TEXT,
  target_date TEXT,
  actual_completed_date TEXT,
  current_next_item_id INTEGER REFERENCES work_items(id),
  last_meaningful_update_at INTEGER
);

CREATE TABLE IF NOT EXISTS work_milestone_details (
  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  marker TEXT,
  target_date TEXT,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS work_task_details (
  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  action TEXT
);

CREATE TABLE IF NOT EXISTS work_open_question_details (
  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  answerer TEXT NOT NULL,
  blocked_item_id INTEGER REFERENCES work_items(id),
  proposed_answer TEXT,
  answer TEXT,
  answered_at INTEGER
);

CREATE TABLE IF NOT EXISTS work_decision_details (
  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  decision_question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  recommended_option TEXT NOT NULL,
  consequence_of_no_decision TEXT NOT NULL,
  decision TEXT,
  decided_by TEXT,
  decided_at INTEGER
);

CREATE TABLE IF NOT EXISTS work_change_request_details (
  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  systems_touched_json TEXT NOT NULL DEFAULT '[]',
  risk TEXT NOT NULL,
  rollback_notes TEXT,
  verification_plan TEXT NOT NULL,
  approval_state TEXT NOT NULL DEFAULT 'planning',
  execution_state TEXT NOT NULL DEFAULT 'not_started'
);

CREATE TABLE IF NOT EXISTS work_automation_details (
  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('cron','heartbeat','webhook','manual')),
  schedule TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  last_result TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  generated_work_policy TEXT,
  backing_ref TEXT
);

CREATE TABLE IF NOT EXISTS work_finding_details (
  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  finding_text TEXT,
  source_refs_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS work_relationships (
  from_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  to_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK(relation_type IN ('depends_on','blocks','relates_to','derived_from')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (from_item_id, to_item_id, relation_type),
  CHECK (from_item_id != to_item_id)
);

CREATE TABLE IF NOT EXISTS work_blocker_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES work_items(id) ON DELETE CASCADE,
  blocked_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  blocker_source TEXT NOT NULL CHECK(blocker_source IN ('work_item','person','system','external')),
  blocker_item_id INTEGER REFERENCES work_items(id) ON DELETE CASCADE,
  external_label TEXT,
  reason TEXT,
  unblock_action TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','resolved')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER,
  CHECK (blocked_item_id != blocker_item_id),
  CHECK (
    (blocker_source = 'work_item' AND blocker_item_id IS NOT NULL) OR
    (blocker_source != 'work_item' AND external_label IS NOT NULL)
  )
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

CREATE TABLE IF NOT EXISTS work_change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at INTEGER NOT NULL DEFAULT (unixepoch()),
  actor TEXT NOT NULL DEFAULT 'system',
  source TEXT NOT NULL DEFAULT 'api',
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_title TEXT,
  action TEXT NOT NULL,
  project_id INTEGER,
  parent_item_id INTEGER,
  area_id TEXT,
  summary TEXT NOT NULL,
  changes_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS work_automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_work_blocker_links_project ON work_blocker_links(project_id, status);
CREATE INDEX IF NOT EXISTS idx_work_blocker_links_blocked ON work_blocker_links(blocked_item_id, status);
CREATE INDEX IF NOT EXISTS idx_work_blocker_links_blocker ON work_blocker_links(blocker_item_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_blocker_links_unique_item
  ON work_blocker_links(blocked_item_id, blocker_item_id)
  WHERE status = 'active' AND blocker_source = 'work_item';
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_blocker_links_unique_external
  ON work_blocker_links(blocked_item_id, blocker_source, external_label)
  WHERE status = 'active' AND blocker_source != 'work_item';
CREATE INDEX IF NOT EXISTS idx_work_change_log_project ON work_change_log(project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_work_change_log_entity ON work_change_log(entity_type, entity_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_work_change_log_area ON work_change_log(area_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_work_automation_runs_item ON work_automation_runs(automation_item_id);
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
	migrateWorkItemsToV2(db);
	migrateWorkItemsToTaskModel(db);
	migrateProjectDetailsToCurrentNextItem(db);
	migrateNextStepDetailsToTaskDetails(db);
	db.exec(WORK_SCHEMA);
	backfillV2Details(db);
	backfillWorkBlockerLinks(db);
	backfillWorkChangeLog(db);
	initialized = true;
}

function migrateWorkItemsToV2(db: Database.Database): void {
	const table = db
		.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='work_items'")
		.get() as { sql?: string } | undefined;
	if (!table?.sql || table.sql.includes("'open_question'")) return;

	db.exec(`
		PRAGMA foreign_keys = OFF;
		PRAGMA legacy_alter_table = ON;
		ALTER TABLE work_items RENAME TO work_items_v1;
		CREATE TABLE work_items (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  type TEXT NOT NULL CHECK(type IN ('project','milestone','task','open_question','decision','automation','finding','change_request')),
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
		INSERT INTO work_items (
		  id, type, area_id, parent_item_id, title, description, body, status, owner, waiting_on,
		  priority, next_action, approval_required, due_date, scheduled_at, stale_after, result,
		  legacy_project_id, legacy_plan_id, created_at, updated_at, last_activity_at
		)
		SELECT
		  id,
		  CASE
		    WHEN type = 'task' THEN 'task'
		    WHEN type = 'routine' THEN 'automation'
		    WHEN type = 'observation' THEN 'finding'
		    WHEN type = 'change' THEN 'change_request'
		    WHEN type = 'decision'
		      AND lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(body, '') || ' ' || coalesce(next_action, '')) GLOB '*option*'
		      THEN 'decision'
		    WHEN type = 'decision'
		      AND lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(body, '') || ' ' || coalesce(next_action, '')) GLOB '*approv*'
		      THEN 'decision'
		    WHEN type = 'decision'
		      AND lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(body, '') || ' ' || coalesce(next_action, '')) GLOB '*decid*'
		      THEN 'decision'
		    WHEN type = 'decision'
		      AND lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(body, '') || ' ' || coalesce(next_action, '')) GLOB '*choose*'
		      THEN 'decision'
		    WHEN type = 'decision' THEN 'open_question'
		    ELSE type
		  END,
		  area_id, parent_item_id, title, description, body, status, owner, waiting_on,
		  priority, next_action, approval_required, due_date, scheduled_at, stale_after, result,
		  legacy_project_id, legacy_plan_id, created_at, updated_at, last_activity_at
		FROM work_items_v1;
		DROP TABLE work_items_v1;
		PRAGMA legacy_alter_table = OFF;
		PRAGMA foreign_keys = ON;
	`);
}

function migrateWorkItemsToTaskModel(db: Database.Database): void {
	const table = db
		.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='work_items'")
		.get() as { sql?: string } | undefined;
	if (!table?.sql) return;
	if (table.sql.includes("'task'") && !table.sql.includes("'next_step'")) return;

	db.exec(`
		PRAGMA foreign_keys = OFF;
		PRAGMA legacy_alter_table = ON;
		ALTER TABLE work_items RENAME TO work_items_before_task_model;
		CREATE TABLE work_items (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  type TEXT NOT NULL CHECK(type IN ('project','milestone','task','open_question','decision','automation','finding','change_request')),
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
		INSERT INTO work_items (
		  id, type, area_id, parent_item_id, title, description, body, status, owner, waiting_on,
		  priority, next_action, approval_required, due_date, scheduled_at, stale_after, result,
		  legacy_project_id, legacy_plan_id, created_at, updated_at, last_activity_at
		)
		SELECT
		  id,
		  CASE WHEN type = 'next_step' THEN 'task' ELSE type END,
		  area_id, parent_item_id, title, description, body, status, owner, waiting_on,
		  priority, next_action, approval_required, due_date, scheduled_at, stale_after, result,
		  legacy_project_id, legacy_plan_id, created_at, updated_at, last_activity_at
		FROM work_items_before_task_model;
		DROP TABLE work_items_before_task_model;
		PRAGMA legacy_alter_table = OFF;
		PRAGMA foreign_keys = ON;
	`);
}

function migrateProjectDetailsToCurrentNextItem(db: Database.Database): void {
	const table = db
		.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='work_project_details'")
		.get() as { sql?: string } | undefined;
	if (!table?.sql || table.sql.includes('current_next_item_id')) return;
	const columns = db.prepare('PRAGMA table_info(work_project_details)').all() as Array<{
		name: string;
	}>;
	const hasNonScope = columns.some((column) => column.name === 'non_scope');
	const nonScopeSelect = hasNonScope ? 'non_scope' : 'NULL AS non_scope';

	db.exec(`
		PRAGMA foreign_keys = OFF;
		PRAGMA legacy_alter_table = ON;
		ALTER TABLE work_project_details RENAME TO work_project_details_before_task_model;
		CREATE TABLE work_project_details (
		  work_item_id INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
		  goal TEXT,
		  definition_of_done TEXT,
		  why_it_matters TEXT,
		  scope TEXT,
		  non_scope TEXT,
		  health TEXT CHECK(health IN ('on_track','at_risk','blocked','unknown')),
		  operator TEXT,
		  start_date TEXT,
		  target_date TEXT,
		  actual_completed_date TEXT,
		  current_next_item_id INTEGER REFERENCES work_items(id),
		  last_meaningful_update_at INTEGER
		);
		INSERT INTO work_project_details (
		  work_item_id, goal, definition_of_done, why_it_matters, scope, non_scope, health,
		  operator, start_date, target_date, actual_completed_date, current_next_item_id,
		  last_meaningful_update_at
		)
		SELECT
		  work_item_id, goal, definition_of_done, why_it_matters, scope, ${nonScopeSelect}, health,
		  operator, start_date, target_date, actual_completed_date, current_next_step_id,
		  last_meaningful_update_at
		FROM work_project_details_before_task_model;
		DROP TABLE work_project_details_before_task_model;
		PRAGMA legacy_alter_table = OFF;
		PRAGMA foreign_keys = ON;
	`);
}

function migrateNextStepDetailsToTaskDetails(db: Database.Database): void {
	const oldTable = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_next_step_details'")
		.get();
	if (!oldTable) return;
	const newTable = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_task_details'")
		.get();
	if (!newTable) {
		db.exec('ALTER TABLE work_next_step_details RENAME TO work_task_details');
		return;
	}
	db.exec(`
		INSERT OR IGNORE INTO work_task_details (work_item_id, action)
		SELECT work_item_id, action FROM work_next_step_details;
		DROP TABLE work_next_step_details;
	`);
}

function backfillV2Details(db: Database.Database): void {
	const hasItems = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_items'")
		.get();
	if (!hasItems) return;
	db.exec(`
		INSERT OR IGNORE INTO work_project_details
		  (work_item_id, goal, definition_of_done, why_it_matters, scope, health, target_date, current_next_item_id, last_meaningful_update_at)
		SELECT id, coalesce(description, title), coalesce(next_action, 'Complete the project outcome'), body, description, 'unknown', due_date, null, last_activity_at
		FROM work_items WHERE type = 'project';

		INSERT OR IGNORE INTO work_milestone_details (work_item_id, marker, target_date)
		SELECT id, coalesce(next_action, title), due_date FROM work_items WHERE type = 'milestone';

		INSERT OR IGNORE INTO work_task_details (work_item_id, action)
		SELECT id, coalesce(next_action, title) FROM work_items WHERE type = 'task';

		INSERT OR IGNORE INTO work_open_question_details
		  (work_item_id, question_text, why_it_matters, answerer, blocked_item_id, proposed_answer, answer, answered_at)
		SELECT id, title, coalesce(description, 'Clarifies related work.'), coalesce(waiting_on, owner, 'operator'), parent_item_id, next_action, result,
		  CASE WHEN status = 'complete' THEN updated_at ELSE null END
		FROM work_items WHERE type = 'open_question';

		INSERT OR IGNORE INTO work_decision_details
		  (work_item_id, decision_question, options_json, recommended_option, consequence_of_no_decision, decision, decided_by, decided_at)
		SELECT id, title, '["Approve","Defer"]', coalesce(next_action, 'Approve'), coalesce(description, 'Related work remains waiting.'), result, owner,
		  CASE WHEN status = 'complete' THEN updated_at ELSE null END
		FROM work_items WHERE type = 'decision';

		INSERT OR IGNORE INTO work_change_request_details
		  (work_item_id, scope, systems_touched_json, risk, rollback_notes, verification_plan, approval_state, execution_state)
		SELECT id, coalesce(description, body, title), '[]', coalesce(priority, 'normal'), null, coalesce(next_action, 'Verify the requested change.'), 
		  CASE WHEN approval_required = 1 THEN 'required' ELSE 'not_required' END, status
		FROM work_items WHERE type = 'change_request';

		INSERT OR IGNORE INTO work_automation_details
		  (work_item_id, trigger_type, schedule, enabled, last_run_at, next_run_at, last_result, failure_count, generated_work_policy, backing_ref)
		SELECT id, 'heartbeat', coalesce(stale_after, scheduled_at), CASE WHEN status = 'blocked' THEN 0 ELSE 1 END, null, null, result, 0, next_action, null
		FROM work_items WHERE type = 'automation';

		INSERT OR IGNORE INTO work_finding_details (work_item_id, finding_text, source_refs_json)
		SELECT id, coalesce(description, body, title), '[]' FROM work_items WHERE type = 'finding';
		`);
}

function backfillWorkBlockerLinks(db: Database.Database): void {
	const hasLinks = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_blocker_links'")
		.get();
	if (!hasLinks) return;

	db.exec(`
		INSERT OR IGNORE INTO work_blocker_links
		  (project_id, blocked_item_id, blocker_source, blocker_item_id, external_label, reason,
		   unblock_action, status, created_at, updated_at, resolved_at)
		SELECT
		  CASE
		    WHEN blocked.type = 'project' THEN blocked.id
		    WHEN blocked_parent.type = 'project' THEN blocked_parent.id
		    WHEN blocked_grandparent.type = 'project' THEN blocked_grandparent.id
		    ELSE NULL
		  END,
		  oq.blocked_item_id,
		  'work_item',
		  wi.id,
		  NULL,
		  coalesce(oq.why_it_matters, wi.description, wi.title),
		  coalesce(oq.proposed_answer, wi.next_action, oq.question_text),
		  CASE WHEN wi.status IN ('complete','cancelled','archived') THEN 'resolved' ELSE 'active' END,
		  wi.created_at,
		  wi.updated_at,
		  CASE WHEN wi.status IN ('complete','cancelled','archived') THEN coalesce(oq.answered_at, wi.updated_at) ELSE NULL END
		FROM work_open_question_details oq
		INNER JOIN work_items wi ON wi.id = oq.work_item_id
		INNER JOIN work_items blocked ON blocked.id = oq.blocked_item_id
		LEFT JOIN work_items blocked_parent ON blocked_parent.id = blocked.parent_item_id
		LEFT JOIN work_items blocked_grandparent ON blocked_grandparent.id = blocked_parent.parent_item_id
		WHERE oq.blocked_item_id IS NOT NULL
		  AND oq.blocked_item_id != wi.id;

		INSERT OR IGNORE INTO work_blocker_links
		  (project_id, blocked_item_id, blocker_source, blocker_item_id, external_label, reason,
		   unblock_action, status, created_at, updated_at, resolved_at)
		SELECT
		  CASE
		    WHEN wi.type = 'project' THEN wi.id
		    WHEN parent.type = 'project' THEN parent.id
		    WHEN grandparent.type = 'project' THEN grandparent.id
		    ELSE NULL
		  END,
		  wi.id,
		  CASE
		    WHEN wi.waiting_on = 'system' THEN 'system'
		    WHEN wi.waiting_on = 'external' THEN 'external'
		    ELSE 'person'
		  END,
		  NULL,
		  CASE
		    WHEN wi.waiting_on = 'operator' THEN 'Operator'
		    WHEN wi.waiting_on = 'agent' THEN 'Agent'
		    WHEN wi.waiting_on = 'fred' THEN 'Fred'
		    WHEN wi.waiting_on = 'me' THEN 'Operator'
		    WHEN wi.waiting_on = 'system' THEN 'System'
		    WHEN wi.waiting_on = 'external' THEN 'External party'
		    ELSE wi.waiting_on
		  END,
		  CASE
		    WHEN wi.status = 'blocked' THEN 'This work is marked blocked.'
		    ELSE 'This work is waiting on ' || wi.waiting_on || '.'
		  END,
		  coalesce(wi.next_action, wi.title),
		  CASE WHEN wi.status IN ('complete','cancelled','archived') THEN 'resolved' ELSE 'active' END,
		  wi.created_at,
		  wi.updated_at,
		  CASE WHEN wi.status IN ('complete','cancelled','archived') THEN wi.updated_at ELSE NULL END
		FROM work_items wi
		LEFT JOIN work_items parent ON parent.id = wi.parent_item_id
		LEFT JOIN work_items grandparent ON grandparent.id = parent.parent_item_id
		WHERE wi.status IN ('blocked','waiting')
		  AND wi.waiting_on IS NOT NULL
		  AND trim(wi.waiting_on) != '';
	`);
}

function backfillWorkChangeLog(db: Database.Database): void {
	const existing = db.prepare('SELECT COUNT(*) as count FROM work_change_log').get() as {
		count: number;
	};
	if (existing.count > 0) return;

	db.exec(`
		INSERT INTO work_change_log
		  (occurred_at, actor, source, entity_type, entity_id, entity_title, action, project_id,
		   parent_item_id, area_id, summary, changes_json, metadata_json)
		SELECT
		  wi.created_at,
		  'migration',
		  'migration',
		  wi.type,
		  CAST(wi.id AS TEXT),
		  wi.title,
		  'created',
		  CASE
		    WHEN wi.type = 'project' THEN wi.id
		    WHEN parent.type = 'project' THEN parent.id
		    WHEN grandparent.type = 'project' THEN grandparent.id
		    ELSE NULL
		  END,
		  wi.parent_item_id,
		  wi.area_id,
		  'Added to Work history',
		  '[]',
		  json_object('backfilled', 1, 'status', wi.status, 'priority', wi.priority)
		FROM work_items wi
		LEFT JOIN work_items parent ON parent.id = wi.parent_item_id
		LEFT JOIN work_items grandparent ON grandparent.id = parent.parent_item_id;

		INSERT INTO work_change_log
		  (occurred_at, actor, source, entity_type, entity_id, entity_title, action, area_id,
		   summary, changes_json, metadata_json)
		SELECT
		  created_at,
		  'migration',
		  'migration',
		  CASE WHEN parent_area_id IS NULL THEN 'category' ELSE 'subcategory' END,
		  id,
		  title,
		  'created',
		  id,
		  CASE WHEN parent_area_id IS NULL THEN 'Existing category' ELSE 'Existing subcategory' END,
		  '[]',
		  json_object('backfilled', 1, 'parent_category_id', parent_area_id)
		FROM work_areas;
	`);
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
