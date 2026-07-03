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
- `reconciliation.ts` — mechanical Work integrity propagation, agent steward packets, run history,
  and contextual agent sessions
- `reconciliation-scheduler.ts` — debounced per-project reconciliation after Work mutations plus
  periodic stale-risk sweep
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
GET    /api/work/items/{id}/relationships
POST   /api/work/items/{id}/relationships
DELETE /api/work/items/{id}/relationships
GET    /api/work/items/{id}/reconciliation
POST   /api/work/items/{id}/session
POST   /api/work/reconcile
GET    /api/work/context
GET    /api/work/migration/preview
POST   /api/work/migration/apply
GET    /api/falcon-dash/modules
```

There is no active PM API. Old PM routes and stores have been removed from the repo.

`GET /api/work/items` supports `type`, `status`, `area_id`, `parent_item_id`,
`includeClosed=true`, and `limit` filters. Detail-oriented UI uses `parent_item_id` to load related
child and sibling work without hydrating the whole Work database. The Projects list intentionally
hydrates Work items broadly because project filters and summaries depend on child work context.

`GET /api/work/queue` returns actionability buckets:

- `nextActions`
- `needsOperator`
- `waitingOnOperator`
- `waitingOnAgent`
- `waitingOnExternal`
- `needsReview`
- `scheduledRoutines`
- `staleCleanup`
- `blockedRisky`

`waitingOnFred` is still returned as a legacy alias for older callers, but new UI, docs, and
generated context should use operator-focused bucket names.

## Work Integrity

Falcon Dash runs a Work integrity loop after item, evidence, and relationship mutations. The agent
is the project steward; deterministic code is only the mechanical integrity layer. The loop
coalesces by root project, ignores writes from actor `work-reconciler`, and records every pass in
`work_reconciliation_runs`.

The mechanical pass is graph-first:

- `depends_on` means `from_item_id` waits for `to_item_id`
- `blocks` means `from_item_id` blocks `to_item_id`
- closed blockers/dependencies can clear `blocked` or `waiting` only when that blocked state has an
  explicit incoming `depends_on` or `blocks` relationship
- decisions, project `next_action`, evidence interpretation, and narrative cleanup are agent-owned
  semantic work

If stale-risk remains, Falcon Dash opens or reuses a contextual `fd-chat` agent session. The agent
receives an AXI-style packet: live Work first, minimal fields, explicit `0 results` empty buckets,
precomputed counts, truncated long text with size hints, evidence refs, recent activity, stale-risk
candidates, mechanical changes already applied, and concrete `/api/work/*` next-command templates.
The agent is instructed to update Work through `/api/work/*`; a prose-only reply is not considered
reconciliation. If the gateway is unavailable, the run remains `needs_agent` with the failure
recorded.

A periodic sweep scans active projects for stale-risk signals and routes them into the same agent
steward path. It does not perform semantic cleanup itself, and it respects per-project cooldowns,
one active reconciliation session per root project, and a max-projects-per-sweep cap.

## Context Generation

`src/lib/server/work/context-writer.ts` writes Work-owned context:

- `WORK.md` — compact Work home view with generated timestamp, active counts, queue bucket
  counts, definitive `0 results` empty states, capped bucket rows, detail-file links, and concrete
  next-command templates
- `Work/W-{id}.md` — active Work item details with type-plus-ID heading, metadata, full item
  content, and item-specific update templates
- `WORK-API.md` — Work API reference with filter defaults, mutation examples, and context contract
- `FALCON-DASH.md` — Falcon Dash plugin/module context and generated context directory hint

The generated context follows an agent-ergonomic pattern: default reads should be small and
actionable, full detail is one file or API call away, and empty buckets should say `0 results`
instead of disappearing. Human-facing references still use object type plus ID (`Change 176`);
`W-{id}` is only the generated filename.

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
