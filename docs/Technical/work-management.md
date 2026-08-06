# Work Management

This is the current implementation guide for Falcon Dash v3 Work. The approved semantic contracts
remain in [v3/](v3/); this document explains how the shipped code realizes them.

## One domain, two product surfaces

Human UI and agent interfaces read and mutate the same canonical Work domain:

- people use `/work/**` page servers and type-specific pages;
- agents use bearer-authenticated `/api/v3/**` or the packaged `falcon` CLI;
- the gateway plugin supplies a bounded session-start brief, then points agents to the API/CLI for
  deeper context.

There is no markdown mirror, workspace symlink, v2 compatibility API, or separate agent database.

## Storage and startup

`src/lib/server/work3/db.ts` opens two SQLite databases with numbered migrations and WAL mode:

| Database  | Default path                                   | Role                                                     |
| --------- | ---------------------------------------------- | -------------------------------------------------------- |
| Canonical | `~/.openclaw/data/falcon-dash/work3.db`        | entities, type tables, relationships, governance, outbox |
| Event log | `~/.openclaw/data/falcon-dash/work3-events.db` | append-only domain history                               |

Override the directory with `FALCON_DASH_DATA_DIR`, or the individual files with
`FALCON_DASH_WORK3_DATABASE_PATH` and `FALCON_DASH_WORK3_EVENTS_DATABASE_PATH`.

`startWork3()` applies migrations, registers commands and readers, installs the source resolver,
starts the outbox worker, and subscribes to OpenClaw cron events for Automation synchronization.

## Command engine

All mutations go through registered semantic commands. The engine owns:

- schema and type-specific validation;
- lifecycle guards and legal command discovery;
- actor and human-authority verification;
- optimistic version checks and idempotency;
- canonical writes plus an outbox event in one transaction;
- structured errors and post-commit invalidation.

Human display labels and agent IDs do not create authority. Agent actors come from bearer-token
resolution. Human authority-creating commands must carry a source reference that resolves through a
trusted adapter.

The outbox worker transfers committed events to `work3-events.db`. UI timelines and agent history
read the event log; nothing treats the outbox as a read model.

## Readers and derived state

Readers expose `list`, `detail`, and `full` projections with validated fields, filters, pagination,
and type-specific derived state. Health, progress, actionability, review disposition,
authorization effectiveness, schedule state, queue membership, and meaningful update time are
server facts. Browser routes must not recreate them.

The domain includes Projects, Phases, Milestones, Tasks, Plans, Questions, Decisions, Change
Requests, Findings, Reviews, Authorizations, Areas, relationships, blockers, and Automations. Refer
to the v3 contracts for their full lifecycle semantics.

## Agent HTTP interface

Every `/api/v3` request requires a Falcon agent bearer token. Tokens are minted in Settings → Agent
Tokens, returned in plaintext once, and stored hashed. The current surface is:

- `GET /api/v3/brief` — bounded session-start summary;
- `GET /api/v3/queue` — actionable queue projection;
- `GET /api/v3/objects/:type` and `GET /api/v3/objects/:type/:id` — typed reads;
- `POST /api/v3/commands/:command` — semantic mutations;
- `GET /api/v3/history` — event-log reads;
- `GET /api/v3/search` — FTS search;
- `POST /api/v3/sources/resolve` — source-reference resolution.

HTTP responses are JSON. The `falcon` CLI adds its compact TOON representation and human-oriented
command routing.

## Browser updates

`/api/work3/events` streams post-commit domain events. `src/lib/work3/live.ts` debounces those
events into SvelteKit invalidation, so page servers reread canonical state. A dropped SSE message
does not lose Work history.

## OpenClaw Automations

A Work Automation and its OpenClaw native cron job are one aggregate. The OpenClaw job ID is its
identity, the gateway owns the live definition and runs, and Falcon Dash owns Work-facing metadata,
derived governance, and event history.

Falcon Dash resynchronizes on cron events and detects direct runtime edits. Because the installed
gateway does not expose a reliable configuration-revision token, the adapter compares runtime
timestamps and rereads the native record. Runtime unavailability is an operation/health error, not
a fabricated Work lifecycle state.

This subsystem is unrelated to the planned v4 Falcon integration lifecycle scheduler.

## Work UI

Current destinations are:

- `/work` — action-oriented overview;
- `/work/projects` and `/work/projects/:id` — portfolio and Project ledger;
- `/work/needs-resolution` — Questions, Decisions, Reviews, and Authorizations;
- `/work/automations` and `/work/automations/:id` — OpenClaw-backed Automations;
- `/work/browse` — typed search and inspection;
- type-specific routes for Tasks, Questions, Decisions, Changes, and Findings.

The UI uses server command manifests and keeps object vocabularies distinct. Reviews never imply
Authorization, guarded execution remains visible with its unmet reason, and stale-version failures
return enough state for a deliberate retry.

## Change checklist

- Update the matching v3 contract only when semantics change, not for ordinary code movement.
- Add migrations rather than editing an applied migration.
- Test command guards, versions, idempotency, outbox/event transfer, and derived readers.
- Verify both UI and agent paths because neither is secondary.
- Keep prompt context bounded and best-effort; deeper state belongs behind `falcon` or `/api/v3`.
