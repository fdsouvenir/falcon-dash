# Falcon Dash v3 — Implementation Architecture

> Developer-owned as-built architecture for the approved v3 contracts. This file records the
> material v3 implementation decisions required by #332. General current orientation lives in
> `../work-management.md`; docs 01–05 constrain this implementation, not the reverse.

## Storage

- `better-sqlite3` opens `work3.db` for canonical Work state and the transactional outbox, plus
  `work3-events.db` for the append-only Event Log.
- Both default to `~/.openclaw/data/falcon-dash/`, with directory and per-database environment
  overrides.
- Each database has a `schema_migrations` table. Numbered SQL migrations apply transactionally at
  startup; applied migrations are immutable.
- Mutable head rows use an envelope version for optimistic concurrency. Immutable answers,
  packages, revisions, Reviews, and Authorizations use revision/supersession records.
- Public IDs are short and type-prefixed. Event IDs and idempotency keys use ULIDs. An Automaton
  uses its OpenClaw job ID; Falcon Dash does not mint a second runtime identity.

## Command engine

One registry defines semantic commands, target types, validation, guards, effects, and events. The
registry feeds execution, legal-command projections, HTTP mutation routing, CLI help, and valid
alternatives in errors.

Execution has three phases:

1. asynchronous pre-guards resolve external sources or runtime state;
2. one synchronous SQLite transaction reloads the target, checks `expected_version`, applies
   synchronous guards and mutation, records idempotency, and inserts the outbox event;
3. post-commit code publishes local invalidation and starts outbox transfer.

The in-transaction reload prevents an asynchronous validation result from authorizing a stale
mutation.

Semantic no-ops and idempotency replays are intentionally different. A no-op does not bump the
version or emit an event. A replay returns the original recorded result and skips repeated side
effects.

Structured errors use stable codes, messages, target/version context, missing requirements, and
useful alternatives. Unknown fields and filters fail loudly.

## Authority

Agent actors come from hashed bearer-token records. Person actions enter through the trusted
same-origin UI adapter. Display labels are historical attribution and never create authority.

Authority-creating commands require a person UI session or a resolvable source reference to the
human instruction asserted by an agent. The source reference establishes auditable provenance, not
proof of the human's intent. System actors cannot decide, answer, review, grant authority, or waive
governance.

## Event delivery

Canonical mutation and outbox insertion are atomic. A retrying worker transfers outbox rows to the
separate Event Log. The outbox remains internal; timelines and agent history read only the Event
Log.

An in-process bus emits after commit. `/api/work3/events` forwards those signals over SSE so browser
readers can invalidate. The SSE stream is not durable history and missing an event cannot lose
canonical state.

## Read model and search

Object readers register `list`, `detail`, and `full` projections with field/filter validation.
Shared derived modules compute blockers, actionability, governance, Project health/progress,
Milestone schedule state, queue/brief buckets, due-next groups, and meaningful changes.

FTS5 indexes current searchable heads. Queries are term-quoted before `MATCH`. Aggregates use
set-based queries with totals and bounded rows rather than client-side join loops.

Derived state is never patched by clients. Guards and readers consume the same derivations so UI,
API, and CLI cannot disagree about Authorization effectiveness or lifecycle requirements.

## Human and agent interfaces

- Work page servers call readers and the person command adapter in process.
- `/api/v3` is JSON and bearer-authenticated for agent access.
- The packaged `falcon` CLI uses the same projections and commands, defaulting to compact TOON with
  JSON as an explicit output mode.
- `gateway-plugin/brief-context.js` fetches the bounded `/api/v3/brief`, caches for 60 seconds, and
  fails open with empty context. It does not generate markdown mirrors or workspace symlinks.

The shipped UI routes are under `/work`; the temporary `/work3` build namespace and v2 APIs are no
longer part of the application.

## Project history scope

Project timelines combine events for the Project, its structure, and Work assigned during explicit
membership intervals. Assignment boundaries appear in both the Project being left and the Project
being joined. Pending outbox assignment events supplement the Event Log until transfer completes,
so the current ledger boundary takes effect immediately without rewriting history.

## Automaton composition

OpenClaw owns cron definitions and native runs. Falcon Dash owns Work-facing metadata, derived
health/governance, lifecycle history, and deleted snapshots. The OpenClaw job ID is the shared
aggregate identity.

Automaton commands perform the gateway operation and then record the corresponding local state and
event. The installed OpenClaw runtime does not expose a configuration compare-and-swap token, so
Falcon Dash rereads and compares `updatedAtMs` through `expected_runtime_updated_at_ms`. A small
read-to-write race remains until OpenClaw exposes a revision token. Partial or unavailable runtime
operations surface as errors; they are never recast as drift or a fake lifecycle state.

Deleting an Automaton preserves a Falcon snapshot. Restoring creates a new paused OpenClaw job,
rebinds the Work entity to the new runtime ID, and preserves lineage rather than pretending the new
job has the deleted identity.

Cron events trigger a debounced synchronization read. Direct runtime edits update snapshots;
missing jobs are detected explicitly.

## Reconciliation

Terminal commands run deterministic reconciliation in the same mutation path:

- clear invalid Project current-next pointers with an audit event;
- auto-resolve blockers only for supportive terminal outcomes;
- leave ambiguous cancellation cases visible for a human decision;
- invalidate revision-pinned `satisfies` assertions when their subject reopens.

There is no correctness-critical sweeper for these rules.

## Known tradeoffs

- Automaton updates retain the gateway read-to-write race described above.
- Queue `waiting_on` classification currently recognizes agent-like string prefixes; a richer
  identity model would replace that heuristic.
- The repo versions the Work brief hook but not the complete installable gateway extension source;
  standalone plugin packaging remains a product installation gap.
- The current package expects KeePassXC files to be provisioned before Vault is available;
  standalone vault provisioning also remains an installation gap.
