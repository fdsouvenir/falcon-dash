# PM API Design for falcon-dash

**Status:** Draft  
**Created:** 2026-02-07  
**Author:** Agent  

---

## 1. Approach Decision

### Options Considered

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **A. Agent Tool Calls** | Dashboard sends `chat.send` with prompts like "list my projects", agent invokes `pm` CLI, returns natural language | Zero new infrastructure; works today | Slow (full agent turn per request); non-deterministic response shape; burns tokens; can't build structured UI; no real-time; terrible UX for drag-and-drop or bulk ops |
| **B. Custom Gateway WS Methods** | Register `pm.*` methods in the Gateway protocol (new TypeBox schemas, new handlers) | First-class protocol citizen; type-safe; fast; deterministic | Requires Gateway code changes; tightly coupled to Gateway release cycle; PM is not a Gateway concern |
| **C. Skill/Plugin with WS Methods** | Build an OpenClaw skill that registers `pm.*` WS methods via the skill extension API | Clean separation; ships independently; uses existing plugin infra; type-safe; fast; deterministic | Needs skill WS registration API (exists but may need extension); one more moving part |

### Decision: **Hybrid — Direct SQLite Service + Gateway Skill Registration**

**Architecture:**

```
falcon-dash (browser)
    │
    │  WebSocket (pm.* methods)
    ▼
OpenClaw Gateway
    │
    │  routes pm.* to skill handler
    ▼
PM Skill (pm-skill)
    │
    │  direct SQLite access (better-sqlite3)
    ▼
SQLite Database (~/.config/fredbot/pm.db)
```

**Rationale:**

1. **Not agent tool calls.** The dashboard needs deterministic, structured JSON responses with sub-50ms latency. Agent turns take 2-15 seconds, cost tokens, and return unstructured text. Every click, drag, or filter change would trigger an LLM call. This is a non-starter for a real UI.

2. **Not raw Gateway protocol methods.** PM is a domain feature, not a gateway concern. Embedding it in the Gateway protocol would bloat the core and couple PM releases to Gateway releases.

3. **Skill with WS method registration** is the right abstraction. The skill:
   - Owns the SQLite database and all CRUD logic
   - Registers `pm.*` WebSocket methods that the Gateway routes to it
   - Exposes the same logic to the CLI (`pm` command) for agent use
   - Ships and updates independently of the Gateway

4. **The CLI and API share the same database layer.** The skill contains the SQLite access code. The CLI calls it in-process; the WS methods call it over the Gateway message bus. One source of truth, two interfaces.

5. **Context generation** (the AI-optimized markdown summaries) stays as a skill function callable by both CLI and a dedicated `pm.context` WS method, so the dashboard can render the same summaries the agent sees.

---

## 2. Method Naming Convention

All PM methods are namespaced under `pm.` and follow the pattern:

```
pm.<entity>.<action>
```

Entities: `domain`, `focus`, `milestone`, `project`, `task`, `comment`, `block`, `attachment`, `activity`  
Actions: `list`, `get`, `create`, `update`, `delete`, `move`, `reorder`

Special methods: `pm.context.*`, `pm.search`, `pm.bulk.*`, `pm.stats`

---

## 3. Common Conventions

### 3.1 Request Envelope

All requests follow the Gateway protocol:

```json
{
  "type": "req",
  "id": "<unique-request-id>",
  "method": "pm.project.list",
  "params": { ... }
}
```

Mutating methods (`create`, `update`, `delete`, `move`, `reorder`, `bulk.*`) require an `idempotencyKey` in params for safe retry.

### 3.2 Response Envelope

```json
{
  "type": "res",
  "id": "<matching-req-id>",
  "ok": true,
  "payload": { ... }
}
```

### 3.3 Pagination

All `list` methods support cursor-based pagination:

```typescript
// Request params
{
  limit?: number;       // default 50, max 200
  cursor?: string;      // opaque cursor from previous response
  sort?: string;        // field name, prefixed with - for descending
}

// Response payload always includes:
{
  items: T[];
  cursor?: string;      // null/absent if no more results
  total?: number;       // total count (only if countTotal=true in request)
}
```

**Sort fields** vary by entity. Default sort is specified per method below.

### 3.4 Timestamps

All timestamps in responses are **Unix epoch seconds** (integers), matching the SQLite schema. Clients convert for display.

### 3.5 ID Format

IDs in API requests/responses use **raw values** (integers for auto-PK entities, slugs for Domain/Focus). The display prefix (`P-`, `T-`, etc.) is a client-side concern.

However, for convenience, the API also **accepts** prefixed IDs and strips the prefix. So both `42` and `P-42` work for a project ID.

### 3.6 Actor

Mutating methods include an `actor` field:

```typescript
{
  actor?: string;  // "User", "Agent", custom name. Defaults to "User" for WS clients, "Agent" for CLI.
}
```

### 3.7 Error Codes

PM-specific error codes (in addition to Gateway standard errors):

| Code | Meaning |
|------|---------|
| `PM_NOT_FOUND` | Entity not found |
| `PM_CONSTRAINT` | Constraint violation (e.g., delete domain with focuses) |
| `PM_INVALID_PARENT` | Invalid parent reference (task without project or parent task) |
| `PM_CIRCULAR_BLOCK` | Block would create circular dependency |
| `PM_DUPLICATE` | Duplicate entity (e.g., domain slug already exists) |

---

## 4. Method Reference

### 4.1 Domain Methods

#### `pm.domain.list`

List all domains.

**Params:**
```typescript
{
  // No params — domains are a small, static set
}
```

**Response:**
```typescript
{
  items: Array<{
    id: string;              // slug: "personal"
    name: string;            // "Personal"
    description: string | null;
    focusCount: number;      // count of focuses in this domain
    projectCount: number;    // count of projects across all focuses
    created_at: number;
  }>;
}
```

No pagination needed — domains are expected to be < 20.

---

#### `pm.domain.get`

Get a single domain with its focuses.

**Params:**
```typescript
{
  id: string;               // domain slug
}
```

**Response:**
```typescript
{
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  focuses: Array<{
    id: string;
    name: string;
    description: string | null;
    projectCount: number;
  }>;
}
```

---

#### `pm.domain.create`

**Params:**
```typescript
{
  id: string;               // slug (lowercase, hyphens)
  name: string;             // display name
  description?: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Response:**
```typescript
{
  id: string;
  name: string;
  description: string | null;
  created_at: number;
}
```

---

#### `pm.domain.update`

**Params:**
```typescript
{
  id: string;               // domain slug
  name?: string;
  description?: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Response:** Same as `pm.domain.get`.

---

#### `pm.domain.delete`

**Params:**
```typescript
{
  id: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Response:**
```typescript
{ deleted: true }
```

**Error:** `PM_CONSTRAINT` if domain has focuses.

---

#### `pm.domain.reorder`

Set the display order of domains.

**Params:**
```typescript
{
  order: string[];          // domain IDs in desired order
  idempotencyKey: string;
}
```

**Response:**
```typescript
{ ok: true }
```

**Implementation note:** Requires a `sort_order` column on `domains` table (not in current schema — schema addendum below).

---

### 4.2 Focus Methods

#### `pm.focus.list`

**Params:**
```typescript
{
  domainId?: string;         // filter by domain
}
```

**Response:**
```typescript
{
  items: Array<{
    id: string;              // slug
    domainId: string;
    name: string;
    description: string | null;
    projectCount: number;
    created_at: number;
  }>;
}
```

No pagination — focuses are a small set (< 50).

---

#### `pm.focus.get`

**Params:**
```typescript
{
  id: string;
}
```

**Response:**
```typescript
{
  id: string;
  domainId: string;
  domainName: string;
  name: string;
  description: string | null;
  created_at: number;
  projects: Array<{
    id: number;
    title: string;
    status: string;
    priority: string | null;
    dueDate: string | null;
    taskCounts: { total: number; done: number };
  }>;
}
```

---

#### `pm.focus.create`

**Params:**
```typescript
{
  id: string;               // slug
  domainId: string;         // parent domain slug
  name: string;
  description?: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Response:** Created focus object.

---

#### `pm.focus.update`

**Params:**
```typescript
{
  id: string;
  name?: string;
  description?: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Response:** Updated focus object.

---

#### `pm.focus.move`

Move a focus to a different domain.

**Params:**
```typescript
{
  id: string;
  domainId: string;         // new parent domain
  actor?: string;
  idempotencyKey: string;
}
```

**Response:** Updated focus object.

---

#### `pm.focus.delete`

**Params:**
```typescript
{
  id: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Error:** `PM_CONSTRAINT` if focus has projects.

---

#### `pm.focus.reorder`

**Params:**
```typescript
{
  domainId: string;          // scope reorder to this domain
  order: string[];           // focus IDs in desired order
  idempotencyKey: string;
}
```

---

### 4.3 Milestone Methods

#### `pm.milestone.list`

**Params:**
```typescript
{
  includeCompleted?: boolean;  // default false — hides milestones where all items are done
  sort?: string;               // "due_date" (default), "-due_date", "name", "-name"
}
```

**Response:**
```typescript
{
  items: Array<{
    id: number;
    name: string;
    dueDate: string | null;
    description: string | null;
    projectCount: number;
    taskCount: number;
    completedCount: number;      // projects+tasks that are done
    created_at: number;
  }>;
}
```

---

#### `pm.milestone.get`

**Params:**
```typescript
{
  id: number;
}
```

**Response:**
```typescript
{
  id: number;
  name: string;
  dueDate: string | null;
  description: string | null;
  created_at: number;
  projects: Array<{
    id: number;
    title: string;
    status: string;
    focusId: string;
  }>;
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    projectId: number;
    projectTitle: string;
  }>;
}
```

---

#### `pm.milestone.create`

**Params:**
```typescript
{
  name: string;
  dueDate?: string;           // ISO date
  description?: string;
  actor?: string;
  idempotencyKey: string;
}
```

---

#### `pm.milestone.update`

**Params:**
```typescript
{
  id: number;
  name?: string;
  dueDate?: string | null;     // null to clear
  description?: string;
  actor?: string;
  idempotencyKey: string;
}
```

---

#### `pm.milestone.delete`

**Params:**
```typescript
{
  id: number;
  actor?: string;
  idempotencyKey: string;
}
```

**Behavior:** Linked projects/tasks have their `milestone_id` set to null (not deleted).

---

### 4.4 Project Methods

#### `pm.project.list`

**Params:**
```typescript
{
  // Filters
  status?: string | string[];     // single or array: "in_progress", ["todo", "in_progress"]
  priority?: string | string[];
  focusId?: string;
  domainId?: string;              // filters via focus → domain
  milestoneId?: number;
  dueBefore?: string;             // ISO date — projects due on or before this date
  dueAfter?: string;              // ISO date — projects due on or after this date
  overdue?: boolean;              // true = due_date < today AND status not done/cancelled
  search?: string;                // full-text search on title + description

  // Pagination & sort
  limit?: number;                 // default 50
  cursor?: string;
  sort?: string;                  // "updated_at" (default desc), "created_at", "due_date", "title", "priority", "last_activity_at", "status"
  countTotal?: boolean;           // include total count in response
}
```

**Response:**
```typescript
{
  items: Array<{
    id: number;
    focusId: string;
    focusName: string;
    domainId: string;
    domainName: string;
    title: string;
    description: string | null;
    status: string;
    milestoneId: number | null;
    milestoneName: string | null;
    dueDate: string | null;
    priority: string | null;
    externalRef: string | null;
    taskCounts: {
      total: number;
      todo: number;
      inProgress: number;
      done: number;
      blocked: number;
    };
    created_at: number;
    updated_at: number;
    last_activity_at: number;
  }>;
  cursor?: string;
  total?: number;
}
```

**Default sort:** `-last_activity_at` (most recently active first).

---

#### `pm.project.get`

**Params:**
```typescript
{
  id: number;
  includeTasks?: boolean;        // default true — include task tree
  includeComments?: boolean;     // default true
  includeActivity?: boolean;     // default false
  includeAttachments?: boolean;  // default true
  activityLimit?: number;        // default 20 (most recent)
  taskDepth?: number;            // max subtask nesting depth, default unlimited
}
```

**Response:**
```typescript
{
  id: number;
  focusId: string;
  focusName: string;
  domainId: string;
  domainName: string;
  title: string;
  description: string | null;
  status: string;
  milestoneId: number | null;
  milestoneName: string | null;
  dueDate: string | null;
  priority: string | null;
  externalRef: string | null;
  created_at: number;
  updated_at: number;
  last_activity_at: number;

  tasks?: Array<TaskNode>;       // tree structure (see below)
  comments?: Array<{
    id: number;
    body: string;
    author: string;
    created_at: number;
  }>;
  attachments?: Array<{
    id: number;
    filePath: string;
    fileName: string;
    description: string | null;
    addedBy: string;
    created_at: number;
  }>;
  activity?: Array<{
    id: number;
    actor: string;
    action: string;
    targetType: string;
    targetId: number;
    targetTitle: string | null;
    details: any | null;         // parsed JSON
    created_at: number;
  }>;
  blocks?: {
    blocking: Array<{ taskId: number; taskTitle: string }>;   // tasks this project's tasks block
    blockedBy: Array<{ taskId: number; taskTitle: string }>;  // tasks blocking this project's tasks
  };
}
```

**TaskNode** (recursive tree):
```typescript
interface TaskNode {
  id: number;
  title: string;
  body: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  milestoneId: number | null;
  externalRef: string | null;
  created_at: number;
  updated_at: number;
  commentCount: number;
  attachmentCount: number;
  isBlocked: boolean;
  children: TaskNode[];          // subtasks, recursively
}
```

---

#### `pm.project.create`

**Params:**
```typescript
{
  focusId: string;               // required
  title: string;                 // required
  description?: string;
  status?: string;               // default "todo"
  priority?: string;             // default "normal"
  dueDate?: string;
  milestoneId?: number;
  externalRef?: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Response:** Full project object (same as `pm.project.get` with no includes).

**Side effects:** Creates activity entry.

---

#### `pm.project.update`

**Params:**
```typescript
{
  id: number;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;       // null to clear
  milestoneId?: number | null;   // null to clear
  focusId?: string;              // move to different focus
  externalRef?: string | null;
  actor?: string;
  idempotencyKey: string;
}
```

**Response:** Updated project object.

**Side effects:** Creates activity entry (type depends on what changed — `status_changed` if status changed, `updated` otherwise).

---

#### `pm.project.delete`

**Params:**
```typescript
{
  id: number;
  actor?: string;
  idempotencyKey: string;
}
```

**Behavior:** Cascading delete — removes all tasks, comments, attachments, activities, blocks associated with this project.

**Response:**
```typescript
{ deleted: true, tasksDeleted: number, commentsDeleted: number }
```

---

### 4.5 Task Methods

#### `pm.task.list`

**Params:**
```typescript
{
  // Filters
  projectId?: number;            // tasks in this project (direct children only unless recursive=true)
  parentTaskId?: number;         // subtasks of this task
  recursive?: boolean;           // default false — if true, returns full subtree flattened
  status?: string | string[];
  priority?: string | string[];
  milestoneId?: number;
  dueBefore?: string;
  dueAfter?: string;
  overdue?: boolean;
  blocked?: boolean;             // true = only blocked tasks, false = only unblocked
  search?: string;               // full-text search on title + body

  // Pagination & sort
  limit?: number;
  cursor?: string;
  sort?: string;                 // "created_at" (default), "updated_at", "due_date", "title", "priority", "status"
  countTotal?: boolean;
}
```

**Response:**
```typescript
{
  items: Array<{
    id: number;
    parentProjectId: number | null;
    parentTaskId: number | null;
    projectId: number;            // resolved — always the root project ID
    projectTitle: string;
    title: string;
    body: string | null;
    status: string;
    priority: string | null;
    dueDate: string | null;
    milestoneId: number | null;
    externalRef: string | null;
    depth: number;                // 0 = direct child of project, 1 = subtask, etc.
    childCount: number;           // number of direct subtasks
    commentCount: number;
    attachmentCount: number;
    isBlocked: boolean;
    blockedBy: number[];          // task IDs blocking this task
    created_at: number;
    updated_at: number;
    last_activity_at: number;
  }>;
  cursor?: string;
  total?: number;
}
```

---

#### `pm.task.get`

**Params:**
```typescript
{
  id: number;
  includeSubtasks?: boolean;     // default true (tree)
  includeComments?: boolean;     // default true
  includeAttachments?: boolean;  // default true
  subtaskDepth?: number;         // max depth, default unlimited
}
```

**Response:**
```typescript
{
  id: number;
  parentProjectId: number | null;
  parentTaskId: number | null;
  projectId: number;              // resolved root project
  projectTitle: string;
  title: string;
  body: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  milestoneId: number | null;
  milestoneName: string | null;
  externalRef: string | null;
  created_at: number;
  updated_at: number;
  last_activity_at: number;

  // Ancestry (for breadcrumbs)
  ancestors: Array<{
    type: "project" | "task";
    id: number;
    title: string;
  }>;

  subtasks?: TaskNode[];
  comments?: Array<{
    id: number;
    body: string;
    author: string;
    created_at: number;
  }>;
  attachments?: Array<{
    id: number;
    filePath: string;
    fileName: string;
    description: string | null;
    addedBy: string;
    created_at: number;
  }>;
  blocks: {
    blocking: Array<{ id: number; title: string; status: string }>;
    blockedBy: Array<{ id: number; title: string; status: string }>;
  };
}
```

---

#### `pm.task.create`

**Params:**
```typescript
{
  // Exactly one of:
  projectId?: number;            // create as direct child of project
  parentTaskId?: number;         // create as subtask

  title: string;                 // required
  body?: string;
  status?: string;               // default "todo"
  priority?: string;
  dueDate?: string;
  milestoneId?: number;
  externalRef?: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Validation:** Exactly one of `projectId` or `parentTaskId` must be provided.

**Response:** Created task object.

**Side effects:** Activity entry on the root project.

---

#### `pm.task.update`

**Params:**
```typescript
{
  id: number;
  title?: string;
  body?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  milestoneId?: number | null;
  externalRef?: string | null;
  actor?: string;
  idempotencyKey: string;
}
```

**Response:** Updated task object.

**Side effects:** Activity entry. If status changed to `done`, check if parent project/task should cascade status.

---

#### `pm.task.move`

Move a task to a different parent (project or task).

**Params:**
```typescript
{
  id: number;
  // Exactly one of:
  projectId?: number;            // move to be direct child of project
  parentTaskId?: number;         // move to be subtask of another task

  actor?: string;
  idempotencyKey: string;
}
```

**Validation:** Cannot move a task to be a subtask of itself or its own descendants (circular).

---

#### `pm.task.reorder`

Set the display order of tasks within a parent.

**Params:**
```typescript
{
  // Scope — exactly one of:
  projectId?: number;            // reorder direct children of this project
  parentTaskId?: number;         // reorder subtasks of this task

  order: number[];               // task IDs in desired order
  idempotencyKey: string;
}
```

**Implementation note:** Requires a `sort_order` column on `tasks` table.

---

#### `pm.task.delete`

**Params:**
```typescript
{
  id: number;
  mode?: "cascade" | "promote";  // default "cascade"
  actor?: string;
  idempotencyKey: string;
}
```

- `cascade`: Delete task and all subtasks.
- `promote`: Delete task but move subtasks up to this task's parent.

---

### 4.6 Comment Methods

#### `pm.comment.list`

**Params:**
```typescript
{
  targetType: "project" | "task";
  targetId: number;
  limit?: number;                // default 50
  cursor?: string;
  sort?: string;                 // "created_at" (default asc), "-created_at"
}
```

**Response:**
```typescript
{
  items: Array<{
    id: number;
    targetType: string;
    targetId: number;
    body: string;
    author: string;
    created_at: number;
  }>;
  cursor?: string;
}
```

---

#### `pm.comment.create`

**Params:**
```typescript
{
  targetType: "project" | "task";
  targetId: number;
  body: string;                  // markdown
  author?: string;               // defaults to actor
  actor?: string;
  idempotencyKey: string;
}
```

**Side effects:** Activity entry. Updates `last_activity_at` on target and its project.

---

#### `pm.comment.update`

**Params:**
```typescript
{
  id: number;
  body: string;
  actor?: string;
  idempotencyKey: string;
}
```

---

#### `pm.comment.delete`

**Params:**
```typescript
{
  id: number;
  actor?: string;
  idempotencyKey: string;
}
```

---

### 4.7 Block (Dependency) Methods

#### `pm.block.list`

List all blocks, optionally filtered.

**Params:**
```typescript
{
  taskId?: number;               // blocks involving this task (as blocker OR blocked)
  projectId?: number;            // blocks involving tasks in this project
}
```

**Response:**
```typescript
{
  items: Array<{
    blockerId: number;
    blockerTitle: string;
    blockerStatus: string;
    blockedId: number;
    blockedTitle: string;
    blockedStatus: string;
  }>;
}
```

---

#### `pm.block.create`

**Params:**
```typescript
{
  blockerId: number;             // the task that blocks
  blockedId: number;             // the task that is blocked
  actor?: string;
  idempotencyKey: string;
}
```

**Validation:** Check for circular dependencies. `PM_CIRCULAR_BLOCK` if adding this block would create a cycle.

---

#### `pm.block.delete`

**Params:**
```typescript
{
  blockerId: number;
  blockedId: number;
  actor?: string;
  idempotencyKey: string;
}
```

---

### 4.8 Attachment Methods

#### `pm.attachment.list`

**Params:**
```typescript
{
  targetType: "project" | "task";
  targetId: number;
}
```

**Response:**
```typescript
{
  items: Array<{
    id: number;
    targetType: string;
    targetId: number;
    filePath: string;
    fileName: string;
    description: string | null;
    addedBy: string;
    created_at: number;
  }>;
}
```

---

#### `pm.attachment.create`

**Params:**
```typescript
{
  targetType: "project" | "task";
  targetId: number;
  filePath: string;
  fileName: string;
  description?: string;
  actor?: string;
  idempotencyKey: string;
}
```

**Note:** Attachments are file path references, not file uploads. The file must exist on the host filesystem.

---

#### `pm.attachment.delete`

**Params:**
```typescript
{
  id: number;
  actor?: string;
  idempotencyKey: string;
}
```

---

### 4.9 Activity Methods

#### `pm.activity.list`

**Params:**
```typescript
{
  // Filters
  projectId?: number;            // scope to project
  actor?: string;                // filter by actor
  action?: string | string[];    // filter by action type
  targetType?: string;           // filter by target type
  since?: number;                // unix timestamp — activity after this time
  before?: number;               // unix timestamp — activity before this time

  // Pagination
  limit?: number;                // default 50
  cursor?: string;
  sort?: string;                 // "-created_at" (default, newest first)
}
```

**Response:**
```typescript
{
  items: Array<{
    id: number;
    projectId: number;
    projectTitle: string;
    actor: string;
    action: string;
    targetType: string;
    targetId: number;
    targetTitle: string | null;
    details: any | null;
    created_at: number;
  }>;
  cursor?: string;
}
```

---

### 4.10 Context Methods (AI-Optimized Summaries)

These methods return the same markdown context the agent uses, enabling the dashboard to render "AI View" panels or provide context to embedded chat.

#### `pm.context.dashboard`

**Params:**
```typescript
{
  dueDays?: number;              // default 7 — "due soon" window
  activityLimit?: number;        // default 10
}
```

**Response:**
```typescript
{
  markdown: string;              // the full markdown context (~1-2k tokens)
  generated_at: number;
  stats: {
    activeProjects: number;
    dueSoon: number;
    blocked: number;
    overdue: number;
  };
}
```

---

#### `pm.context.domain`

**Params:**
```typescript
{
  domainId: string;
}
```

**Response:**
```typescript
{
  markdown: string;              // domain context (~3-5k tokens)
  generated_at: number;
}
```

---

#### `pm.context.project`

**Params:**
```typescript
{
  projectId: number;
}
```

**Response:**
```typescript
{
  markdown: string;              // full project context (~5-10k tokens)
  generated_at: number;
}
```

---

### 4.11 Search

#### `pm.search`

Global search across all entities.

**Params:**
```typescript
{
  query: string;                 // search term
  types?: string[];              // entity types to search: ["project", "task", "comment"]. Default: all.
  status?: string[];             // filter by status (for projects/tasks)
  limit?: number;                // default 20
}
```

**Response:**
```typescript
{
  items: Array<{
    type: "project" | "task" | "comment";
    id: number;
    title: string;               // project/task title, or comment excerpt
    status?: string;             // for project/task
    projectId: number;           // resolved root project
    projectTitle: string;
    matchContext: string;         // snippet showing where the match occurred
    score: number;               // relevance score
  }>;
}
```

**Implementation:** SQLite FTS5 virtual table on project titles+descriptions, task titles+bodies, comment bodies.

---

### 4.12 Bulk Operations

#### `pm.bulk.update`

**Params:**
```typescript
{
  targets: Array<{
    type: "project" | "task";
    id: number;
  }>;
  fields: {
    status?: string;
    priority?: string;
    milestoneId?: number | null;
    dueDate?: string | null;
  };
  actor?: string;
  idempotencyKey: string;
}
```

**Response:**
```typescript
{
  updated: number;               // count of updated entities
  errors: Array<{               // any individual failures
    type: string;
    id: number;
    error: string;
  }>;
}
```

---

#### `pm.bulk.move`

Move multiple tasks to a new parent.

**Params:**
```typescript
{
  taskIds: number[];
  // Exactly one of:
  projectId?: number;
  parentTaskId?: number;

  actor?: string;
  idempotencyKey: string;
}
```

---

### 4.13 Stats / Dashboard Aggregates

#### `pm.stats`

Quick aggregate stats for the dashboard header.

**Params:**
```typescript
{
  // No params
}
```

**Response:**
```typescript
{
  projects: {
    total: number;
    byStatus: Record<string, number>;  // { "todo": 5, "in_progress": 3, ... }
  };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    blocked: number;
    overdue: number;
  };
  recentActivity: number;         // activity count in last 24h
  dueSoon: number;                // items due in next 7 days
}
```

---

## 5. Real-Time Events

When any PM entity is mutated via the API, the skill broadcasts a PM event to all connected operator clients. This enables real-time UI updates without polling.

### Event Format

```json
{
  "type": "event",
  "event": "pm",
  "payload": {
    "action": "created" | "updated" | "deleted" | "moved" | "reordered",
    "entityType": "domain" | "focus" | "milestone" | "project" | "task" | "comment" | "block" | "attachment",
    "entityId": "<id>",
    "projectId": "<root-project-id or null>",
    "actor": "User",
    "data": { ... },
    "timestamp": 1707350400
  },
  "stateVersion": 42
}
```

**`data` content varies by action:**

| Action | Data |
|--------|------|
| `created` | The full created entity |
| `updated` | `{ fields: { status: { old: "todo", new: "in_progress" }, ... } }` — only changed fields |
| `deleted` | `{ id: <id> }` |
| `moved` | `{ oldParent: { type, id }, newParent: { type, id } }` |
| `reordered` | `{ parentType, parentId, order: [id, id, ...] }` |

**`stateVersion`** increments monotonically. Clients use it to detect missed events — if `stateVersion` jumps by more than 1, the client should refetch the affected entities.

### Subscription

All operator clients receive PM events automatically (no explicit subscription). This mirrors how `presence` and `health` events work in the Gateway protocol.

---

## 6. Schema Addendum

The current SQLite schema needs these additions to support the API:

```sql
-- Add sort_order to domains, focuses, tasks for drag-and-drop reorder
ALTER TABLE domains ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE focuses ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0;

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE pm_search USING fts5(
  entity_type,          -- 'project', 'task', 'comment'
  entity_id UNINDEXED,  -- reference to source row
  project_id UNINDEXED, -- resolved root project ID
  title,                -- project/task title
  body,                 -- description/body/comment text
  content='',           -- external content (we manage sync)
  tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER projects_ai AFTER INSERT ON projects BEGIN
  INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
  VALUES ('project', NEW.id, NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;

CREATE TRIGGER projects_au AFTER UPDATE OF title, description ON projects BEGIN
  DELETE FROM pm_search WHERE entity_type = 'project' AND entity_id = OLD.id;
  INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
  VALUES ('project', NEW.id, NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;

CREATE TRIGGER projects_ad AFTER DELETE ON projects BEGIN
  DELETE FROM pm_search WHERE entity_type = 'project' AND entity_id = OLD.id;
END;

-- Similar triggers for tasks and comments (omitted for brevity but same pattern)
```

---

## 7. Implementation Plan

### Phase 1: Core Data Layer
- Implement SQLite access module with better-sqlite3
- CRUD operations for all entities
- Activity auto-logging
- FTS5 search indexing

### Phase 2: WS Method Registration
- Register all `pm.*` methods with the Gateway via skill extension API
- Request/response validation with TypeBox schemas
- Error handling and PM-specific error codes

### Phase 3: Real-Time Events
- Broadcast `pm` events on mutations
- stateVersion tracking

### Phase 4: Context Generation
- Port context generator from CLI spec to shared module
- Expose via `pm.context.*` methods

### Phase 5: Advanced Features
- Bulk operations
- Full-text search
- Stats aggregates

---

## 8. Client Integration Notes (for falcon-dash)

### State Management

The dashboard should maintain a local cache of PM data, updated via:
1. **Initial load:** `pm.project.list`, `pm.stats`, etc. on module mount
2. **Real-time updates:** `pm` events update the cache incrementally
3. **Stale detection:** If `stateVersion` gap detected, refetch affected entities
4. **Optimistic updates:** Apply mutations locally before server confirms, rollback on error

### Recommended Load Sequence

```
1. pm.stats                    → populate dashboard header
2. pm.domain.list              → populate sidebar navigation
3. pm.project.list (active)    → populate main project list
4. (on project click)
   pm.project.get              → populate project detail view
5. (on search)
   pm.search                   → populate search results
```

### Kanban View

The Kanban board groups projects or tasks by status. Use:
- `pm.project.list` or `pm.task.list` with no status filter
- Group client-side by status
- Drag-and-drop calls `pm.project.update` / `pm.task.update` with new status
- Or `pm.task.move` + `pm.task.reorder` for cross-column + position changes

### Tree View

Use `pm.domain.list` → `pm.focus.list` → `pm.project.list` to build the hierarchy. Task trees come from `pm.project.get` which returns the recursive `TaskNode` tree.

### Context Panel

The dashboard can include an "AI Context" panel showing what the agent sees:
- Call `pm.context.dashboard` for the overview
- Call `pm.context.project` when viewing a project
- Render the markdown in a styled panel

This helps the user understand what the agent knows and verify context quality.
