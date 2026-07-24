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
directory and unassigns linked Work items instead of archiving the category record. Item updates
preserve the difference between an omitted category field and an explicit `null`, so selecting
“None” reliably clears an assignment.

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

## Work v3 Operator UI

The Work v3 route shell exposes the Work overview, Projects, Needs Resolution, Automations, and Browse.
Detail routes issue semantic commands through a shared manifest-driven form; they never patch
lifecycle fields directly. Structured command failures preserve submitted values, date/time form
values are normalized to epoch milliseconds at the UI adapter boundary, and nullable fields use
an explicit clear value rather than treating an empty string as a mutation.

The client may format server projections, but it must not rederive lifecycle, health,
actionability, Authorization effectiveness, or reconciliation state. Reviews and Authorizations
remain visually and semantically distinct.

`src/lib/work3/focus.ts` is the shared operator-focus taxonomy. Each definition names either a
reader-known filter or a predicate over list-projection fields, and `FocusChips` persists the
selection through `?focus=` while computing counts from the same bounded result. Task list rows
include `due_at`, waiting identity, and active-blocker summary/age. Project list rows include
`target_at` and `updated_at` alongside reader-derived health, progress, and current-next validity.
The `agent*`/`bot*` waiting-identity heuristic lives in `work3-shared/identity.ts` so Mission
Control and client focus predicates cannot drift.

Browse loads list projections for the selected type (or all supported searchable types), keeps
Project archives visible for the terminal disclosure, and applies only the shared focus taxonomy.
FTS snippets are parsed into text/highlight spans; no search result is rendered through raw HTML.
Needs Resolution carries exact submitted Plan revision IDs into Review forms and Change envelope
versions into Authorization forms. Its four sections post semantic commands to the owning object
route, except targetless Review creation, which is restricted to the resolution route.

At mobile width, the shared Command Bar replaces the desktop form grid with a sticky action bar.
Its bottom sheet renders exactly one selected manifest-driven form, preserves disabled-guard copy,
and automatically reopens the command associated with structured failed-form values.

Question, Decision, Change Request, Finding, and Task detail routes share the Work page header,
semantic status badges, command feedback, command bar, source references, and immutable timeline.
Decision outcomes are recorded through one accessible radio-card command form. Guarded Change
execution commands stay visible but disabled with the server-derived Authorization state. Source
references retain resolved availability and failure reasons so missing native evidence remains
auditable. URL resolution permits only public HTTP(S) destinations, validates every redirect, and
rejects loopback, private, link-local, and multicast addresses. The outbound HTTP(S) request is
pinned to the exact address that passed validation to prevent DNS rebinding. File resolution is
limited to the package-derived application root, OpenClaw-owned roots, and non-root
`FALCON_DASH_SOURCE_ROOTS` entries, including post-symlink validation. Commands accept at most 50
source references; existing display data is resolved four at a time with a four-second
batch deadline and reports timed-out or omitted references explicitly. The short-lived display
cache uses a 256-entry LRU bound and actively evicts expired entries.

Project full reads expose one typed `work` union for Tasks, Questions, Decisions, and Change
Requests. Every row carries a type tag plus normalized `phase_id`, `due_at`, `waiting_on`, and
terminal fields; Decision titles come from the current immutable package and Change rows also
carry verification state. Phase and Project progress, health, and risk flags all use this same
four-type Work union and each type's terminal semantics. A Change is terminal only after successful
execution plus passed/waived verification (or cancellation/rollback), and standalone Phase reads
use that same progress helper. Project- and Phase-scoped lookup indexes cover all four Work tables
so list and ledger aggregates do not degrade into repeated full-table scans. A
started-but-incomplete rollback makes a previously verified Change
open again until rollback completion. Verification cannot be waived before execution succeeds, so
terminal reconciliation never clears next-work pointers or blockers early; execution success also
reconciles any persisted legacy pre-execution waiver. Verification cannot pass or be waived during
an active rollback. Starting rollback invalidates revision-pinned satisfaction links, and new
satisfaction assertions require the same rollback-aware terminal predicate. Criterion satisfaction
and waiver counts are disjoint, and full Project reads preserve satisfaction source references and
pinned source revisions. Project proof sources are resolved in one bounded display batch with
availability reasons and per-proof omitted counts. Criterion- and Milestone-scoped contributions,
satisfaction links, achievement evidence, and unscoped Project contributions all retain and render
their own resolved source references. Milestone-targeted contribution and satisfaction
relationships are projected with their proof without leaking into similarly named Project
criteria. Planned Milestones present current
relationship proof neutrally. Cancelling or reopening a Milestone invalidates its active
satisfaction assertions; the ledger retains those assertions and their sources as historical proof
across later re-achievement while only the new generation counts as current. Cancelled Milestones
also reject fresh satisfaction assertions until they are reopened. The achievement form
exposes and enforces the server's either-sources-or-waiver contract without hiding those fields in
optional controls. Unscoped Project contribution links have their own proof block and bounded
source resolution and remain selectable through the reader field contract. Criterion-waiver events
persist an agent's human authority source so the Project history preserves the exact claimed
instruction. Reassigning current-next Work clears the old Project pointer
transactionally; legacy dangling or terminal pointers derive as missing and remain explicitly
clearable in the ledger. Null-only cleanup remains available for invalid legacy pointers even when a
Project is terminal or archived; setting a new pointer still requires a mutable, nonterminal
Project. Because archiving is visibility-only, a still-valid pointer remains visible as saved
read-only state, cannot be cleared until restoration, and becomes actionable again after
restoration. Terminal Projects never present a stored legacy pointer as active current work.
Blocked counts exclude terminal Work even when a
stale active Blocker record remains. Project child-command targets are accepted only when their parent ID matches the
current Project route; same-type commands remain bound to the route object, and targetless Phase or
Milestone creation payloads must name that same route Project. Project history merges Project,
Phase, Milestone, assigned Work, attached Plan, Review, Authorization, and proof-relationship
events into one bounded ledger timeline and classifies authority acts with the same server helper
as the Work overview. Project- and Phase-attached Plans and their Reviews are static Project history
subjects. Work-attached governance subjects are time-bounded by their audited Project
assignment intervals: the ledger includes both assignment boundaries, preserves history after Work
leaves, and never imports events from before Work joined or after it left. Derived Project mutations
from targetless reassignment commands record explicit version transitions. Scoped Event Log reads
join against fixed-size interval batches and merge the bounded results, avoiding SQLite expression
and parameter limits even when assignment history is large; a cross-type subject/ULID index serves
that join path. The membership projection overlays unpruned transactional-outbox assignment
boundaries before deriving intervals, so normal transfer lag or a delayed Event Log cannot widen a
current or former membership period; a partial assignment-event index bounds that overlay scan.
The timeline renders source references on every
source-bearing event, including non-authority achievement and Review evidence; verification waivers
and Authorization revocations persist an agent's claimed human instruction like every other
authority act. Reopened or cancelled Milestones retain their old evidence as explicitly historical
proof. The Project Ledger renders rather than recreates these lifecycle semantics. The shared UI
action adapter honors a posted child target for Phase/Milestone commands, serializes numeric and
boolean structure options to their command payload types, and removes route targets and optimistic
versions from targetless Project-local creation commands. It validates command presence and
manifest membership before target routing, preserves the canonical `unknown_command` error, and
rejects unrelated targetless commands posted through detail routes. Archived Projects also reject
child Phase, Milestone, and proof-relationship mutations server-side until restoration.

The Work overview consumes the server-computed queue buckets directly. Each bucket reports `total`,
`by_type`, and at most eight compact `items`; `by_type` is computed from the full bucket before the
item bound is applied. The combined `at_risk` bucket deduplicates object identities across blocked
risk, unhealthy Automations, and reconciliation before computing either total or type counts. The page
declares the `work3:queue` dependency and debounces invalidation of that dependency from
`/api/work3/events`, with silent degradation when EventSource is unavailable.

Two further read aggregates feed the overview signals: `computeDueNext()` (open Tasks by `due_at`
and planned Milestones by `target_at`, overdue included, 14-day horizon, client-side date-window
grouping) and `changedRecentlySummary()` (distinct entities with material events in the last seven
days, typed via an `entities` lookup; shares the material-event predicate with
`materialRecentChanges` through `isMaterialEventType`).

Automaton lists and details are read-through views of OpenClaw. Runtime list failure becomes a
health banner rather than an invented lifecycle. Detail controls mutate the same runtime object,
native Runs remain separate from the Falcon Event Log, and deleted records expose restoration only
when a retained snapshot is available; restoration creates a new paused runtime ID with lineage.

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
instead of disappearing. Human-facing references still use object type plus ID (`Change Request
176`); `W-{id}` is only the generated filename. When `ORIGIN` is configured, detail files also
include public dashboard links.

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

Base item rows, type-specific details, activity, versions, change-log records, and implicit blocker
links are written in one SQLite transaction. A constraint failure in any typed detail therefore
rolls the entire create or update back instead of leaving a visible partial item.

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
Legacy in-place Work schema upgrades keep `legacy_alter_table` enabled while foreign keys are
temporarily disabled so dependent tables continue to target the replacement `work_items` table;
the migration regression suite verifies the preserved rows with `PRAGMA foreign_key_check`.
