# Falcon Dash v3 — Implementation Architecture

> Developer-owned architecture decisions for implementing the v3 contracts (docs 01–05). Release gate 7 in [#332](https://github.com/fdsouvenir/falcon-dash/issues/332) requires these material choices and their tradeoffs to be documented; this doc is that record, written before implementation began (2026-07-22) and updated as decisions evolve. The contracts constrain this doc, never the reverse.

Guiding rule: do not over-index on v2. v2 patterns are inherited only where they are domain-neutral house style (data directory layout, test conventions, adapter-node deployment, idempotent-singleton startup). v2's domain design — universal status enum, markdown workspace mirror, unauthenticated API, imperative schema evolution — is explicitly not carried forward.

## Storage

- Two SQLite databases via `better-sqlite3` (existing dependency): `work3.db` (canonical Work database) and `work3-events.db` (append-only Event Log), per the two-database contract in doc 01. Both live under the standard data dir (`FALCON_DASH_DATA_DIR`, default `~/.openclaw/data/falcon-dash/`), with env overrides `FALCON_DASH_WORK3_DATABASE_PATH` and `FALCON_DASH_WORK3_EVENTS_DATABASE_PATH`. WAL mode, foreign keys on, lazy idempotent singleton open with test-reset helpers (mirroring the v2 test pattern: env-var path override + `close`/`reset` exports).
- **Numbered migrations**: a `schema_migrations` table per database and ordered SQL files (`migrations/work/NNN_*.sql`, `migrations/events/NNN_*.sql`) applied transactionally at startup. This deliberately replaces v2's imperative, introspection-guarded rebuild pipeline, which proved order-sensitive and hard to reason about.
- **Two versioning mechanisms, deliberately distinct** (per doc 01): the envelope `version` counter provides optimistic concurrency on mutable head rows; immutable revisions (Plan revisions, Decision packages, Question answers, Findings, Reviews, Authorizations) live in dedicated revision tables with `supersedes` links. The revision-table pattern is part of the foundation because Review/Authorization pinning and revision-pinned `satisfies` assertions build on it — it is the most expensive thing to get wrong.
- **IDs**: short type-prefixed public IDs (`t42`, `q7`, `p3`) for all agent- and human-facing surfaces (AXI token efficiency; UUIDs waste tokens and are hostile to conversational reference). ULIDs for Event Log event IDs and idempotency keys. Automatons use the OpenClaw job id as their identity per the one-aggregate contract — no separate Falcon id.

## Transition engine

- One shared **command registry**: per-object semantic command definitions as data — command name, target type, legal source states, guards, required metadata, effects, emitted event types. The registry is the single source of truth for execution, HTTP routing, CLI help, and error alternatives ("valid alternatives" in structured errors come from the registry, not hand-maintained lists).
- **Two-phase execution pipeline.** Some guards are irreducibly async — resolving a human-instruction `source_ref` against gateway chat history, rechecking Authorization validity, and all Automaton gateway operations — and cannot live inside a synchronous better-sqlite3 transaction. The pipeline is therefore: (1) async pre-guards; (2) one synchronous transaction: load target + `expected_version` check, synchronous guards, mutation, idempotency record, outbox insert; (3) post-commit in-process bus emit. The in-transaction version check protects against races during the async phase: if the record changed while a pre-guard was in flight, the command fails with `version_conflict` rather than committing on stale state.
- **Automaton commands use a distinct executor shape** sharing the same registry, errors, and idempotency: gateway RPC first (`cron.add`/`cron.update` with `expectedConfigRevision`/`cron.remove`), then the local transaction for extension attributes + outbox. Partial failure (runtime mutated, local write failed, or vice versa) surfaces as an operation/health error per the contract — never hidden, never modeled as drift.
- **Structured errors** with stable codes (`transition_not_allowed`, `transition_requirements_not_met`, `authority_required`, `authorization_invalid`, `version_conflict`, `invariant_violation`, …) defined once in shared code and mapped to HTTP statuses and CLI exit classes.
- **Derived state is computed on read, never stored**: Authorization effectiveness (including time-based expiry), Review disposition, blocked state, Project health, progress, Milestone schedule state — all in one shared `read/derived.ts` module consumed by projections, guards, and queue buckets, so they cannot diverge (release gate 2). No expiry sweeper: the recheck-before-every-governed-action rule makes one redundant for correctness; a system-actor sweep can be added later only if Mission Control needs expiry _events_.

## Event Log

- Transactional **outbox** table in `work3.db`, written in the same transaction as every canonical mutation. A transfer worker moves outbox rows to `work3-events.db`: interval fallback **plus** an immediate kick from the post-commit bus emit, so `history` reflects a completed command without perceptible lag. ULID event IDs make the transfer an insert-or-ignore upsert (idempotent across the two files, which share no transaction); delivered rows are pruned after a safety window.
- Outbox transfer lag and failed publication are surfaced through `/api/health` diagnostics — observable operational states, never silent (doc 01 Event Log rules; release gate 6 evidence).
- Browser live updates come from an SSE endpoint reading the in-process bus (same stream template as `/api/gateway/events`). UI timelines and the agent `history` command read only the Event Log through the server API; nothing but the transfer worker reads the outbox.

## Auth and actor adapters

Actor identity is credential identity (doc 02). Two thin adapters over one engine:

- **`/api/v3/*` requires a bearer token, always, and only ever yields `agent` (or `system`) actors.** Per-agent tokens live in a `falcon_agent_tokens` table, hashed at rest, minted in the settings UI, and dropped as token files under the data dir so the co-resident CLI is zero-config (`FALCON_DASH_TOKEN` env overrides).
- **Person actorship exists only through the operator UI's server-side path**: SvelteKit form actions / server routes calling the engine in-process, protected by SvelteKit's origin check, with display label taken from `Cf-Access-Authenticated-User-Email` when the Cloudflare Access header is present. No session store.
- Rationale (the spoofing hole this closes): production traffic from agents is localhost and bypasses Cloudflare Access entirely, so any "no bearer = person" rule would let an agent issue authority-creating commands as Fred. Under this design a bearer credential can never produce a person actor, and the person path never crosses the network API.

## HTTP API

JSON only; TOON rendering is a CLI concern (doc 04: "internal HTTP/API transport remains JSON").

- Mutations: `POST /api/v3/commands/[command]` — one dispatch route, body `{target, expected_version, idempotency_key, payload}`. Unknown command names fail loudly with 404 and the known-command list. One route file; the registry provides dispatch.
- Reads: `GET /api/v3/objects/[type]` (list/search with `view=list|detail|full`, `fields=`, filters) and `GET /api/v3/objects/[type]/[id]`; plus dedicated `queue`, `brief`, `history`, `events` (SSE), and `sources/resolve` endpoints. Aggregates are single-pass server-side SQL, bounded rows + totals per bucket (doc 04).

## CLI: `falcon`

- New TypeScript source in `src/cli/`, bundled by a separate esbuild step (`scripts/build-cli.mjs` → `bin/falcon.js`; the SvelteKit build doesn't cover it), new `bin` entry `falcon` alongside the existing `falcon-dash` server launcher. Because Falcon Dash ships as an npm global on every fredbot host, the CLI lands on agent machines automatically.
- Built on `axi-sdk-js` (pinned exact — 0.x, accept churn risk deliberately; fallback is vendoring its small dispatch layer) and `@toon-format/toon` v4: TOON default output, `--json`, `--fields`, `--full`, truncation metadata with the exact full-content command, stable exit classes, concise per-command `--help`, no-arg orientation view.
- Command metadata and error codes live in `src/lib/work3-shared/` with **no server imports** (no `$env`, no better-sqlite3), consumed by both engine and CLI so the two surfaces cannot drift.
- Config: `FALCON_DASH_URL` (default localhost) + token discovery (env → config file → token file under the data dir). Open question deferred to the CLI issue: how the CLI knows _which_ agent it is; fallback is a host-level token with `FALCON_AGENT_ID` attribution, recorded as a Finding.

## Ambient context

v3-native, no v2 markdown mirror: no workspace file generation, no symlinks, no per-item `.md` files. The existing falcon-dash gateway plugin's `before_prompt_build` hook fetches the bounded `GET /api/v3/brief` (with its own agent token) and prepends it to agent prompts. On-demand depth is the CLI: `falcon` no-arg orientation, `falcon brief`, `falcon queue`.

## Automaton aggregate

- Composition: live gateway `cron.*` record (via the existing `gateway-client.ts` singleton) + a `automaton_attrs` extension table keyed by OpenClaw id (Area/Project context, summary, Plan, policies, restoration history).
- `automaton_attrs` includes a `last_seen_runtime_config` snapshot column refreshed on every `cron` event and read-through. This exists solely to serve the recoverable-deletion requirement when a job is deleted _directly in OpenClaw_ (the change event may not carry the removed config). It is a snapshot cache, explicitly **not** mirrored desired-state: nothing reconciles against it, and there are no drift semantics.
- Lifecycle commands go through the gateway with `expectedConfigRevision` (capability audit: fully supported as of openclaw 2026.7.1-2). The `cron` event subscription feeds the bus; on receipt, re-read and diff `configRevision` to distinguish definition changes from run-state noise.
- To verify during implementation: `cron` event payload granularity; whether `declarationKey` helps restore keep a stable identity (restore otherwise produces a new runtime id, requiring extension-attribute re-binding with lineage recorded).

## UI

New routes under `/work3` (temporary namespace) implementing the five destinations of doc 05, with form actions calling the engine in-process (the person adapter). At cutover: route swap to `/work`, module-registry update, deletion of the v2 module, `/api/work/*`, and the v2 context writer. Coexistence with v2 is incidental, not a design goal — zero investment beyond not breaking the build, and v2 retirement happens as soon as the operator switches daily driving, not gated on the full issue arc.

## Build order

Vertical-slice first, so every layer of the contract is exercised early and dogfooding starts weeks before breadth:

1. Foundation (DBs, migrations, envelope, engine core, outbox/Event Log, bus/SSE)
2. Actor model + agent transport (tokens, `/api/v3` skeleton)
3. Vertical slice: Area + Task + Blockers end-to-end with minimal UI
4. `falcon` CLI v1
5. Knowledge objects: Question, Decision, Finding + source-ref resolution
6. Governance: Plan, Review, Authorization, Change Request
7. Project structure: Project, Phase, Milestone, typed relationships, reconciliation
8. Automaton aggregate (parallelizable after 2)
9. Mission Control, queue/brief aggregates, Needs Resolution, Browse
10. Cutover, benchmarks, dogfooding, release evidence

The child issues of #332 map one-to-one to this order.
