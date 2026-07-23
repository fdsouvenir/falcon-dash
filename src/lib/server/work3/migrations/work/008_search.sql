-- Browse search (doc 05): FTS5 index over Work titles/bodies, maintained by
-- triggers on each head table. entity_id/type are UNINDEXED payload columns.

CREATE VIRTUAL TABLE work_search USING fts5(entity_id UNINDEXED, type UNINDEXED, title, body);

-- Tasks
CREATE TRIGGER trg_search_tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'task', new.title, coalesce(new.summary, ''));
END;
CREATE TRIGGER trg_search_tasks_au AFTER UPDATE OF title, summary ON tasks BEGIN
  DELETE FROM work_search WHERE entity_id = old.entity_id;
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'task', new.title, coalesce(new.summary, ''));
END;

-- Questions
CREATE TRIGGER trg_search_questions_ai AFTER INSERT ON questions BEGIN
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'question', new.question, coalesce(new.context, ''));
END;
CREATE TRIGGER trg_search_questions_au AFTER UPDATE OF question, context ON questions BEGIN
  DELETE FROM work_search WHERE entity_id = old.entity_id;
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'question', new.question, coalesce(new.context, ''));
END;

-- Decisions (title/prompt live on the current package revision)
CREATE TRIGGER trg_search_decision_packages_ai AFTER INSERT ON decision_packages BEGIN
  DELETE FROM work_search WHERE entity_id = new.parent_id;
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.parent_id, 'decision', new.title, new.prompt);
END;

-- Findings
CREATE TRIGGER trg_search_findings_ai AFTER INSERT ON findings BEGIN
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'finding', new.title, new.conclusion);
END;

-- Projects
CREATE TRIGGER trg_search_projects_ai AFTER INSERT ON projects BEGIN
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'project', new.title, coalesce(new.desired_outcome, ''));
END;
CREATE TRIGGER trg_search_projects_au AFTER UPDATE OF title, desired_outcome ON projects BEGIN
  DELETE FROM work_search WHERE entity_id = old.entity_id;
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'project', new.title, coalesce(new.desired_outcome, ''));
END;

-- Change Requests
CREATE TRIGGER trg_search_changes_ai AFTER INSERT ON change_requests BEGIN
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'change_request', new.title, coalesce(new.summary, ''));
END;

-- Areas
CREATE TRIGGER trg_search_areas_ai AFTER INSERT ON areas BEGIN
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'area', new.title, coalesce(new.summary, ''));
END;
CREATE TRIGGER trg_search_areas_au AFTER UPDATE OF title, summary ON areas BEGIN
  DELETE FROM work_search WHERE entity_id = old.entity_id;
  INSERT INTO work_search (entity_id, type, title, body)
  VALUES (new.entity_id, 'area', new.title, coalesce(new.summary, ''));
END;

-- Backfill existing rows
INSERT INTO work_search (entity_id, type, title, body)
  SELECT entity_id, 'task', title, coalesce(summary, '') FROM tasks;
INSERT INTO work_search (entity_id, type, title, body)
  SELECT entity_id, 'question', question, coalesce(context, '') FROM questions;
INSERT INTO work_search (entity_id, type, title, body)
  SELECT parent_id, 'decision', title, prompt FROM decision_packages WHERE is_current = 1;
INSERT INTO work_search (entity_id, type, title, body)
  SELECT entity_id, 'finding', title, conclusion FROM findings;
INSERT INTO work_search (entity_id, type, title, body)
  SELECT entity_id, 'project', title, coalesce(desired_outcome, '') FROM projects;
INSERT INTO work_search (entity_id, type, title, body)
  SELECT entity_id, 'change_request', title, coalesce(summary, '') FROM change_requests;
INSERT INTO work_search (entity_id, type, title, body)
  SELECT entity_id, 'area', title, coalesce(summary, '') FROM areas;
