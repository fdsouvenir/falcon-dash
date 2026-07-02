# Work Management

Work Management is Falcon Dash's only active work system. It replaced the old PM model for
agent-visible work, plans, approvals, automations, and operator queue context. Work v2 uses
conversational object names instead of implementation workflow nouns.

## Storage

Work uses its own SQLite database:

```text
~/.openclaw/data/falcon-dash/work.db
```

The path can be overridden with `FALCON_DASH_WORK_DATABASE_PATH`. The archived source database remains
on disk only as static migration input and is opened read-only through
`FALCON_DASH_ARCHIVED_WORK_SOURCE_DATABASE_PATH` when a migration preview/apply is requested.

## Object Model

- `project` — bounded outcome with goal, health, timeline, and attached work
- `milestone` — short project-local progress checkpoint; milestones are created and shown inside
  a project rather than browsed as standalone Work pages
- `task` — concrete action, usually starting with a verb
- Needs Resolution — operator-facing queue for unresolved knowledge and unresolved commitments
  - `open_question` — API/storage variant for missing knowledge, answerer, impact, and optional blocker
  - `decision` — API/storage variant for a commitment, options, recommendation, and no-decision consequence
- `change_request` — controlled mutation of code, config, systems, data, auth, deployment, or automation
- `finding` — captured fact, discovery, source-backed note, or evidence summary
- `automation` — recurring or triggered work backed by cron, heartbeat, webhook, or manual runs

Evidence is attached as provenance through `work_evidence_refs`. Findings may summarize evidence,
but evidence refs remain provenance rather than standalone work.

The UI and operator conversation present `open_question` and `decision` together as Needs
Resolution. They remain separate API/storage variants because unanswered knowledge and unmade
commitments validate and route differently, but agents should treat Needs Resolution as the public
Work concept.

Blocker links are Work-owned relationship records in `work_blocker_links`. They connect the stuck
Work item to either another Work item or an external person/system/source, with a reason, unblock
move, status, and timestamps. These links add visible relationship context without replacing the
blocked or waiting statuses on Work items.

Projects expose the current actionable move through `current_next_item_id`, a pointer to an active
task, Needs Resolution variant, or change request in that project. A project is treated as blocked
only when that pointed item is blocked/waiting or has an active blocker link; later blocked tasks
remain visible in the plan without making the whole project blocked. Tasks do not own child tasks
or next-step records; work that needs sequencing should become a project or be split into project
tasks.

Categories and subcategories organize Work without being Work items. They live in `work_areas`
internally and are exposed through `/api/work/categories` using the user-facing
`category`/`subcategory` vocabulary. The Work UI keeps this setup in `/work/settings` behind the
settings gear instead of putting categories in the primary Work navigation. Settings renders a
clean grouped directory; top-level category creation, nested subcategory creation, edits, and
deletes happen in the contextual drawer. Deleting a category or subcategory removes it from the
directory and unassigns linked Work items instead of archiving the category record.

## ID Reference Convention

Work item IDs are not a user-facing taxonomy. Human/operator-facing references should use the
object type plus ID, such as `Change Request 176`, `Project 4`, `Automation 12`, or
`Needs Resolution 9`.
API and debug contexts may use raw `id` fields. Avoid using `W-{id}` as a blanket name for all Work
objects; the `W-` prefix is reserved for generated context filenames where collision-proof file
names are useful.

When `ORIGIN` is configured with a public dashboard FQDN, generated agent instructions should link
specific Work objects inline, such as `[Project 4]({public-origin}/work/projects/4)`. Do not use
`localhost`, `127.0.0.1`, or relative paths for operator-facing object links. If no public origin is
available, generated guidance omits public URLs and agents should use plain references such as
`Project 4`.

## Server Modules

Work server code lives in `src/lib/server/work/`:

- `database.ts` — Work database pathing, schema, and readonly archived-source opener
- `crud.ts` — Work categories/items/queue/evidence/change-log helpers
- `migration.ts` — archived PM preview/apply migration into Work
- `context.ts` — Work Queue markdown generation
- `context-writer.ts` — generated Work context files and workspace symlinks
- `context-scheduler.ts` — debounced Work context regeneration after Work mutations
- `module.ts` — Falcon Dash internal module metadata
- `index.ts` — exports

## API

Primary agent contract:

```text
GET    /api/work/queue
GET    /api/work/items
POST   /api/work/items
GET    /api/work/items/{id}
PATCH  /api/work/items/{id}
GET    /api/work/categories
POST   /api/work/categories
GET    /api/work/categories/{id}
PATCH  /api/work/categories/{id}
DELETE /api/work/categories/{id}
GET    /api/work/blockers
POST   /api/work/blockers
GET    /api/work/blockers/{id}
PATCH  /api/work/blockers/{id}
DELETE /api/work/blockers/{id}
GET    /api/work/change-log
GET    /api/work/context
GET    /api/work/migration/preview
POST   /api/work/migration/apply
GET    /api/falcon-dash/modules
```

There is no active PM API. Old PM routes and stores have been removed from the repo.

`GET /api/work/items` supports `type`, `status`, `category_id`, `subcategory_id`, legacy
`area_id`, `parent_item_id`, `includeClosed=true`, and `limit` filters. Detail-oriented UI uses
`parent_item_id` to load related child and sibling work without hydrating the whole Work database.
The Projects list intentionally hydrates Work items broadly because project filters and summaries
depend on child work context. Milestones remain valid API records for project structure, but the
Work UI does not expose `/work/milestones` as a standalone list or detail surface.

`GET /api/work/change-log` returns the Work-owned mutation log. It supports `project_id`,
`entity_type`, `entity_id`, `area_id`, and `limit` filters. Each row records the changed entity,
its project/category/parent scope at the time of the event, a human summary, and structured
`changes` entries with field labels plus before/after values. Project and overview activity feeds
read this change log instead of inferring activity from `last_activity_at`; existing databases get
baseline backfilled “Added to Work history” events so feeds remain populated without inventing old
field-level diffs.

`GET /api/work/blockers` returns explicit blocker relationships and supports `project_id`,
`blocked_item_id`, `blocker_item_id`, `state=active|resolved|all`, and `limit`. `POST` creates a
link with `blocked_item_id`, `blocker_source`, and either `blocker_item_id` for `work_item`
blockers or `external_label` for `person`, `system`, and `external` blockers. `PATCH` updates
reason, unblock action, label, status, and project scope; `DELETE` removes the link. Work backfills
links from `open_question.blocked_item_id` and from blocked/waiting items with `waiting_on`, while
preventing duplicate active relationships.

`GET /api/work/queue` returns actionability buckets:

- `nextActions`
- `needsOperator`
- `waitingOnOperator`
- `waitingOnAgent`
- `waitingOnExternal`
- `needsReview`
- `failedAutomations`
- `scheduledAutomations`
- `staleCleanup`
- `blockedRisky`

## Context Generation

`src/lib/server/work/context-writer.ts` writes Work-owned context:

- `WORK.md` — Work Queue
- `Work/W-{id}.md` — active Work project, Needs Resolution, change request, automation, and finding details
- `WORK-API.md` — Work API reference
- `FALCON-DASH.md` — Falcon Dash plugin/module context

The default context directory is:

```text
~/.openclaw/data/falcon-dash/context
```

Override it with `FALCON_DASH_WORK_CONTEXT_DIR`.

`ORIGIN` is the source of truth for public operator links. When set to a public origin, the writer
normalizes trailing slashes, writes `Public dashboard URL: {ORIGIN}` into `FALCON-DASH.md`, writes
public object URLs into `Work/W-{id}.md`, and teaches `WORK-API.md` to use inline Markdown links in
operator-facing messages. Local origins such as `localhost` and `127.0.0.1` are ignored for public
object links; missing or local origins produce plain object references only.

For local UI review, `npm run seed:work` seeds the running dev server with stable `Dev:` Work
records across projects, tasks, Needs Resolution variants, change requests, automations, findings, and
the Personal/Work/Condo category tree. Run `npm run seed:work -- --force` to archive and recreate
only those `Dev:` records.

Work item reads join only the detail table that matches the row's `type`. This prevents stale
type-detail rows left behind by old local development data from leaking project fields onto tasks
or other item types.

## Migration

Migration reads the archived PM database as an external read-only source and writes into the Work
database. The old PM database is not modified and remains on disk as fallback source material.

Mapping rules:

- category -> Work category record
- subcategory -> child Work subcategory record
- project -> Work `project`
- plan -> Work `change_request`, `task`, Needs Resolution variant, or `automation` based on status/title/body classifier
- plan dependency -> Work `depends_on` relationship
- plan version -> preserved in the migrated Work item body
- activity -> Work `finding` plus evidence ref

Migration preview includes counts, warnings, and a self-review block before apply.
