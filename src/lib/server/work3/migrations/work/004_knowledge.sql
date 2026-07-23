-- Knowledge objects: Question (immutable answer revisions), Decision
-- (immutable decision-ready packages + immutable outcome), Finding (validity).

CREATE TABLE questions (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  project_id TEXT REFERENCES entities(id),
  phase_id TEXT REFERENCES entities(id),
  question TEXT NOT NULL,
  context TEXT,
  impact TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','withdrawn')),
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  steward TEXT,
  answerable_by TEXT NOT NULL DEFAULT '[]',
  working_hypothesis TEXT,
  target_at INTEGER,
  withdrawn_at INTEGER,
  withdraw_reason TEXT
);

CREATE INDEX idx_questions_status ON questions(status);

-- Immutable answer revisions (revision-table pattern).
CREATE TABLE question_answers (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES entities(id),
  supersedes TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  answer TEXT NOT NULL,
  answerer_kind TEXT NOT NULL,
  answerer_id TEXT NOT NULL,
  answerer_label TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK(confidence IN ('tentative','supported','confirmed')),
  source_refs TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_question_answers_parent ON question_answers(parent_id);

CREATE TABLE decisions (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  project_id TEXT REFERENCES entities(id),
  phase_id TEXT REFERENCES entities(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','deferred','decided','withdrawn')),
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  needed_by INTEGER,
  supersedes_decision_id TEXT REFERENCES entities(id),
  superseded_by TEXT REFERENCES entities(id),
  outcome TEXT,
  decided_at INTEGER,
  deferred_reason TEXT,
  deferred_until INTEGER,
  withdrawn_at INTEGER,
  withdraw_reason TEXT
);

CREATE INDEX idx_decisions_status ON decisions(status);

-- Immutable decision-ready packages (revision-table pattern).
CREATE TABLE decision_packages (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES entities(id),
  supersedes TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  context TEXT,
  stakes TEXT,
  consequence_of_no_decision TEXT NOT NULL,
  deciders TEXT NOT NULL,
  options TEXT NOT NULL,
  recommendation TEXT NOT NULL
);

CREATE INDEX idx_decision_packages_parent ON decision_packages(parent_id);

CREATE TABLE findings (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id),
  project_id TEXT REFERENCES entities(id),
  title TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  significance TEXT,
  confidence TEXT NOT NULL CHECK(confidence IN ('tentative','supported','confirmed')),
  validity TEXT NOT NULL DEFAULT 'current' CHECK(validity IN ('current','superseded','retracted')),
  source_refs TEXT NOT NULL,
  targets TEXT NOT NULL DEFAULT '[]',
  observed_at INTEGER,
  author_kind TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_label TEXT NOT NULL,
  supersedes_finding_id TEXT REFERENCES entities(id),
  superseded_by TEXT REFERENCES entities(id),
  retracted_at INTEGER,
  retract_reason TEXT,
  retract_source_refs TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_findings_validity ON findings(validity);
