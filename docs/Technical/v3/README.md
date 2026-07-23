# Falcon Dash v3 Contracts

Falcon Dash v3 is a human-operable, agent-native operator workspace backed by one rigorous Work domain. This directory holds the authoritative copies of the approved v3 product contracts, consolidated from the epic [#326](https://github.com/fdsouvenir/falcon-dash/issues/326) and its sub-issues on 2026-07-22. The GitHub issues remain the approval record; when these docs and an issue disagree, reconcile explicitly rather than assuming either side.

## Product principles (from #326)

- Rich canonical records; minimal contextual projections.
- Human UI and agent interfaces are equal product surfaces over one source of truth.
- Natural conversational capture without manufacturing Tasks, Decisions, Changes, Runs, Evidence, or IAM concepts that do not exist.
- Explicit type-specific lifecycle, Review, Authorization, provenance, completion, and reconciliation semantics.
- Falcon Dash Automaton and the corresponding OpenClaw automation are one aggregate with the same identity.
- AXI governs the agent-facing projection and interaction contract, not the canonical schema. Design source: [kunchenguid/axi](https://github.com/kunchenguid/axi).
- Migration and v2 compatibility are not Falcon Dash v3 application capabilities.
- Implementation architecture and sequencing belong to the developer.

## Contracts

| Doc                                                                              | Source issue | Contents                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-work-domain-model.md](01-work-domain-model.md)                               | #324         | Canonical objects: Project, Phase, Milestone, Task, Plan, Question, Decision, Change Request, Automaton, Finding, Review, Authorization, Area/Tags, shared envelope, source references, Event Log infrastructure |
| [02-lifecycle-and-authority.md](02-lifecycle-and-authority.md)                   | #327         | Semantic transition commands, per-object state machines, guards, idempotency, optimistic concurrency, actor model and authority classes                                                                          |
| [03-relationships-provenance-sources.md](03-relationships-provenance-sources.md) | #328         | Typed relationship vocabulary, blockers, source_refs schema, supersession and reconciliation                                                                                                                     |
| [04-agent-interface-axi.md](04-agent-interface-axi.md)                           | #329         | AXI command surface, TOON/JSON output modes, projections, aggregates, errors, conversational capture path                                                                                                        |
| [05-operator-ui.md](05-operator-ui.md)                                           | #330         | Information architecture, Mission Control, Project ledger, decision/approval surfaces, rendered acceptance                                                                                                       |

## Explicit exclusions

- Migration UI/API, compatibility layers, dual reads/writes, or in-application cutover tooling — decided in [#331](https://github.com/fdsouvenir/falcon-dash/issues/331) (closed as intentionally out of scope). Any v2 data handling is a one-time external operator procedure, not product.
- Falcon-owned Run or Evidence objects.
- Domain-level IAM/RBAC; v3 uses the minimal actor model in doc 02.
- Prescribed implementation architecture — storage, module boundaries, and sequencing are developer decisions, tracked in [#332](https://github.com/fdsouvenir/falcon-dash/issues/332).
