# Local Project Management System

**Status:** In Progress  
**Created:** 2026-02-06  
**Updated:** 2026-02-07  

---

## Overview

A local SQLite-based project management system optimized for AI agent operation with human oversight via UI. Designed as the source of truth for task tracking, replacing external project management tools.

### Goals

- SQLite database as single source of truth
- CLI as primary interface for AI agent operations
- Context generator for AI-readable summaries
- Activity logging for all operations
- API layer for UI consumption (future)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   SQLite Database                   │
│              (source of truth)                      │
└─────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────────┐   ┌─────────┐
    │   CLI    │   │   Context    │   │   API   │
    │  (pm)    │   │  Generator   │   │ (future)│
    └──────────┘   └──────────────┘   └─────────┘
          │               │               │
     AI Agent        Produces            UI
     uses for        markdown            consumes
     CRUD            summaries
```

### Actors

| Actor | Role | Interface |
|-------|------|-----------|
| **AI Agent** | Primary operator — creates, updates, comments, reasons | CLI |
| **User** | Views, reviews, occasional direct input | UI |
| **UI** | Renders project state for human consumption | API |

### Context Tiers

| Tier | Content | Size | Use Case |
|------|---------|------|----------|
| **Dashboard** | Active projects, due soon, blocked, recent activity | ~1-2k tokens | Session start, heartbeats |
| **Domain** | All projects in one domain with task summaries | ~3-5k tokens | Working in a focus area |
| **Project** | Full project: tasks, comments, activity, blocks | ~5-10k tokens | Deep dive on specific work |

---

## Data Model

```
Domain
└── Focus
    └── Project
        └── Task
            └── Task (subtask, recursive)
```

**Hierarchy:**
- **Domain** = Top-level life/work bucket (e.g., Personal, Business, Property)
- **Focus** = Thematic area within a domain (e.g., Finance, Health, Infrastructure)
- **Project** = Body of work with goals, contains tasks
- **Task** = Unit of work, can have subtasks (recursive)

---

## Entity Definitions

### Domain

_Top-level life/work bucket_

| Attribute   | Type        | Required | Notes                                  |
|-------------|-------------|----------|----------------------------------------|
| id          | TEXT        | Yes      | Slug PK: `personal`, `business`        |
| name        | TEXT        | Yes      | Display name: "Personal", "Business"   |
| description | TEXT        | No       | Optional description                   |
| created_at  | INTEGER     | Yes      | Unix timestamp (auto)                  |

**Example Domains:**
- `personal` → Personal
- `business` → Business
- `property` → Property

---

### Focus

_Thematic grouping within a domain_

| Attribute   | Type        | Required | Notes                                  |
|-------------|-------------|----------|----------------------------------------|
| id          | TEXT        | Yes      | Slug PK: `finance`, `health`           |
| domain_id   | TEXT        | Yes      | FK → Domain (slug)                     |
| name        | TEXT        | Yes      | Display name: "Finance", "Health"      |
| description | TEXT        | No       | Optional description                   |
| created_at  | INTEGER     | Yes      | Unix timestamp (auto)                  |

**Example Focuses:**
| Domain     | Focus              |
|------------|--------------------|
| Personal   | Finance            |
| Personal   | Health             |
| Personal   | Travel             |
| Business   | Infrastructure     |
| Business   | Operations         |
| Business   | Marketing          |

---

### Milestone

_Deadline grouping for projects/tasks_

| Attribute   | Type        | Required | Notes                                  |
|-------------|-------------|----------|----------------------------------------|
| id          | INTEGER     | Yes      | Auto PK, displayed as `M-1`            |
| name        | TEXT        | Yes      | "Q1 Launch", "Website Go Live"         |
| due_date    | TEXT        | No       | ISO date (YYYY-MM-DD)                  |
| description | TEXT        | No       | Optional description                   |
| created_at  | INTEGER     | Yes      | Unix timestamp (auto)                  |

---

### Project

_A body of work with goals — contains Tasks_

| Attribute        | Type        | Required | Notes                                      |
|------------------|-------------|----------|--------------------------------------------|
| id               | INTEGER     | Yes      | Auto PK, displayed as `P-1`                |
| focus_id         | TEXT        | Yes      | FK → Focus (slug)                          |
| title            | TEXT        | Yes      | Project title                              |
| description      | TEXT        | No       | Goals, scope, context (NOT task list)      |
| status           | TEXT        | Yes      | todo, in_progress, review, done, cancelled |
| milestone_id     | INTEGER     | No       | FK → Milestone                             |
| due_date         | TEXT        | No       | ISO date (YYYY-MM-DD)                      |
| priority         | TEXT        | No       | low, normal, high, urgent                  |
| external_ref     | TEXT        | No       | Reference to external system (URL, ID)     |
| created_at       | INTEGER     | Yes      | Unix timestamp (auto)                      |
| updated_at       | INTEGER     | Yes      | Unix timestamp (auto-update on field change) |
| last_activity_at | INTEGER     | Yes      | Unix timestamp (updated on any activity)   |

**Constraints:**
- Project description describes goals, NOT tasks (tasks are separate)

**Has:**
- Tasks (children)
- Comments
- Attachments
- Activity entries

---

### Task

_Unit of work within a Project — can have subtasks (recursive)_

| Attribute         | Type        | Required | Notes                                      |
|-------------------|-------------|----------|--------------------------------------------|
| id                | INTEGER     | Yes      | Auto PK, displayed as `T-1`                |
| parent_project_id | INTEGER     | Cond.    | FK → Project (if direct child of project)  |
| parent_task_id    | INTEGER     | Cond.    | FK → Task (if subtask)                     |
| title             | TEXT        | Yes      | Task title                                 |
| body              | TEXT        | No       | Details, notes, acceptance criteria        |
| status            | TEXT        | Yes      | todo, in_progress, review, done, cancelled |
| due_date          | TEXT        | No       | ISO date (YYYY-MM-DD)                      |
| priority          | TEXT        | No       | low, normal, high, urgent                  |
| milestone_id      | INTEGER     | No       | FK → Milestone                             |
| external_ref      | TEXT        | No       | Reference to external system (URL, ID)     |
| created_at        | INTEGER     | Yes      | Unix timestamp (auto)                      |
| updated_at        | INTEGER     | Yes      | Unix timestamp (auto-update on field change) |
| last_activity_at  | INTEGER     | Yes      | Unix timestamp (updated on any activity)   |

**Constraints:**
- Must have exactly ONE of: `parent_project_id` OR `parent_task_id`
- Subtasks are just Tasks with `parent_task_id` set
- Can nest arbitrarily deep

**Has:**
- Subtasks (child Tasks)
- Comments
- Attachments

---

### Comment

_Comments on Projects or Tasks_

| Attribute   | Type        | Required | Notes                                  |
|-------------|-------------|----------|----------------------------------------|
| id          | INTEGER     | Yes      | Auto PK, displayed as `C-1`            |
| target_type | TEXT        | Yes      | `project` or `task`                    |
| target_id   | INTEGER     | Yes      | FK to project or task                  |
| body        | TEXT        | Yes      | Comment content (markdown)             |
| author      | TEXT        | Yes      | Actor name (e.g., "Agent", "User")     |
| created_at  | INTEGER     | Yes      | Unix timestamp (auto)                  |

---

### Block

_Dependency relationships between tasks_

| Attribute  | Type        | Required | Notes                                  |
|------------|-------------|----------|----------------------------------------|
| blocker_id | INTEGER     | Yes      | FK → Task (the blocking task)          |
| blocked_id | INTEGER     | Yes      | FK → Task (the blocked task)           |

**Composite PK:** (blocker_id, blocked_id)

---

### Activity

_Project activity feed for audit trail_

| Attribute    | Type        | Required | Notes                                         |
|--------------|-------------|----------|-----------------------------------------------|
| id           | INTEGER     | Yes      | Auto PK, displayed as `A-1`                   |
| project_id   | INTEGER     | Yes      | FK → Project (denormalized for fast queries)  |
| actor        | TEXT        | Yes      | Actor name (e.g., "Agent", "User")            |
| action       | TEXT        | Yes      | created, updated, commented, status_changed, reopened, closed |
| target_type  | TEXT        | Yes      | project, task, comment                        |
| target_id    | INTEGER     | Yes      | FK to relevant entity                         |
| target_title | TEXT        | No       | Snapshot for display                          |
| details      | TEXT        | No       | JSON for action-specific data                 |
| created_at   | INTEGER     | Yes      | Unix timestamp (auto)                         |

**Example feed:**
```
Agent added a comment to T-12              2 mins ago
User re-opened T-2                          just now
Agent changed status of T-3 to "done"      5 mins ago
User created T-43                           1 hour ago
```

---

### Sync Mapping

_External system integration (for future sync capabilities)_

| Attribute       | Type        | Required | Notes                                         |
|-----------------|-------------|----------|-----------------------------------------------|
| id              | INTEGER     | Yes      | Auto PK                                       |
| entity_type     | TEXT        | Yes      | domain, focus, milestone, project, task, comment |
| entity_id       | INTEGER     | Yes      | FK to relevant entity                         |
| external_system | TEXT        | Yes      | System identifier: github, linear, jira, notion |
| external_id     | TEXT        | Yes      | ID in the external system                     |
| external_url    | TEXT        | No       | Display URL for linking                       |
| synced_at       | INTEGER     | No       | Last successful sync timestamp                |
| sync_state      | TEXT        | Yes      | synced, pending_push, pending_pull, conflict  |
| sync_metadata   | TEXT        | No       | JSON for system-specific data                 |
| created_at      | INTEGER     | Yes      | Unix timestamp (auto)                         |

**Constraints:**
- Unique on (entity_type, entity_id, external_system) — one mapping per entity per system
- Same entity can be synced to multiple external systems

**Sync States:**
| State | Meaning |
|-------|---------|
| synced | Local and external are in sync |
| pending_push | Local changes need to be pushed to external |
| pending_pull | External changes need to be pulled to local |
| conflict | Both sides changed, needs resolution |

---

### Attachment

_File references on projects or tasks_

| Attribute   | Type        | Required | Notes                                  |
|-------------|-------------|----------|----------------------------------------|
| id          | INTEGER     | Yes      | Auto PK                                |
| target_type | TEXT        | Yes      | `project` or `task`                    |
| target_id   | INTEGER     | Yes      | FK to project or task                  |
| file_path   | TEXT        | Yes      | Path to file                           |
| file_name   | TEXT        | Yes      | Display name                           |
| description | TEXT        | No       | Optional description                   |
| added_by    | TEXT        | Yes      | Actor who added it                     |
| created_at  | INTEGER     | Yes      | Unix timestamp (auto)                  |

**Notes:**
- File paths included in context output for AI consumption
- Files stored externally (not in database)

---

## Status Values

| Status      | Meaning                              |
|-------------|--------------------------------------|
| todo        | Not started                          |
| in_progress | Actively being worked on             |
| review      | Needs human review/approval          |
| done        | Completed                            |
| cancelled   | Abandoned/no longer needed           |
| archived    | Completed and hidden from active views |

---

## Priority Values

| Priority | Meaning                              |
|----------|--------------------------------------|
| low      | Nice to have, no rush                |
| normal   | Standard priority (default)          |
| high     | Important, do soon                   |
| urgent   | Drop everything, do now              |

---

## SQL Schema

```sql
-- Domains (slug IDs)
CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Focuses (slug IDs)
CREATE TABLE focuses (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Milestones (M-# IDs)
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  due_date TEXT,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Projects (P-# IDs)
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('todo','in_progress','review','done','cancelled','archived')) DEFAULT 'todo',
  milestone_id INTEGER REFERENCES milestones(id),
  due_date TEXT,
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  external_ref TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_activity_at INTEGER DEFAULT (unixepoch())
);

-- Tasks (T-# IDs, also subtasks via parent_task_id)
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_project_id INTEGER REFERENCES projects(id),
  parent_task_id INTEGER REFERENCES tasks(id),
  title TEXT NOT NULL,
  body TEXT,
  status TEXT CHECK(status IN ('todo','in_progress','review','done','cancelled','archived')) DEFAULT 'todo',
  due_date TEXT,
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  milestone_id INTEGER REFERENCES milestones(id),
  external_ref TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_activity_at INTEGER DEFAULT (unixepoch()),
  CHECK (
    (parent_project_id IS NOT NULL AND parent_task_id IS NULL) OR
    (parent_project_id IS NULL AND parent_task_id IS NOT NULL)
  )
);

-- Comments (C-# IDs)
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT CHECK(target_type IN ('project','task')) NOT NULL,
  target_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Blocks (dependencies between tasks)
CREATE TABLE blocks (
  blocker_id INTEGER NOT NULL REFERENCES tasks(id),
  blocked_id INTEGER NOT NULL REFERENCES tasks(id),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Activities (A-# IDs, project feed)
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  actor TEXT NOT NULL,
  action TEXT CHECK(action IN ('created','updated','commented','status_changed','reopened','closed')) NOT NULL,
  target_type TEXT CHECK(target_type IN ('project','task','comment')) NOT NULL,
  target_id INTEGER NOT NULL,
  target_title TEXT,
  details TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Attachments (file references on projects/tasks)
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT CHECK(target_type IN ('project','task')) NOT NULL,
  target_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,          -- path to file
  file_name TEXT NOT NULL,          -- display name
  description TEXT,                 -- optional description
  added_by TEXT NOT NULL,           -- actor who added it
  created_at INTEGER DEFAULT (unixepoch())
);

-- Sync Mappings (for external system integration)
CREATE TABLE sync_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT CHECK(entity_type IN ('domain','focus','milestone','project','task','comment')) NOT NULL,
  entity_id INTEGER NOT NULL,
  external_system TEXT NOT NULL,    -- 'github', 'linear', 'jira', 'notion', etc.
  external_id TEXT NOT NULL,        -- ID in that system
  external_url TEXT,                -- Display URL (optional)
  synced_at INTEGER,                -- Last successful sync timestamp
  sync_state TEXT CHECK(sync_state IN ('synced','pending_push','pending_pull','conflict')) DEFAULT 'synced',
  sync_metadata TEXT,               -- JSON for system-specific data
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(entity_type, entity_id, external_system)
);

-- Indexes
CREATE INDEX idx_focuses_domain ON focuses(domain_id);
CREATE INDEX idx_projects_focus ON projects(focus_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_due ON projects(due_date);
CREATE INDEX idx_projects_activity ON projects(last_activity_at);
CREATE INDEX idx_tasks_project ON tasks(parent_project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_activity ON tasks(last_activity_at);
CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_activities_project ON activities(project_id);
CREATE INDEX idx_activities_created ON activities(created_at);
CREATE INDEX idx_attachments_target ON attachments(target_type, target_id);
CREATE INDEX idx_sync_entity ON sync_mappings(entity_type, entity_id);
CREATE INDEX idx_sync_system ON sync_mappings(external_system);
CREATE INDEX idx_sync_state ON sync_mappings(sync_state);

-- Views for common queries
CREATE VIEW v_blocked_tasks AS
SELECT t.*, b.blocker_id
FROM tasks t
JOIN blocks b ON b.blocked_id = t.id
WHERE t.status NOT IN ('done', 'cancelled');

CREATE VIEW v_active_projects AS
SELECT p.*, d.name as domain_name, f.name as focus_name
FROM projects p
JOIN focuses f ON p.focus_id = f.id
JOIN domains d ON f.domain_id = d.id
WHERE p.status IN ('todo', 'in_progress', 'review');
```

**Notes:**
- Prefixes (`P-`, `T-`, etc.) are display conventions — the database stores raw integers
- CLI updates `last_activity_at` on projects/tasks when logging activity
- `updated_at` only changes on direct field edits; `last_activity_at` changes on any activity (comments, child updates, etc.)

---

## Phases

### Phase 1: Database Setup ⬜
- [ ] Create database file
- [ ] Apply schema
- [ ] Seed domains and focuses
- [ ] Seed existing milestones

### Phase 2: CLI — Core CRUD ⬜
- [ ] `pm project create` — create project
- [ ] `pm project list` — list projects with filters
- [ ] `pm project show <id>` — show project details
- [ ] `pm project update <id>` — update project fields
- [ ] `pm task create` — create task under project
- [ ] `pm task list` — list tasks with filters
- [ ] `pm task show <id>` — show task details
- [ ] `pm task update <id>` — update task fields
- [ ] `pm comment add <target>` — add comment to project/task
- [ ] All mutations auto-log to activity table

### Phase 3: CLI — Context Generator ⬜
- [ ] `pm context dashboard` — active, due soon, blocked, recent (~1-2k tokens)
- [ ] `pm context domain <id>` — domain deep dive (~3-5k tokens)
- [ ] `pm context project <id>` — full project context (~5-10k tokens)
- [ ] Output as markdown, suitable for AI consumption

### Phase 4: CLI — Queries & Reports ⬜
- [ ] `pm due [days]` — what's due in N days
- [ ] `pm blocked` — what's blocked and by what
- [ ] `pm stale [days]` — no activity in N days
- [ ] `pm activity [project]` — recent activity feed

### Phase 5: Data Migration ⬜
- [ ] Export data from existing project management system
- [ ] Map existing categories to Domain/Focus
- [ ] Import projects with their tasks
- [ ] Import comments
- [ ] Preserve external references

### Phase 6: Integration ⬜
- [ ] Update agent heartbeat to use `pm context dashboard`
- [ ] Replace existing dashboard with generated context
- [ ] Document CLI usage for agent

---

## CLI Specification

### Command Structure

```
pm <entity> <action> [args] [--flags]
```

### Project Commands

| Command | Description | Example |
|---------|-------------|---------|
| `pm project create` | Create project | `pm project create --focus=finance --title="Tax Resolution"` |
| `pm project list` | List projects | `pm project list --status=in_progress` |
| `pm project show <id>` | Show project | `pm project show P-1` |
| `pm project update <id>` | Update project | `pm project update P-1 --status=done` |

### Task Commands

| Command | Description | Example |
|---------|-------------|---------|
| `pm task create` | Create task | `pm task create --project=P-1 --title="Gather docs"` |
| `pm task create` | Create subtask | `pm task create --parent=T-5 --title="Get W-2s"` |
| `pm task list` | List tasks | `pm task list --project=P-1 --status=todo` |
| `pm task show <id>` | Show task | `pm task show T-42` |
| `pm task update <id>` | Update task | `pm task update T-42 --status=done` |

### Comment Commands

| Command | Description | Example |
|---------|-------------|---------|
| `pm comment add` | Add comment | `pm comment add --task=T-42 --body="Completed review"` |
| `pm comment add` | Add to project | `pm comment add --project=P-1 --body="Scope updated"` |

### Block Commands

| Command | Description | Example |
|---------|-------------|---------|
| `pm block add` | Add dependency | `pm block add --blocker=T-10 --blocked=T-11` |
| `pm block remove` | Remove dependency | `pm block remove --blocker=T-10 --blocked=T-11` |
| `pm blocked` | Show blocked tasks | `pm blocked` |

### Attachment Commands

| Command | Description | Example |
|---------|-------------|---------|
| `pm attach add` | Add attachment | `pm attach add --task=T-42 --path="~/docs/file.pdf" --name="Report"` |
| `pm attach add` | Add to project | `pm attach add --project=P-1 --path="~/docs/spec.md"` |
| `pm attach list` | List attachments | `pm attach list --task=T-42` |
| `pm attach remove` | Remove attachment | `pm attach remove <id>` |

### Context Commands (AI-optimized output)

| Command | Description | Output Size |
|---------|-------------|-------------|
| `pm context dashboard` | Overview: active, due, blocked, recent | ~1-2k tokens |
| `pm context domain <id>` | Domain deep dive | ~3-5k tokens |
| `pm context project <id>` | Full project context | ~5-10k tokens |

### Query Commands

| Command | Description | Example |
|---------|-------------|---------|
| `pm due [days]` | Due within N days | `pm due 7` |
| `pm stale [days]` | No activity in N days | `pm stale 14` |
| `pm activity` | Recent activity | `pm activity --limit=20` |
| `pm activity <project>` | Project activity | `pm activity P-1` |

### Common Flags

| Flag | Description |
|------|-------------|
| `--status=<s>` | Filter by status (todo, in_progress, review, done, cancelled) |
| `--priority=<p>` | Filter by priority (low, normal, high, urgent) |
| `--domain=<d>` | Filter by domain slug |
| `--focus=<f>` | Filter by focus slug |
| `--format=<f>` | Output format (table, json, markdown) |

### Activity Auto-Logging

All mutations automatically log to the activity table:
- **Actor:** Identifier for who performed the action (e.g., "Agent", "User")
- **Action:** created, updated, commented, status_changed, reopened, closed
- **Details:** JSON with field changes, old/new values

---

## Context Output Format

### Dashboard Context (`pm context dashboard`)

```markdown
# Project Dashboard
*Generated: 2026-02-07 15:30*

## 🔴 Due Soon (7 days)
- **P-3** Tax Resolution (Personal/Finance) — due 2026-02-10 — IN PROGRESS
  - T-15 Gather documents — TODO
  
## 🟡 In Progress
- **P-1** Infrastructure Deployment (Business/Infrastructure) — 4/6 tasks done
- **P-3** Tax Resolution (Personal/Finance) — 1/3 tasks done

## 🚧 Blocked
- **T-22** Deploy to prod — blocked by T-21 (fix OAuth)

## 📋 Recent Activity
- Agent commented on T-15 (2 hours ago)
- User created P-5 "Trip Planning" (yesterday)
- Agent changed T-10 status to done (yesterday)
```

### Project Context (`pm context project P-3`)

```markdown
# P-3: Tax Resolution

**Domain:** Personal | **Focus:** Finance
**Status:** In Progress | **Priority:** High
**Due:** 2026-02-10 | **Milestone:** —

## Description
Resolve tax obligations and get current year taxes filed.

## Tasks
- **T-15** Gather documents — TODO
  - Need W-2s, 1099s from all sources
  - 📎 w2-2025.pdf (`~/Documents/taxes/w2-2025.pdf`)
- **T-16** Provide info to accountant — TODO  
- **T-17** Follow up — TODO

## Attachments
- 📎 engagement-letter.pdf (`~/Documents/taxes/engagement-letter.pdf`) — Accountant engagement letter

## Comments
**Agent** (2026-02-06): Submitted contact form to accountant...
**User** (2026-02-05): Accountant is coordinating with attorney...

## Activity
- T-15 created by Agent (2026-02-06)
- P-3 status changed to in_progress by User (2026-02-05)
- P-3 created by Agent (2026-02-04)

## Blocks
- None

## Blocked By
- None
```

---

## Decisions

- **ID format:** Prefixed integers (see below)
- **External sync:** None — local DB is source of truth
- **UI:** CLI only for now

### ID Prefixes

| Entity    | Prefix | Example  | Notes                          |
|-----------|--------|----------|--------------------------------|
| Domain    | —      | `personal` | Slug (static, rarely changes) |
| Focus     | —      | `finance`  | Slug (static, rarely changes) |
| Milestone | `M-`   | `M-1`    | Prefixed integer               |
| Project   | `P-`   | `P-42`   | Prefixed integer               |
| Task      | `T-`   | `T-103`  | Prefixed integer               |
| Comment   | `C-`   | `C-7`    | Prefixed integer               |
| Activity  | `A-`   | `A-256`  | Prefixed integer (rarely referenced) |

---

## UI Functional Requirements

### Interaction Patterns

| Pattern | Scope | Notes |
|---------|-------|-------|
| **Drag & Drop** | Everywhere | Reorder items, move between parents, change status (kanban) |
| **Print/Share** | Project level | Shareable/printable project view |

### Domain Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View all domains | |
| Create | Add new domain | |
| Edit | Change name, description | |
| Delete | Remove domain | Blocked if has focuses |
| Reorder | Change display order | Drag & drop |

### Focus Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View focuses by domain or all | |
| Create | Add new focus under domain | |
| Edit | Change name, description | |
| Move | Move to different domain | Drag & drop |
| Delete | Remove focus | Blocked if has projects |
| Reorder | Change display order within domain | Drag & drop |

### Milestone Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View all milestones | |
| Create | Add new milestone | |
| Edit | Change name, due date, description | |
| Delete | Remove milestone | Linked items remain unchanged (milestone cleared) |
| View items | See all projects/tasks in milestone | |

### Project Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View projects with filters | Status, domain, focus, priority, due date |
| View | Single project detail page | Tasks, comments, activity, attachments |
| Create | New project under focus | |
| Edit | Update all fields | Title, description, status, priority, due, milestone, focus |
| Move | Change focus | Drag & drop |
| Archive | Set status to archived | Hidden from active views |
| Delete | Remove project | Confirmation required |
| Add comment | Comment on project | |
| Add attachment | Attach file reference | |
| View activity | Project activity feed | |
| Print/Share | Shareable project view | |

### Task Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View tasks with filters | By project, status, priority, due |
| View | Single task detail | Subtasks, comments, attachments, blocks |
| Create | New task under project | |
| Create subtask | New task under task | |
| Edit | Update all fields | Title, body, status, priority, due, milestone |
| Move | Change parent project or task | Drag & drop |
| Reorder | Change position within parent | Drag & drop |
| Delete | Remove task | Option: delete subtasks OR move up to parent |
| Add comment | Comment on task | |
| Add attachment | Attach file reference | |

### Comment Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View comments on project/task | Threaded display |
| Create | Add comment | |
| Edit | Edit own comment | |
| Delete | Delete comment | |

### Block/Dependency Management

| Action | Description | Behavior |
|--------|-------------|----------|
| View | See what blocks / is blocked by | On task detail |
| Add | Create dependency | T-X blocks T-Y |
| Remove | Remove dependency | |
| Visualize | Dependency graph | Visual representation of all blocks |

### Activity Feed

| Action | Description | Behavior |
|--------|-------------|----------|
| View global | All recent activity | |
| View by project | Project-scoped activity | |
| View by task | Task-scoped activity | |
| Filter | By actor, action type, date range | |

### Views

| View | Description | Notes |
|------|-------------|-------|
| **Dashboard** | Due soon, blocked, in progress, recent activity | Default landing |
| **Kanban** | Columns by status | Drag to change status |
| **List** | Sortable, filterable table | |
| **Tree** | Domain → Focus → Project hierarchy | Collapsible |

### Search & Filter

| Feature | Description |
|---------|-------------|
| Global search | Search across all projects/tasks |
| Filter by status | todo, in_progress, review, done, cancelled, archived |
| Filter by priority | low, normal, high, urgent |
| Filter by domain | Scope to domain |
| Filter by focus | Scope to focus |
| Filter by due date | Due within N days, overdue |
| Filter by milestone | Scope to milestone |

### Bulk Operations

| Action | Description |
|--------|-------------|
| Multi-select | Select multiple tasks |
| Bulk status change | Change status on selection |
| Bulk move | Move selection to different project |
| Bulk milestone | Assign milestone to selection |

### Attachment Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View attachments on project/task | |
| Add | Add file reference | Path + display name + optional description |
| Remove | Remove attachment | |
| Open | Open/download file | If accessible |
