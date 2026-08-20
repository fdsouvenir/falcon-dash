# V5 Work Domain Decisions

> **Status: accepted direction under active audit; not current runtime behavior.**
>
> Working issue: [#363](https://github.com/fdsouvenir/falcon-dash/issues/363). Last reconciled:
> 2026-08-20.

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

## Settled: multi-agent is a product-wide foundation

- Every Falcon Dash surface and Work contract must support installations with multiple OpenClaw
  agents. No schema, command, projection, queue, contextual conversation, or UI control may assume
  one implicit global agent.
- OpenClaw owns the canonical agent inventory and runtime identity. Falcon stores typed references
  to those agents where durable assignment or context requires them; it does not create competing
  Falcon-owned agent profiles.
- Assignment and action provenance are separate facts. A Work item may identify an assigned agent,
  while every command and Event Log entry records the agent or human that actually performed it.
- Shared all-agent views remain available, with agent-scoped filters and queues layered on the same
  canonical Work data.
- A missing, disabled, or removed upstream agent reference remains visible as historical or
  unresolved assignment state rather than being silently reassigned.
- The exact OpenClaw identity reference, assignment cardinality, claim and reassignment commands,
  and contextual-session linkage will be reconciled against the current upstream beta before the
  target schema is finalized.

## Settled: Project, Milestone, and Phase

The target planning model is:

```text
Project = bounded outcome
Milestone = ordered exit gate or outcome checkpoint
Task / Question / Decision = Work used to reach the gate
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

## Settled: no canonical Project current-next item

- Remove `current_next_item_id` from Project.
- Remove the semantic command and reconciliation behavior that manually select or clear one next
  Task, Question, or Decision.
- A Project projection exposes its current ordered Milestone and the nonterminal Work associated
  with that Milestone instead of naming one canonical next item.
- The agent determines the next useful action from that context and its conversation with the user.
  A suggested next action may appear as ephemeral presentation state, but it is not canonical Work
  data and must not drive Project lifecycle or health.
- Milestone or Work transitions cannot create a false `missing current next item` inconsistency,
  because no such pointer exists in the target model.

## Settled: Project and Task Plan placement and revision history

- Project does not carry a separate Plan artifact. Its desired outcome, ordered Milestones, and
  associated Work already provide the useful Project-level planning structure.
- A Task may carry a Plan. A Task Plan describes a deliberately planned approach, ordered steps,
  assumptions, boundaries, risks, and validation before or during execution.
- Plans are optional. An agent may execute a Task directly from a sufficiently clear instruction,
  or it may create a Plan first when deliberate planning is useful. No ordinary Task lifecycle
  state requires a Plan merely to make the Task actionable.
- One Task has one logical Plan represented by an ordered chain of immutable revisions. A Plan is
  contextual to its Task rather than a separate Work object or global destination, and it does not
  duplicate the Task title.
- Every persisted Plan revision is immutable from insertion. Revising a Plan creates a complete new
  snapshot with a required bounded revision reason and a link to the revision it supersedes. It
  never edits the prior snapshot or marks the prior row as superseded.
- Task stores the current Plan revision reference. That single pointer determines which revision is
  applicable; revisions do not duplicate mutable `is_current` state.
- Falcon does not persist a mutable Plan draft. OpenClaw may develop the Plan across conversation
  turns, but Falcon commits it only when the required revision payload is complete. The semantic
  command surface creates the first revision or revises the current one; it does not expose an
  in-place `update_plan` command or a separate submit ceremony.
- Normal Task context includes only the current Plan revision. Revision-history reads return compact
  metadata such as revision number, time, actor, and reason; a prior body or computed diff is loaded
  only when explicitly requested. Event Log entries reference the revision and reason rather than
  copying its full content.
- Execution progress does not mutate a Plan or create a revision. Task state, results, and activity
  record what happened. If per-step execution tracking later earns persistence, it must reference a
  Plan revision without rewriting that revision.
- Removing Project Plans also removes the current Project activation rule that selects one attached
  Plan and the undefined possibility of several competing Project Plans.
- Bounded field shapes and migration from the current standalone Plan entities remain part of the
  Task audit.

## Settled: Change Request is not a Work type

- Remove Change Request as an independent Work type. A Task is the durable identity for executable
  work, including work that changes code, configuration, data, infrastructure, or production.
- Consequential execution may add a Task-scoped change-control boundary. That boundary records the
  authorized scope, targets, safety and rollback requirements, acceptance criteria, and execution
  evidence without creating a second title, owner, Area, Project, Milestone association, Plan, or
  general Work lifecycle.
- The control boundary is shown and acted on through its Task. It does not receive a global Change
  list or an independent detail destination.
- A direct user instruction may supply the authority for its exact scope. Falcon must not demand a
  duplicate approval merely because the implementation mutates code, configuration, or data.
  Questions, brainstorming, and speculative requests do not authorize execution.
- When authorization applies to a governed Task, it identifies the exact change-control revision
  and, when the authorized scope relies on a Plan, the exact Task Plan revision. A Plan is not
  required solely to create an authorization. A later material revision cannot silently inherit
  authorization for different work.
- The exact storage name, revision model, activation rule, and migration from existing Change
  Requests remain part of the Task and governance audit.

## Settled: Task lifecycle at the current level of detail

The target Task statuses are:

```text
open -> ready -> in_progress -> completed
                   |    ^
                   v    |
                 waiting

open / ready / in_progress / waiting -> abandoned
```

- `open` means the Task has been captured but is not yet declared executable now. It may still need
  scope, dependencies, or an intentional decision to queue it.
- `ready` means the Task is intentionally eligible to execute. Neither a Plan nor an assignee is
  required for readiness; ready-but-unassigned Tasks remain valid shared-queue work.
- `in_progress` means execution is underway.
- `waiting` means execution cannot usefully continue until a recorded condition changes. Its exact
  entry and resumption rules remain part of the transition audit.
- `completed` records the Task's successful terminal result.
- `abandoned` records that the Task is no longer being pursued without erasing its history. The
  Event Log must preserve abandonment and any later resumption.
- Remove `in_review` as a Task status. Review is orthogonal activity with its own subject, state,
  outcome, and history. A Task remains `in_progress` while review happens; the Task projection may
  expose pending review as contextual state without replacing its execution status.
- Review is optional, but a requested Review is consequential. While that Review remains pending,
  Falcon prevents Task completion and returns the exact Review identity and required next action as
  a structured transition requirement. The request must be resolved or explicitly withdrawn before
  completion can commit.
- A pending Review does not automatically move the Task to `waiting`; the agent may continue work
  while review proceeds and may separately use `waiting` only when execution genuinely cannot
  continue.
- Remove `cancelled` in favor of the product-wide `abandoned` language.
- Blocking remains a derived condition rather than another Task lifecycle status.

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

When one intent discovers several independent requirements, Falcon fans them out into separate
conversation asks or threads. Each ask addresses exactly one subject and can be resolved without
answering the others. The presentation may group those asks under their originating intent, but it
must not collapse them into one broad prompt asking what to do with several unrelated Work items.
Each ask retains correlation to the parent intent and the exact Work object that caused it. The
OpenClaw conversation foundation owns the corresponding thread/session mechanics; this fan-out does
not create Falcon-owned transcripts or partially committed Work transitions.

## Settled: Project abandonment and unfinished Work

- Abandoning a Project never silently cancels, withdraws, detaches, or reassigns its unfinished
  Work.
- Falcon identifies every nonterminal associated Work item before abandonment can commit.
- Each item receives its own contextual ask/thread so its disposition can be decided independently.
- Each ask offers only two domain outcomes: abandon that Work as well, or detach it from the Project
  and keep it as standalone Work in its Area.
- The flow does not offer reassignment to another Project, retention inside the abandoned Project,
  or an open-ended bulk disposition prompt.
- `Abandon this Work` is the consistent conversational action. Its committed type-specific outcome
  may remain cancellation for a Task and withdrawal for a Question or Decision; the final command
  vocabulary remains part of the object-by-object audit.
- Keeping Work standalone removes its Project and Project-local Milestone associations without
  changing its own lifecycle.
- The Project abandonment commits only after every unfinished item has an explicit disposition.
- Terminal Work remains attached as Project history and requires no disposition ask.

## Settled: Milestone achievement at the current level of detail

- Each Milestone has an observable success condition.
- An agent explicitly requests achievement; Falcon does not infer it merely because associated
  Tasks happen to be complete.
- Nonterminal actionable Work associated with the Milestone prevents achievement. For example, an
  unanswered Question associated with the Milestone is a current reason the Milestone cannot be
  closed.
- Falcon returns each unresolved object's identity, type, current state, and relevant next action
  to the agent as a structured transition requirement. It does not reduce that situation to a
  generic validation error.
- The agent must resolve the Work or explicitly change its Milestone association through an audited
  semantic command. An achievement rationale does not override unresolved associated Work.
- Terminal Work no longer blocks achievement even when its terminal outcome is withdrawal or
  cancellation. An answered or withdrawn Question, completed or cancelled Task, decided or
  withdrawn Decision are resolved for this guard. The bounded achievement rationale separately
  explains why the Milestone's success condition is met.
- Achievement records a bounded explanation of why the success condition is met. `Achievement
basis` is the current working term for this explanation and its optional references; it is not a
  separate Proof object.
- Relevant Task results and governed execution evidence, Question answers, Decisions, current
  Findings, and native source references may support the achievement basis.
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
- Plan remains a standalone entity that supports mutable drafts, submission, withdrawal, and
  mutable `is_current` and revision-state flags;
- Change Request remains an independent Work type with its own lifecycle and API commands;
- Task still uses `backlog`, `ready`, `in_progress`, `waiting`, `in_review`, `completed`, and
  `cancelled` rather than the target lifecycle;
- `ready_task` still requires a free-text owner, and Work projections do not yet provide the target
  typed multi-agent assignment and filtering contract;
- contextual OpenClaw session links do not yet exist in Work persistence.

Current implementation details remain documented in [../work-management.md](../work-management.md)
until the schema, commands, projections, and tests migrate together.

## Open decisions

- Exact Milestone achievement payload, rationale field name, and length limit.
- Whether Milestone order is a strict gating constraint or primarily presentation order.
- Exact storage and cardinality of the Milestone-to-Work association.
- Whether changed supporting Work only creates an attention flag or can ever reopen a Milestone
  automatically.
- Rules for adding, removing, editing, or reordering Milestones after execution begins.
- Whether Project completion criteria disappear entirely in favor of required Milestones.
- Project readiness and health projections after manually controlled Project states are removed.
- Bounded Task Plan field and step shapes; retained purpose for Findings, Tags, Automaton Project
  context, generic relationships, and the remaining audited objects.
- Exact storage, activation, revision, and authorization-invalidation rules for Task-scoped change
  control, plus migration rules for existing Change Requests.
- Exact Task transitions, readiness interaction with derived blockers, the status to which an
  abandoned or waiting Task resumes, and which Review outcomes satisfy a requested Review versus
  require revision and another review.
- Task assignment cardinality and semantics, including whether one agent is accountable while
  several agents may collaborate through sessions and activity.
- Cardinality, purpose vocabulary, and lifecycle for Falcon-owned context-to-OpenClaw-session
  links.

Resolve these questions in [#363](https://github.com/fdsouvenir/falcon-dash/issues/363), then amend
this file. Implementation must not silently decide them through a convenient schema or component
shape.
