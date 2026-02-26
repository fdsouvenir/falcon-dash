# PM pipeline

This document describes the project management system internals, from database schema through context generation to the frontend UI.

See also:

- [Architecture overview](architecture.md) -- system-level context
- [Components](components.md) -- PM UI components
- [Stores](stores.md) -- PM stores
- [fredbot integration](fredbot-integration.md) -- how agents interact with PM data

## Database schema

**File:** `src/lib/server/pm/database.ts`

The PM system uses better-sqlite3 in WAL mode at `~/.openclaw/data/pm.db`. The schema has four tables in a hierarchy: domains -> focuses -> projects, plus activities.

### Domains

Top-level categories with slug IDs:

```sql
CREATE TABLE domains (
  id TEXT PRIMARY KEY,              -- slug, e.g. 'engineering'
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
```

### Focuses

Sub-categories within a domain:

```sql
CREATE TABLE focuses (
  id TEXT PRIMARY KEY,              -- slug, e.g. 'frontend'
  domain_id TEXT NOT NULL REFERENCES domains(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
```

### Projects

Work items with rich markdown body:

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  title TEXT NOT NULL,
  description TEXT,
  body TEXT,                        -- rich markdown content
  status TEXT CHECK(status IN ('todo','in_progress','review',
                                'done','cancelled','archived')) DEFAULT 'todo',
  due_date TEXT,                    -- ISO 8601 date (YYYY-MM-DD)
  priority TEXT CHECK(priority IN ('low','normal','high','urgent')),
  external_ref TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_activity_at INTEGER DEFAULT (unixepoch())
);
```

Projects are markdown documents. Agents write rich-formatted content to the `body` field via PATCH requests to the REST API.

### Activities

Audit log for project changes:

```sql
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  actor TEXT NOT NULL,              -- 'system', agent ID, or user
  action TEXT CHECK(action IN ('created','updated','commented',
                                'status_changed','reopened','closed')) NOT NULL,
  target_type TEXT CHECK(target_type IN ('project')) NOT NULL,
  target_id INTEGER NOT NULL,
  target_title TEXT,
  details TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
```

### Full-text search

An FTS5 virtual table indexes project titles and bodies with porter stemming:

```sql
CREATE VIRTUAL TABLE pm_search USING fts5(
  entity_type,
  entity_id UNINDEXED,
  project_id UNINDEXED,
  title,
  body,
  tokenize='porter unicode61'
);
```

SQLite triggers automatically sync the FTS table on project INSERT, UPDATE, and DELETE.

### View

`v_active_projects` joins projects with their focus and domain names, filtered to active statuses (`todo`, `in_progress`, `review`).

### Database initialization

`getDb()` returns a singleton `Database` instance. On first call:

1. Creates the directory at `~/.openclaw/data/` if needed
2. Opens the database file
3. Enables WAL mode and foreign key constraints
4. Runs the schema DDL (all `CREATE IF NOT EXISTS`)

The database path can be overridden with `PM_DATABASE_PATH` or `OPENCLAW_DATA_DIR` environment variables.

## Server modules

All PM server code lives in `src/lib/server/pm/`:

| Module                   | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `database.ts`            | Schema, types, `getDb()` singleton                      |
| `crud.ts`                | CRUD operations for all four entities                   |
| `search.ts`              | FTS5 search queries                                     |
| `stats.ts`               | Dashboard statistics (total, active, due soon, overdue) |
| `validation.ts`          | Input validation for API routes                         |
| `events.ts`              | PM event emitter (`onPMEvent` / `emitPMEvent`)          |
| `errors.ts`              | PM-specific error types                                 |
| `context.ts`             | Markdown generation for dashboard and project contexts  |
| `context-generator.ts`   | Writes context files to disk, creates symlinks          |
| `context-scheduler.ts`   | Debounced regeneration scheduler                        |
| `workspace-discovery.ts` | Discovers agent workspace paths                         |
| `index.ts`               | Re-exports                                              |

### CRUD operations (`crud.ts`)

Standard CRUD for each entity:

- **Domains:** `listDomains`, `getDomain`, `createDomain`, `updateDomain`, `deleteDomain`, `reorderDomains`
- **Focuses:** `listFocuses`, `getFocus`, `createFocus`, `updateFocus`, `deleteFocus`, `reorderFocuses`, `moveFocus`
- **Projects:** `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`
- **Activities:** `listActivities`, `logActivity`

Activities are auto-generated: `createProject` and `updateProject` both call `logActivity` internally.

## Context generation

**File:** `src/lib/server/pm/context-generator.ts`

`generateAndWriteContext()` produces markdown files that give agents read access to PM data.

### Output directory

Default: `~/.openclaw/data/pm-context/` (override with `PM_CONTEXT_DIR` env var).

### Generated files

1. **`PROJECTS.md`** -- active project summary table:

   ```markdown
   # Active Projects

   > Generated: 2026-02-25T12:00:00.000Z

   | ID  | Title              | Status      | Domain/Focus         | Due        |
   | --- | ------------------ | ----------- | -------------------- | ---------- |
   | P-1 | Dashboard redesign | in_progress | Engineering/Frontend | 2026-03-01 |
   | P-2 | API documentation  | todo        | Engineering/Backend  | -          |
   ```

   Followed by the dashboard context (statistics and summaries).

2. **`Projects/{id}.md`** -- per-project detail files for each active project. Stale files (for projects no longer active) are cleaned up.

3. **`PM-API.md`** -- auto-generated REST API reference documenting all endpoints, parameters, and response formats. This teaches agents how to `curl` the PM API directly.

### Symlink distribution

After writing files, `symlinkToWorkspaces()` creates symlinks in each agent workspace:

```
~/.openclaw/workspace/          # Agent workspace
  PROJECTS.md -> ~/.openclaw/data/pm-context/PROJECTS.md
  Projects/ -> ~/.openclaw/data/pm-context/Projects/
  PM-API.md -> ~/.openclaw/data/pm-context/PM-API.md
```

Symlinks are idempotent -- existing correct symlinks are left in place, stale ones are replaced, and real files/directories are never overwritten.

## Context scheduling

**File:** `src/lib/server/pm/context-scheduler.ts`

Two regeneration triggers:

### Debounced (event-driven)

`onPMEvent` subscriptions fire on any PM mutation. The scheduler marks state as dirty and debounces regeneration with a 5-second delay:

```typescript
onPMEvent(() => {
	dirty = true;
	scheduleGeneration(); // 5s debounce
});
```

### Max staleness interval

A 60-second interval checks the dirty flag and regenerates if needed, ensuring context files are never more than ~65 seconds stale even if the debounce timer keeps resetting.

### Synchronous trigger

`triggerContextGeneration()` runs generation synchronously and is called directly by API route handlers after individual mutations. This ensures that when an agent or user creates/updates a project, the context files are immediately updated before the HTTP response returns.

```typescript
export function triggerContextGeneration(): { filesWritten: number; timestamp: number } {
	dirty = false;
	if (debounceTimer) clearTimeout(debounceTimer);
	return generateAndWriteContext();
}
```

## Workspace discovery

**File:** `src/lib/server/pm/workspace-discovery.ts`

Reads `~/.openclaw/openclaw.json` to find agent workspace paths:

1. Parse `agents.list[]` from the config
2. For each agent, use `agent.workspace` or fall back to `agents.defaults.workspace` or `~/.openclaw/workspace`
3. Deduplicate by workspace path
4. Return `{ name, workspace }[]`

If the config file does not exist or has no agents, returns a single default workspace entry.

## API routes

All PM routes are under `src/routes/api/pm/`:

| Route                             | Methods            | Purpose                                      |
| --------------------------------- | ------------------ | -------------------------------------------- |
| `domains/+server.ts`              | GET, POST          | List / create domains                        |
| `domains/[id]/+server.ts`         | GET, PATCH, DELETE | Get / update / delete domain                 |
| `domains/reorder/+server.ts`      | POST               | Reorder domains                              |
| `focuses/+server.ts`              | GET, POST          | List / create focuses                        |
| `focuses/[id]/+server.ts`         | GET, PATCH, DELETE | Get / update / delete focus                  |
| `focuses/[id]/move/+server.ts`    | POST               | Move focus to another domain                 |
| `focuses/reorder/+server.ts`      | POST               | Reorder focuses                              |
| `projects/+server.ts`             | GET, POST          | List / create projects                       |
| `projects/[id]/+server.ts`        | GET, PATCH, DELETE | Get / update / delete project                |
| `activities/+server.ts`           | GET                | List activities for a project                |
| `search/+server.ts`               | GET                | Full-text search                             |
| `stats/+server.ts`                | GET                | Dashboard statistics                         |
| `context/+server.ts`              | GET, POST          | Get dashboard context / trigger regeneration |
| `context/project/[id]/+server.ts` | GET                | Get project context                          |
| `context/domain/[id]/+server.ts`  | GET                | Get domain context                           |

All list endpoints return paginated responses: `{ items: [...], total, page, limit, hasMore }`.

Mutation endpoints (POST, PATCH, DELETE) call `triggerContextGeneration()` synchronously after the database operation, ensuring context files are up to date before the response is sent.

## Frontend flow

### Store layer

The PM stores in `src/lib/stores/` provide a reactive cache over the REST API:

1. `pm-store.ts` -- availability check (`checkPMAvailability()`), cache hydration (`hydratePMStores()`)
2. `pm-domains.ts` -- domain/focus CRUD
3. `pm-projects.ts` -- project CRUD, filtering, activity loading
4. `pm-operations.ts` -- higher-level operations (search, bulk updates)
5. `pm-api.ts` -- HTTP helpers (`pmGet`, `pmPost`, `pmPatch`, `pmDelete`)

### Component layer

The `/projects` page (`src/routes/projects/+page.svelte`) renders:

1. `ProjectList` -- dashboard with stats, filters, grouped project list
2. `ProjectDetail` -- modal overlay for individual projects (opened via `history.pushState`)

Navigation uses `history.pushState`/`popstate` for browser back support:

- Click project -> push state with `selectedProjectId`
- Browser back -> pop state, return to list
- Browser back from list -> exit `/projects`

### Agent writes

Agents interact with PM data by sending HTTP requests to `localhost:3000/api/pm/*`. The `PM-API.md` file symlinked into their workspace documents all available endpoints. A typical agent workflow:

```bash
# Create a project
curl -X POST http://localhost:3000/api/pm/projects \
  -H 'Content-Type: application/json' \
  -d '{"focus_id":"frontend","title":"Fix login bug","status":"in_progress"}'

# Update the project body with rich content
curl -X PATCH http://localhost:3000/api/pm/projects/1 \
  -H 'Content-Type: application/json' \
  -d '{"body":"## Investigation\n\nThe login form..."}'
```
