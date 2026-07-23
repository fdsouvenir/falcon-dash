-- Vertical slice head tables: Area, Task, Blocker (docs 01–03).
-- Lifecycle columns are command-owned; derived state (blocked) is never stored.

CREATE TABLE areas (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  title TEXT NOT NULL,
  summary TEXT,
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','archived')),
  archived_at INTEGER,
  merged_into TEXT REFERENCES entities(id)
);

CREATE TABLE tasks (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  project_id TEXT REFERENCES entities(id),
  phase_id TEXT REFERENCES entities(id),
  title TEXT NOT NULL,
  summary TEXT,
  completion_condition TEXT,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK(status IN ('backlog','ready','in_progress','waiting','in_review','completed','cancelled')),
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  owner TEXT,
  due_at INTEGER,
  waiting_on TEXT,
  waiting_reason TEXT,
  waiting_since INTEGER,
  waiting_resume_condition TEXT,
  waiting_follow_up_at INTEGER,
  waiting_resume_status TEXT,
  output_revision INTEGER NOT NULL DEFAULT 0,
  result_summary TEXT,
  completed_at INTEGER,
  cancelled_at INTEGER,
  cancel_reason TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_owner ON tasks(owner);
CREATE INDEX idx_tasks_project ON tasks(project_id);

CREATE TABLE blockers (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  blocked_id TEXT NOT NULL REFERENCES entities(id),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('work','person','agent','system','external')),
  source_work_id TEXT REFERENCES entities(id),
  source_label TEXT,
  reason TEXT NOT NULL,
  resolution_condition TEXT NOT NULL,
  unblock_task_id TEXT REFERENCES entities(id),
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','resolved','invalidated')),
  resolved_at INTEGER,
  resolved_summary TEXT,
  resolution_source_refs TEXT NOT NULL DEFAULT '[]',
  invalidated_at INTEGER,
  invalidated_reason TEXT
);

CREATE INDEX idx_blockers_blocked_active ON blockers(blocked_id) WHERE state = 'active';
CREATE INDEX idx_blockers_source_work ON blockers(source_work_id) WHERE state = 'active';
