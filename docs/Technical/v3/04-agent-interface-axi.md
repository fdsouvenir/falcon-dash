# Falcon Dash v3 — AXI-Compliant Agent Interface

> Consolidated from approved contract [#329](https://github.com/fdsouvenir/falcon-dash/issues/329) on 2026-07-22. Implementation tracked in #329.

## Objective

Expose Falcon Dash v3 to agents through minimal, contextual, token-efficient projections while preserving a rich canonical domain model.

Design source: https://github.com/kunchenguid/axi

## Requirements

- Minimal default list projections with field selection
- Truncated detail content with size hints and a full-content escape hatch
- Precomputed totals, progress, health, blocker, and actionability aggregates
- Definitive empty states
- Structured self-correcting errors and meaningful exit/error classes
- Idempotent mutations
- Content-first default view
- Compact directory/session-scoped ambient context
- Contextual next-step suggestions without prescriptive workflow noise
- Concise per-operation help
- Unknown fields and filters fail loudly

## Deliverables

- Projection contract for every v3 object
- List, detail, and full representations
- Session-start Work briefing contract
- API/CLI mutation and error semantics
- Token and round-trip benchmarks against the v2 interface

## Approved AXI interpretation

Falcon Dash will follow AXI as an agent interface contract, not copy its implementation details into the domain. CLI output defaults to TOON; JSON is an explicit machine/debug escape hatch. Default projections are minimal and content-first, with truncation metadata and an explicit full-detail path. Aggregate queries avoid N+1 reads, empty results are definitive, ambient context is compact, and help is concise and consistent. Mutations expose the changed state plus the relevant next action. Unknown commands, flags, fields, and filters fail loudly. Structured errors use stable codes and CLI exit statuses while the internal HTTP/API transport remains JSON. Contextual next steps are returned only when they help recover or continue, not as generic workflow theater.

## Final agent-interface contract

### Command surface

The interface is organized around object nouns and semantic verbs:

- `work list|get|search`
- `project|phase|milestone|task|question|decision|change|plan|finding|area|automaton`
- type-specific verbs defined by #327, such as `task complete`, `question answer`, `decision decide`, `change authorize`, and `automaton pause`
- `queue`, `brief`, `sources`, `relationships`, and `history`

There is no generic status patch command. No-argument invocation returns a compact orientation and the highest-value next actions, not a full manual. Every command supports concise `--help`; unknown commands, flags, fields, filters, and enum values fail loudly.

### Output modes

- Default CLI output is TOON.
- `--json` returns the same projection as structured JSON.
- `--fields` narrows supported projection fields.
- `--full` requests complete content and expanded relationships/sources.
- Long content is truncated by default with `truncated`, original size, returned size, and the exact full-content command.
- Empty results return a definitive success response with zero count and an empty collection.

### Default projections

- Project: id, title, lifecycle, health, progress, current-next, active blocker count.
- Phase: id, title, lifecycle, sequence, required Work progress.
- Milestone: id, title, lifecycle, target state/date, proof state.
- Task: id, title, lifecycle, actionability, waiting/blocker summary, Project context.
- Question: id, prompt, lifecycle, impact, blocking count, answer summary when answered.
- Decision: id, prompt, lifecycle, recommendation, consequence of delay, decision age.
- Change Request: id, title, execution state, verification state, Authorization effectiveness, next legal action.
- Plan: id, subject, revision, lifecycle, Review disposition.
- Finding: id, title/claim, validity, confidence, source count.
- Area: id, title, lifecycle, active Work counts.
- Automaton: OpenClaw id, name, lifecycle, schedule/trigger summary, health, next execution, recent native Run summary.
- Review and Authorization appear primarily inside their subject aggregates; direct lookup returns their immutable outcome/grant.

List defaults never include full descriptions, Plans, source payloads, histories, or all relationships. Detail adds the content needed to understand the object and act. Full adds complete text, history, relationships, provenance, and revisions.

### Aggregate queries

`queue` and `brief` are server-computed aggregates, not client-side N+1 joins. Required buckets are:

- actionable now
- needs Fred
- waiting on agent
- waiting on external
- blocked risk
- awaiting Review
- Change Requests lacking valid Authorization or verification
- unhealthy Automata
- stale current-next pointers or reconciliation problems

Every bucket provides total count and a bounded set of compact rows. Pagination or a follow-up command retrieves more.

### Ambient context

Session-start context is bounded and cacheable. It contains:

- current high-priority actionable Work
- decisions/answers/Reviews/Authorizations requiring Fred
- material blockers and unhealthy Automata
- recently changed relevant Work
- exact commands for deeper context

It excludes closed history, full Plans, routine successful Runs, and generic suggestions. Directory or Project context may narrow the brief but never silently changes mutation targets; mutation commands still name the target explicitly.

### Mutation responses and errors

Successful mutation output contains command, target, prior state/version, resulting state/version, whether it was an idempotent no-op, material derived effects, and at most one relevant next action.

Errors follow #327 and include stable code, message, target context, missing requirement or conflicting version, and useful valid alternatives. CLI uses stable nonzero exit classes. Internal HTTP transport remains JSON. There are no interactive prompts in agent mode.

### AXI acceptance

- Representative list and detail calls use fewer tokens than v2 while preserving enough information to select the next action.
- Common workflows require aggregate calls rather than per-object lookup loops.
- Full content is always reachable through one explicit follow-up.
- Unknown input, truncation, empty results, conflicts, and invalid transitions are unambiguous.
- TOON and JSON projections are semantically equivalent.
- Help, naming, pagination, filtering, and error behavior are consistent across objects.

## Approved: conversational capture path

Conversational capture is not a separate subsystem. Fred talks to an OpenClaw agent; the agent translates the conversation into explicit AXI commands — creation, linking, and semantic transitions. Consequences:

- The AXI command surface is the only agent mutation path. There is no natural-language ingestion endpoint, shadow draft store, or automatic transcript mining.
- Captured objects must satisfy the same creation guards as any other path. If the conversation lacks a required element (for example a second materially distinct Decision option), the agent gathers it conversationally before issuing the command, or records the gap as a Question or Task instead of manufacturing a hollow object.
- Human statements from conversation are recorded as source_refs (message or human-statement kind) for provenance, including the human authority basis when an agent executes an authority-creating command on Fred's instruction (see the #327 actor model).
