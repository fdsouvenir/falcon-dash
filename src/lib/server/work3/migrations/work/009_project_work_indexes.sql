-- Project Ledger aggregates filter every Work family by Project and Phase.
-- Keep both access paths indexed because phase_id-only lookups cannot use a
-- project_id-leading composite index.

CREATE INDEX idx_tasks_phase ON tasks(phase_id);

CREATE INDEX idx_questions_project ON questions(project_id);
CREATE INDEX idx_questions_phase ON questions(phase_id);

CREATE INDEX idx_decisions_project ON decisions(project_id);
CREATE INDEX idx_decisions_phase ON decisions(phase_id);

CREATE INDEX idx_change_requests_project ON change_requests(project_id);
CREATE INDEX idx_change_requests_phase ON change_requests(phase_id);

-- The ledger overlays unpruned assignment boundaries during Event Log lag.
CREATE INDEX idx_event_outbox_assignments ON event_outbox(id)
WHERE event_type = 'work_assigned';
