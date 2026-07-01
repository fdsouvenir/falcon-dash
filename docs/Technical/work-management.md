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
- `milestone` — progress marker or checkpoint
- `next_step` — concrete action, usually starting with a verb
- `open_question` — unresolved knowledge with answerer, impact, and optional blocker
- `decision` — unresolved commitment with options, recommendation, and no-decision consequence
- `change_request` — controlled mutation of code, config, systems, data, auth, deployment, or automation
- `finding` — captured fact, discovery, source-backed note, or evidence summary
- `automation` — recurring or triggered work backed by cron, heartbeat, webhook, or manual runs

Evidence is attached as provenance through `work_evidence_refs`. Findings may summarize evidence,
but evidence refs remain provenance rather than standalone work.

Categories and subcategories organize Work without being Work items. They live in `work_areas`
internally and are exposed through `/api/work/categories` using the user-facing
`category`/`subcategory` vocabulary. The Work UI keeps this setup in `/work/settings` behind the
settings gear instead of putting categories in the primary Work navigation.

## ID Reference Convention

Work item IDs are not a user-facing taxonomy. Human/operator-facing references should use the
object type plus ID, such as `Change Request 176`, `Project 4`, `Automation 12`, or `Decision 9`.
API and debug contexts may use raw `id` fields. Avoid using `W-{id}` as a blanket name for all Work
objects; the `W-` prefix is reserved for generated context filenames where collision-proof file
names are useful.

## Server Modules

Work server code lives in `src/lib/server/work/`:

- `database.ts` — Work database pathing, schema, and readonly archived-source opener
- `crud.ts` — Work categories/items/queue/evidence/activity helpers
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
depend on child work context.

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
- `Work/W-{id}.md` — active Work project, question, decision, change request, automation, and finding details
- `WORK-API.md` — Work API reference
- `FALCON-DASH.md` — Falcon Dash plugin/module context

The default context directory is:

```text
~/.openclaw/data/falcon-dash/context
```

Override it with `FALCON_DASH_WORK_CONTEXT_DIR`.

## Migration

Migration reads the archived PM database as an external read-only source and writes into the Work
database. The old PM database is not modified and remains on disk as fallback source material.

Mapping rules:

- category -> Work category record
- subcategory -> child Work subcategory record
- project -> Work `project`
- plan -> Work `change_request`, `next_step`, `open_question`, `decision`, or `automation` based on status/title/body classifier
- plan dependency -> Work `depends_on` relationship
- plan version -> preserved in the migrated Work item body
- activity -> Work `finding` plus evidence ref

Migration preview includes counts, warnings, and a self-review block before apply.
