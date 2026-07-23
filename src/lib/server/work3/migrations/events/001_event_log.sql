-- work3-events.db: append-only Event Log (doc 01). ULID primary keys make the
-- outbox transfer an idempotent insert-or-ignore across the two databases.

CREATE TABLE events (
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
  source_refs_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_events_subject ON events(subject_type, subject_id, occurred_at);
CREATE INDEX idx_events_time ON events(occurred_at);
CREATE INDEX idx_events_type ON events(event_type, occurred_at);
