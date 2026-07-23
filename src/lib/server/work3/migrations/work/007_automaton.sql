-- Automaton extension attributes (doc 06): keyed by the OpenClaw job id,
-- which IS the Automaton identity (the entities row uses the same id).
-- last_seen_runtime_config is a snapshot cache serving recoverable deletion
-- only — explicitly NOT mirrored desired-state; nothing reconciles against it.

CREATE TABLE automaton_attrs (
  job_id TEXT PRIMARY KEY REFERENCES entities(id),
  project_id TEXT REFERENCES entities(id),
  summary TEXT,
  policies TEXT NOT NULL DEFAULT '{}',
  last_seen_runtime_config TEXT,
  last_seen_at INTEGER,
  deleted_at INTEGER,
  deletion_snapshot TEXT,
  deletion_source TEXT,
  restored_from TEXT,
  restored_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_automaton_attrs_deleted ON automaton_attrs(deleted_at);
