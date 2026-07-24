-- Project history joins bounded subject/interval relations by subject id and
-- event ULID. The original index leads with subject_type and cannot serve
-- this cross-type ledger access path.

CREATE INDEX idx_events_subject_id ON events(subject_id, id);
