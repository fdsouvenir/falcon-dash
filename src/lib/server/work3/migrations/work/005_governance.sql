-- Governance cluster: Plan (revision lifecycle), Review (immutable outcomes),
-- Authorization (pinned grants, derived effectiveness), Change Request
-- (independent execution + verification state machines).

CREATE TABLE plans (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  work_item_id TEXT NOT NULL REFERENCES entities(id),
  title TEXT NOT NULL
);

CREATE INDEX idx_plans_work_item ON plans(work_item_id);

-- Plan revisions: draft (mutable) -> submitted (immutable) -> superseded |
-- withdrawn. is_current marks the current applicable revision (a submitted
-- revision stays current until its replacement draft is submitted).
CREATE TABLE plan_revisions (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES entities(id),
  supersedes TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','submitted','superseded','withdrawn')),
  summary TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  assumptions TEXT,
  risks TEXT,
  out_of_scope TEXT,
  validation_checks TEXT,
  author_kind TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_label TEXT NOT NULL,
  submitted_at INTEGER,
  withdrawn_reason TEXT
);

CREATE INDEX idx_plan_revisions_parent ON plan_revisions(parent_id);

-- Reviews are immutable point-in-time evaluations of an exact subject revision.
CREATE TABLE reviews (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES entities(id),
  subject_revision TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('approved','changes_requested','rejected','commented')),
  summary TEXT NOT NULL,
  comments TEXT NOT NULL DEFAULT '[]',
  source_refs TEXT NOT NULL DEFAULT '[]',
  reviewer_kind TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_label TEXT NOT NULL,
  submitted_at INTEGER NOT NULL
);

CREATE INDEX idx_reviews_subject ON reviews(subject_id, subject_revision);

-- Authorizations are immutable pinned grants; effectiveness is derived.
CREATE TABLE authorizations (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES entities(id),
  subject_revision TEXT NOT NULL,
  plan_id TEXT REFERENCES entities(id),
  plan_revision TEXT,
  scope_fingerprint TEXT NOT NULL,
  conditions TEXT NOT NULL DEFAULT '[]',
  one_time INTEGER NOT NULL DEFAULT 0,
  authorizer_kind TEXT NOT NULL,
  authorizer_id TEXT NOT NULL,
  authorizer_label TEXT NOT NULL,
  authority_basis TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  revoke_reason TEXT,
  revoked_by TEXT,
  consumed_at INTEGER,
  consumed_reason TEXT,
  source_refs TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_authorizations_subject ON authorizations(subject_id);

CREATE TABLE change_requests (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  project_id TEXT REFERENCES entities(id),
  phase_id TEXT REFERENCES entities(id),
  title TEXT NOT NULL,
  summary TEXT,
  execution_state TEXT NOT NULL DEFAULT 'not_started'
    CHECK(execution_state IN ('not_started','in_progress','paused','succeeded','failed','cancelled','rolled_back')),
  verification_state TEXT NOT NULL DEFAULT 'not_started'
    CHECK(verification_state IN ('not_started','in_progress','passed','failed','waived')),
  plan_id TEXT REFERENCES entities(id),
  criteria_status TEXT NOT NULL DEFAULT '{}',
  result_summary TEXT,
  failure_summary TEXT,
  cancel_reason TEXT,
  execution_started_at INTEGER,
  execution_finished_at INTEGER,
  verification_finished_at INTEGER,
  verification_waived_reason TEXT,
  rollback_started_at INTEGER,
  rolled_back_at INTEGER
);

CREATE INDEX idx_change_requests_exec ON change_requests(execution_state);

-- Immutable authority-ready packages (revision-table pattern; is_current flips
-- on revision — Authorization pins the exact revision id).
CREATE TABLE change_revisions (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES entities(id),
  supersedes TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  scope_allowed TEXT NOT NULL,
  scope_prohibited TEXT,
  targets TEXT NOT NULL,
  risk TEXT NOT NULL,
  safety TEXT,
  acceptance_criteria TEXT NOT NULL
);

CREATE INDEX idx_change_revisions_parent ON change_revisions(parent_id);
