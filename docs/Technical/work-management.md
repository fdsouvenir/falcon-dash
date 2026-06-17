# Work Management

Work Management is Falcon Dash's only active work system. It replaced the old
Category/Subcategory/Project/Plan model for agent-visible work, plans, approvals, routines, and
operator queue context.

## Storage

Work uses its own SQLite database:

```text
~/.openclaw/data/falcon-dash/work.db
```

The path can be overridden with `FALCON_DASH_WORK_DATABASE_PATH`. The archived source database remains
on disk only as static migration input and is opened read-only through
`FALCON_DASH_ARCHIVED_WORK_SOURCE_DATABASE_PATH` when a migration preview/apply is requested.

## Object Model

- `area` — evergreen responsibility bucket
- `project` — bounded outcome with a finish line
- `task` — concrete next action
- `decision` — approval/review/judgment point
- `routine` — standing operator loop with cadence/run history
- `observation` — captured event or finding
- `change` — bounded approval/execution unit for code/config/migration/deploy/system work

Evidence is attached as provenance through `work_evidence_refs`; evidence is not standalone work.

## ID Reference Convention

Work item IDs are not a user-facing taxonomy. Human/operator-facing references should use the
object type plus ID, such as `Change 176`, `Project 4`, `Routine 12`, or `Decision 9`. API and
debug contexts may use raw `id` fields. Avoid using `W-{id}` as a blanket name for all Work
objects; the `W-` prefix is reserved for generated context filenames where collision-proof file
names are useful.

## Server Modules

Work server code lives in `src/lib/server/work/`:

- `database.ts` — Work database pathing, schema, and readonly archived-source opener
- `crud.ts` — Work areas/items/queue/evidence/activity helpers
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
GET    /api/work/context
GET    /api/work/migration/preview
POST   /api/work/migration/apply
GET    /api/falcon-dash/modules
```

There is no active PM API. Old PM routes and stores have been removed from the repo.

## Context Generation

`src/lib/server/work/context-writer.ts` writes Work-owned context:

- `WORK.md` — Work Queue
- `Work/W-{id}.md` — active Work project/change/task/decision/routine details
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

- category -> Work area `area:category:{id}`
- subcategory -> child Work area `area:subcategory:{id}`
- project -> Work `project`
- plan -> Work `change`, `task`, `decision`, or `routine` based on status/title/body classifier
- plan dependency -> Work `depends_on` relationship
- plan version -> preserved in the migrated Work item body
- activity -> Work observation plus evidence ref

Migration preview includes counts, warnings, and a self-review block before apply.
