# V5 Work Domain Decisions

> **Status: accepted direction under active audit; not current runtime behavior.**
>
> Working issue: [#363](https://github.com/fdsouvenir/falcon-dash/issues/363). Last reconciled:
> 2026-08-19.

## Purpose

Reconcile Falcon Dash's persisted Work model before the desktop-web overhaul. The database,
semantic commands, agent interface, and Stitch-led UI must describe one coherent product. The
current Work UI is implementation evidence, not a behavior authority for this redesign.

Every retained canonical concept and field must justify itself through at least one of:

- a user or agent decision it enables;
- an invariant it enforces;
- a current-state projection it explains;
- an audit fact it preserves; or
- a documented infrastructure boundary.

## Product and ownership boundaries

- [DESIGN.md](../../DESIGN.md) and the linked Project Governance Portal Stitch project are the sole
  visual authority.
- V5 implementation is desktop-web first. Dedicated mobile information architecture remains v6.
- OpenClaw owns agents, sessions, transcripts, messages, tool activity, approvals, and native
  runtime state.
- Falcon Dash owns Work state and durable contextual links between Falcon objects and OpenClaw
  sessions. It does not own a competing transcript, message, or Run model.
- Explicit human confirmation is not a general Work-domain requirement. Whether an agent consults
  its user belongs to their contract unless a separate governed operation says otherwise.

## Settled: Project, Milestone, and Phase

The target planning model is:

```text
Project = bounded outcome
Milestone = ordered exit gate or outcome checkpoint
Task / Question / Decision / Change Request = Work used to reach the gate
```

- Remove Phase as a domain object. It does not earn a separate containment layer.
- Remove `phase_id` from Work after migration of existing assignments.
- Milestones remain directly owned by one Project and retain explicit order.
- A Milestone may carry an optional display label when language such as `Phase 2` is useful; that
  label does not recreate Phase semantics.
- Work associates with Milestones semantically rather than being contained inside them.
- A Work item may support more than one Milestone.
- Milestones are Project-local and do not require a global navigation destination.

## Settled: Project lifecycle

Agents do not directly set ordinary Project status. Project lifecycle is derived from domain facts:

- an open Project remains in progress while one or more required Milestones are unachieved;
- a Project completes automatically when every required Milestone is achieved;
- an open Project may be abandoned with a required reason;
- abandonment is reversible through an explicit resume action;
- the Event Log preserves every abandonment and resumption even though the current Project
  projection shows only its present state.

Archive is not a Project domain state. Completed and abandoned Projects leave the default open
list through filtering while remaining available as history. The target command surface has no
direct `complete_project`, `archive_project`, or `restore_project` command. Cancellation becomes
reversible abandonment rather than a terminal Project outcome.

Reopening a previously achieved Milestone makes a completed Project open again. The Event Log
retains the earlier completion and later reopening instead of rewriting history.

## Settled: conversational semantic transitions

Consequential Work transitions use an `intent -> requirements -> commit` interaction:

1. An agent expresses an intent such as achieving a Milestone or abandoning a Project.
2. Falcon evaluates the current object and returns a structured `input_required` result when the
   command lacks required information.
3. That result describes the missing fields, conversational prompt, input type, limits, and
   relevant current context.
4. The agent may supply or gather that information over multiple OpenClaw conversation turns.
5. A complete command is validated and committed atomically with its domain events.

No database transaction remains open between turns. Falcon does not persist a half-finished
transition merely because a conversation is gathering its payload. OpenClaw owns the conversation;
Falcon persists the successful transition, bounded rationale, actor, timestamp, and optional
related Work or source references.

The structured requirement description must be usable both as an agent tool result and as a UI
control such as a textarea. Missing information is an actionable domain response, not a cryptic
validation failure.

## Settled: Milestone achievement at the current level of detail

- Each Milestone has an observable success condition.
- An agent explicitly requests achievement; Falcon does not infer it merely because associated
  Tasks happen to be complete.
- Achievement records a bounded explanation of why the success condition is met. `Achievement
basis` is the current working term for this explanation and its optional references; it is not a
  separate Proof object.
- Relevant Task results, Question answers, Decisions, verified Change Requests, current Findings,
  and native source references may support the achievement basis.
- Mere association or `contributes_to` does not prove the gate.
- Falcon does not impose human confirmation before ordinary Milestone achievement.
- Project completion follows automatically when the achievement closes the final required
  Milestone.

Changing an underlying answer or Finding does not silently rewrite a historical achievement. The
agent may reopen the Milestone with a reason when the new information means the exit condition no
longer holds. The exact stale-support warning behavior remains open.

## Current implementation differences

The following target changes are not implemented yet:

- the database and API still contain Phase records and `phase_id` assignments;
- Project lifecycle still has directly commanded draft, planned, active, paused, completed,
  cancelled, and archive behavior;
- Project completion still depends on a separate completion-criteria structure and a direct
  completion command;
- Milestone achievement currently commits through the existing command/error contract rather than
  the structured multi-turn `input_required` contract;
- contextual OpenClaw session links do not yet exist in Work persistence.

Current implementation details remain documented in [../work-management.md](../work-management.md)
until the schema, commands, projections, and tests migrate together.

## Open decisions

- Exact Milestone achievement payload, rationale field name, and length limit.
- Whether Milestone order is a strict gating constraint or primarily presentation order.
- How required Work differs from supporting Work in the relationship model.
- Which outcomes for Task, Question, Decision, and Change Request qualify as successful support.
- Whether changed supporting Work only creates an attention flag or can ever reopen a Milestone
  automatically.
- What abandonment does to unfinished associated Work.
- Rules for adding, removing, editing, or reordering Milestones after execution begins.
- Whether Project completion criteria disappear entirely in favor of required Milestones.
- Project readiness and health projections after manually controlled Project states are removed.
- Cardinality and retained purpose for Plans, Findings, Tags, Automaton Project context, generic
  relationships, and the remaining audited objects.
- Cardinality, purpose vocabulary, and lifecycle for Falcon-owned context-to-OpenClaw-session
  links.

Resolve these questions in [#363](https://github.com/fdsouvenir/falcon-dash/issues/363), then amend
this file. Implementation must not silently decide them through a convenient schema or component
shape.
