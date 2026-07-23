# Falcon Dash v3 — Relationships, Blockers, Provenance, and Source References

> Consolidated from approved contract [#328](https://github.com/fdsouvenir/falcon-dash/issues/328) on 2026-07-22.

## Objective

Define how v3 records relate, authorize, block, support, supersede, and prove one another without abusing containment or duplicating truth.

## Scope

- Project membership and optional Phase assignment
- Dependencies and blockers
- contributes_to and satisfies relationships for Milestones
- Decisions authorizing Change Requests
- Findings derived from sources
- Source references attached to completion criteria and transition claims
- Source provenance and confidence
- Supersession, reconciliation, and stale-record cleanup
- Immutable event history versus editable current state

## Deliverables

- Relationship vocabulary and directionality
- Cardinality and integrity rules
- Source-reference schema
- Blocker lifecycle
- Reconciliation rules for superseded Work
- Query projections and aggregate requirements

## Approved provenance direction

Do not build a global Evidence object or ingest all tool output. Use lightweight source_refs on Findings, Question answers, Decision analysis/outcomes, Authorizations, Change acceptance results, Project completion criteria, Milestones, and Findings referencing native OpenClaw Runs.

Source references resolve to native records where possible. Selective immutable snapshots are reserved for high-value ephemeral proof. The UI exposes these links as Sources or Verified by rather than an Evidence management surface.

## Approved: Blocker relationship

Blocker is an explicit historical relationship, not a Work object and not a generic lifecycle status. It records the actionable Work that cannot proceed, the Work/person/agent/system/external dependency preventing progress, the reason, an observable resolution condition, and an optional Task responsible for unblocking it.

Blocker state: active, resolved, invalidated.

Key invariants:

- Only actionable Work may be the blocked target.
- Projects derive blocked health from their current next item; Milestones derive risk from contributing Work.
- An item cannot block itself and duplicate active links are idempotent no-ops.
- Reason describes the constraint; resolution_condition describes what clears it; required action belongs in an unblock Task.
- Resolution requires actor, timestamp, and summary; invalidation means the relationship was wrong or ceased to apply.
- Blocking never rewrites the target lifecycle state.
- Deterministic blocker completion may auto-resolve; ambiguous cases require explicit resolution.
- Waiting and blocked remain distinct: waiting is intentional idleness pending a known response/time, while blocking is an explicit constraint preventing progress.

AXI blocked-work projection: id, title, blocker_summary, blocked_age.

## Final relationship contract

### Containment and assignment

- A Work object may belong to zero or one Project. Project membership is assignment, not ownership or authorization.
- Project Work may optionally reference one Phase in the same Project.
- Phase is ordered route structure. Milestone is an independently provable condition. Neither contains the other.
- Area is a durable organizational assignment and does not control lifecycle, authority, or Project membership.
- Tags are non-authoritative labels. They never drive lifecycle or access control.

### Typed relationship vocabulary

Only these semantic links are canonical:

- `blocks`: Blocker relationship from a dependency source to actionable blocked Work.
- `depends_on`: non-blocking prerequisite; it becomes a Blocker only through an explicit active Blocker record.
- `contributes_to`: Work contributes toward a Milestone or completion criterion without proving it.
- `satisfies`: immutable assertion that a result satisfies a criterion, with source references and subject revision.
- `implements`: Task or Change Request implements a Decision.
- `authorizes`: Authorization governs a Change Request or other explicitly governed action. A Decision may explain why the Change exists but does not itself grant execution authority.
- `answers`: an answer revision resolves a Question.
- `supersedes`: a newer immutable record or revision replaces an older one.
- `derived_from`: Finding, answer, analysis, or result was derived from another record or native source.
- `related_to`: last-resort non-semantic association; excluded from blocker, progress, authority, and completion calculations.

Inverse labels are projections, not duplicate stored links. Self-links are forbidden. Duplicate active semantic links are idempotent no-ops. Links requiring Project locality reject cross-Project targets.

### Cardinality and integrity

- A Work object has at most one active Project and Phase assignment.
- A Phase assignment requires matching Project membership.
- A criterion may have many contributing links but only current, revision-pinned `satisfies` assertions count as proof.
- One record may supersede one direct predecessor; the resulting chain must remain acyclic.
- Review and Authorization target exactly one subject revision.
- A Blocker targets one actionable Work object and has one dependency source. Multiple distinct Blockers may target the same Work.
- Relationship writes validate target existence, allowed type pairs, lifecycle compatibility, and cycles before commit.

## Source reference schema

`source_refs` is a compact array, not a standalone Evidence domain:

- `kind`: native record family such as message, email, document, URL, file, event, OpenClaw run, Work event, or human statement
- `ref`: stable native identifier or resolvable URI
- `label`: short human-readable description
- `captured_at`: when the claim was observed
- `locator`: optional page, line, message, event, or fragment locator
- `snapshot_ref`: optional immutable snapshot only when native content is ephemeral or materially important
- `content_hash`: optional integrity check for snapshots

Secrets and full sensitive payloads are never copied into `source_refs`. Access follows the native source boundary. A missing native source is reported as unavailable; the application does not pretend the claim was never supported.

Confidence belongs to the claim or Finding, not the source reference. Human approval is recorded as a source of authority provenance but does not create IAM.

## Supersession and reconciliation

- Supersession preserves the old record, its links, Reviews, Authorizations, and Event Log history.
- Current projections follow the supersession chain to the newest valid record while exposing lineage on demand.
- A new revision invalidates revision-pinned Review, Authorization, and `satisfies` assertions until renewed.
- Terminal, withdrawn, cancelled, retracted, merged, deleted, or superseded records trigger deterministic reconciliation of current-next pointers, active Blockers, Phase assignments, and derived health.
- Reconciliation never silently completes or cancels other Work. Ambiguous cases appear as explicit actionable inconsistencies.
- Deleting an Automaton preserves its Falcon restoration snapshot and relationship history; OpenClaw Run references remain read-through native references.

## Required projections

Default relationship projections return compact counts and the few items affecting current action:

- active blocker summary and age
- current Project, Phase, Area, and current-next context
- unresolved dependencies
- current supersession head
- criterion satisfaction totals
- source count and availability state

Full detail exposes typed links, provenance, reconciliation history, and source locators. Definitive empty arrays mean no relationships were found; omission means the projection did not request them.
