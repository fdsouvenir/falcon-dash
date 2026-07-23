-- work3.db foundation: entity envelope, id allocation, idempotency, event outbox.

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  area_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_area ON entities(area_id);

CREATE TABLE id_counters (
  type TEXT PRIMARY KEY,
  next_seq INTEGER NOT NULL
);

-- Idempotency records scoped to command + target + caller context (doc 02).
CREATE TABLE idempotency_keys (
  key TEXT NOT NULL,
  command TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  actor_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (key, command, target, actor_key)
);

-- Transactional outbox: written in the same transaction as every canonical
-- mutation; only the transfer worker reads it (doc 01 Event Log rules).
CREATE TABLE event_outbox (
  id TEXT PRIMARY KEY,
  occurred_at INTEGER NOT NULL,
  command TEXT NOT NULL,
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_label TEXT NOT NULL,
  version_from INTEGER,
  version_to INTEGER,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  transferred_at INTEGER
);

CREATE INDEX idx_event_outbox_pending ON event_outbox(occurred_at) WHERE transferred_at IS NULL;
CREATE INDEX idx_event_outbox_transferred ON event_outbox(transferred_at) WHERE transferred_at IS NOT NULL;
