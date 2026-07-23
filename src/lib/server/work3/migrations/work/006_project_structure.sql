-- Project structure: Project, Phase, Milestone, and the typed relationship
-- table (docs 01–03). Health, progress, and schedule state are derived.

CREATE TABLE projects (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  title TEXT NOT NULL,
  summary TEXT,
  desired_outcome TEXT,
  why_it_matters TEXT,
  scope_included TEXT NOT NULL DEFAULT '[]',
  scope_excluded TEXT NOT NULL DEFAULT '[]',
  completion_criteria TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','planned','active','paused','completed','cancelled')),
  health_override TEXT,
  owner TEXT,
  current_next_item_id TEXT REFERENCES entities(id),
  plan_id TEXT REFERENCES entities(id),
  plan_not_required_reason TEXT,
  parallel_phases_allowed INTEGER NOT NULL DEFAULT 0,
  target_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  outcome_summary TEXT,
  cancelled_at INTEGER,
  cancel_reason TEXT,
  child_disposition TEXT,
  reopen_reason TEXT,
  archived_at INTEGER
);

CREATE INDEX idx_projects_status ON projects(status);

CREATE TABLE phases (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  project_id TEXT NOT NULL REFERENCES entities(id),
  title TEXT NOT NULL,
  summary TEXT,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK(status IN ('planned','active','completed','skipped')),
  started_at INTEGER,
  target_at INTEGER,
  completed_at INTEGER,
  skip_reason TEXT,
  reopen_reason TEXT
);

CREATE INDEX idx_phases_project ON phases(project_id, sequence);

CREATE TABLE milestones (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  project_id TEXT NOT NULL REFERENCES entities(id),
  title TEXT NOT NULL,
  summary TEXT,
  success_condition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','achieved','cancelled')),
  sequence INTEGER NOT NULL DEFAULT 0,
  target_at INTEGER,
  achieved_at INTEGER,
  source_refs TEXT NOT NULL DEFAULT '[]',
  waived_sources_reason TEXT,
  cancel_reason TEXT,
  reopen_reason TEXT
);

CREATE INDEX idx_milestones_project ON milestones(project_id, sequence);

-- Typed semantic links (doc 03). Blockers stay specialized records;
-- supersession/answers/authorization stay specialized fields/artifacts.
-- Removal keeps the row for audit (removed_at) — active links have
-- removed_at IS NULL AND invalidated_at IS NULL.
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  rel_type TEXT NOT NULL CHECK(rel_type IN
    ('depends_on','contributes_to','satisfies','implements','derived_from','related_to')),
  source_id TEXT NOT NULL REFERENCES entities(id),
  target_id TEXT NOT NULL REFERENCES entities(id),
  criterion_id TEXT,
  source_revision TEXT,
  source_refs TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  removed_at INTEGER,
  removed_by TEXT,
  invalidated_at INTEGER,
  invalidated_reason TEXT
);

CREATE INDEX idx_relationships_source ON relationships(source_id) WHERE removed_at IS NULL;
CREATE INDEX idx_relationships_target ON relationships(target_id) WHERE removed_at IS NULL;
