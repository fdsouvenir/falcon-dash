# V5 Task Aggregate Synthesis

> **Status: proposed target contract synthesized from accepted decisions; not current runtime
> behavior.**
>
> The semantic decisions in [work-domain-decisions.md](work-domain-decisions.md) are accepted. Exact
> table and column names in this document are implementation recommendations until the replacement
> schema is approved in [#363](https://github.com/fdsouvenir/falcon-dash/issues/363).

## Outcome

A Task is Falcon Dash's durable identity for a bounded piece of executable work. The Task root owns
only facts needed to answer its current lifecycle and accountability questions. Content that must
remain historically truthful lives in immutable, Task-owned revisions or checkpoints.

```text
Task
├── current Definition revision       required; immutable history
├── current Plan revision             optional; immutable history
├── current Result checkpoint         optional; immutable history
├── current Change Control revision   optional; immutable history
├── current Wait episode              only while waiting
├── accountable OpenClaw agent        optional external reference
└── explicit links
    ├── Project and Milestones
    ├── dependencies on other Work
    ├── exact artifact reviewed by this Task
    └── OpenClaw sessions/conversations
```

Plans, Result checkpoints, Definition revisions, and Change Control revisions are not Work. They do
not get independent list pages, Areas, Projects, assignees, or general lifecycles. A review is an
ordinary Task with an exact artifact target. Blocker and Change Request do not survive as objects.

## Ownership boundary

Falcon owns:

- the Task identity, lifecycle, Project placement, and accountable-agent reference;
- immutable Task Definitions, Plans, Result checkpoints, and governed-change snapshots;
- typed links from the Task to Milestones, other Work, exact artifacts, and OpenClaw context;
- persisted Asks needed to finish a semantic command;
- command idempotency, domain events, warnings, and read projections.

OpenClaw owns:

- agent profiles and whether an agent currently exists or is available;
- sessions, conversations, threads, transcripts, messages, runs, tools, and approvals;
- execution activity that has not been deliberately reported to Falcon;
- the conversation in which an agent gathers missing command input.

Falcon therefore stores resolvable OpenClaw locators, not copied agent profiles or transcripts. A
missing upstream agent or session remains an unresolved historical reference instead of being
silently reassigned or deleted.

## Recommended logical schema

This is a logical contract, not migration-ready SQL. The existing `entities` envelope continues to
provide `id`, `area_id`, creation and update timestamps, and optimistic `version` for a Task.

### `tasks`

| Field                                | Purpose                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `entity_id`                          | Task identity and link to the entity envelope.                                             |
| `project_id`                         | Optional owning Project. `NULL` means standalone Work in its Area.                         |
| `status`                             | `open`, `ready`, `in_progress`, `waiting`, `completed`, or `abandoned`.                    |
| `status_changed_at`                  | Efficient current-state age and list sorting; full history remains in the Event Log.       |
| `accountable_agent_id`               | Optional OpenClaw agent identifier. It is an external reference, not a Falcon foreign key. |
| `current_definition_revision_id`     | Required pointer to the exact Definition presented as the current Task.                    |
| `current_plan_revision_id`           | Optional pointer to the one currently applicable Plan revision.                            |
| `current_result_checkpoint_id`       | Optional pointer to the currently applicable candidate or accepted Result.                 |
| `current_change_control_revision_id` | Optional pointer to the currently applicable governed-change boundary.                     |
| `current_wait_id`                    | Required exactly when `status = waiting`; otherwise `NULL`.                                |

The row does not repeat `title`, `description`, `done_when`, Plan content, Result prose, waiting
prose, agent display names, participant lists, progress percentages, or terminal reasons. Those
facts either have their own truthful record or are projections.

`priority` and `due_at` are intentionally absent from this accepted core. They should be restored
only after the scheduling audit defines who sets them, what decisions they change, and how stale or
conflicting values behave.

### `task_definition_revisions`

Every Task begins with revision 1. A revision is a complete immutable snapshot rather than a patch.

| Field                              | Purpose                                                     |
| ---------------------------------- | ----------------------------------------------------------- |
| `id`, `task_id`, `revision_number` | Identity, ownership, and deterministic ordering.            |
| `supersedes_revision_id`           | Exact prior Definition, absent only for revision 1.         |
| `title`                            | Compact action label for scanning and linking.              |
| `description`                      | Context, scope, rationale, constraints, and instructions.   |
| `done_when`                        | Observable finish line.                                     |
| `revision_reason`                  | Required bounded explanation after revision 1.              |
| `created_at`, author snapshot      | Audit provenance without resolving mutable upstream labels. |
| `source_refs`                      | Optional exact native sources supporting the Definition.    |

The Task pointer is the only `current` marker. There is no mutable `is_current` flag. Normal reads
join only the current revision; history lists metadata and reasons before loading an old body or
computed diff on demand.

### `task_plan_revisions`

A Task has zero or one logical Plan and any number of immutable revisions. There is no parent Plan
entity and no mutable draft, submit, withdraw, or Plan status.

Each revision records its Task, exact Task Definition revision, revision number, superseded Plan
revision, bounded revision reason, author and time, and a complete structured Plan payload. The
payload remains split into presentation-worthy regions rather than one undifferentiated brief.
Candidate regions are approach, ordered steps, assumptions, boundaries, risks, and validation.
Their requiredness, bounds, and step shape still need the Plan-content audit.

Execution does not mark immutable Plan steps complete. Activity and Result checkpoints record what
actually happened. Falcon should not claim the Plan is an execution engine.

### `task_result_checkpoints`

A Result checkpoint is a meaningful candidate result, analogous to a commit in the history of
trying to accomplish the Task. It is not emitted for every tool call, message, or failed attempt.

| Field                                | Purpose                                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| `id`, `task_id`, `checkpoint_number` | Identity, ownership, and deterministic ordering.               |
| `task_definition_revision_id`        | Exact Definition the result claims to address.                 |
| `plan_revision_id`                   | Optional exact Plan revision used during execution.            |
| `supersedes_checkpoint_id`           | Optional prior candidate this result replaces.                 |
| `summary`                            | Bounded statement of what was accomplished or produced.        |
| `validation`                         | Structured checks performed and their outcomes.                |
| `output_refs`                        | Native output locators without copying the output into Falcon. |
| `source_refs`                        | Exact supporting sources when relevant.                        |
| `created_at`, author and context     | Audit provenance and the OpenClaw context that produced it.    |

The Task's current pointer selects the applicable checkpoint. While `in_progress`, it is a candidate.
When the Task is `completed`, it is the accepted result for that completion. Reopening clears the
current applicability pointer but preserves the prior accepted checkpoint identifier in the
completion and reopen events. A later completion selects or creates another immutable checkpoint.

Checkpoint churn, validation outcomes, and linked OpenClaw activity may produce a derived loop-risk
warning. They do not create a `looping` status or pretend Falcon controls the agent.

### `task_wait_episodes`

Waiting is lifecycle state, so its current projection and history should be modeled as a Task-owned
episode rather than another Work object.

| Field                                                      | Purpose                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`, `task_id`                                            | Episode identity and Task ownership.                                                               |
| `task_definition_revision_id`                              | Definition in force when waiting began.                                                            |
| `previous_status`                                          | `ready` or `in_progress`, used by ordinary resume.                                                 |
| `waiting_for_kind`, `waiting_for_ref`, `waiting_for_label` | Validated typed reference to Work, Ask, person, agent, event, time, system, or external condition. |
| `resume_when`                                              | Observable condition that makes continuation useful.                                               |
| `follow_up_at`                                             | Optional time to return the Task to attention without auto-resuming it.                            |
| `started_at`, `ended_at`, ending actor and outcome         | Current-state queries and truthful episode history.                                                |

The active episode is closed by resume, completion, or abandonment. Definition revision alone does
not close it. The Event Log records the corresponding semantic transition, while the episode makes
waiting history queryable without reconstructing mutable Task columns.

### `task_context_links`

Falcon needs a durable link to upstream context, not a Falcon Conversation object.

| Field                          | Purpose                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `id`, `task_id`                | Link identity and Task ownership.                                                                 |
| `purpose`                      | Why this context is linked, initially `origin` or `execution`; final vocabulary remains to audit. |
| `openclaw_agent_id`            | Agent that owns the upstream model context.                                                       |
| `openclaw_session_key`         | Upstream session locator.                                                                         |
| `conversation_address`         | Optional upstream external conversation/thread address when delivery requires one.                |
| creation and detach provenance | Audited link lifecycle without deleting the historical locator.                                   |

Store `agent_id` and `session_key` separately even when a session key visibly contains an agent
prefix. Current OpenClaw interfaces address session context with both values, and external
conversation routing is a separate concern. OpenClaw's current session rows also expose metadata
such as channel, parent/child relationships, archive state, and run state; Falcon should resolve
that live or cache it noncanonically rather than copy it into Work.

Multiple context links are allowed. Participating agents are derived from these links and Event Log
actors. There is no mutable `participant_ids` field.

### Task-owned governed change

Consequential work adds an optional chain of immutable `task_change_control_revisions` instead of a
Change Request object. Each revision pins the Task Definition and optionally the Plan revision, and
separates authorized scope, prohibited scope, targets, risk, safety requirements, rollback, and
acceptance criteria. The Task points at the applicable revision.

Authorization remains an immutable governance artifact pinned to the exact Change Control revision
and optional Plan revision. A materially different revision cannot inherit authority silently. The
remaining governance audit must decide exact activation, authorization effectiveness, and evidence
fields before this table is implemented.

## Links outside the aggregate

These records connect the Task to other durable identities. They do not duplicate those objects
inside the Task row.

### Project and Milestones

- `tasks.project_id` gives the Task at most one Project context while permitting standalone Tasks.
- A dedicated Task-to-Milestone association permits a Task to support more than one Milestone.
- Every associated Milestone must belong to the Task's Project.
- Detaching a Task from a Project removes its Project-local Milestone associations atomically.
- Required-versus-supporting association semantics remain a Milestone audit decision; they must not
  be hidden in an overloaded generic `related_to` link.

### Dependencies

A dependency link identifies the dependent Task, prerequisite Work, and the Task Definition revision
under which the link was asserted. Creation and removal have actor and time provenance. Task-to-Task
cycles are invalid because the coordination graph must explain an expected order.

An unresolved dependency contributes a warning and attention item. It does not reject `start` or
`complete`, alter lifecycle automatically, or claim Falcon prevented the agent from acting.

### Review targets

A review Task has one link to the exact immutable artifact it examines: a Definition revision, Plan
revision, Result checkpoint, or Change Control revision. Presence of this link lets projections say
that the ordinary Task is review-focused; it does not create a Review object, status, or queue.

The review Task's own Result checkpoint stores its findings and conclusion. If review is required
before another Task completes, the ordinary dependency link expresses that coordination expectation.

### Asks

An Ask is adjacent coordination state, not part of the Task aggregate and not Work. It records one
subject, one intended semantic command, one missing requirement, the object version evaluated, and
one OpenClaw context link. Pending, resolved, withdrawn, and stale are Ask states, not Task states.

Resolving an Ask submits the complete command again. Falcon revalidates current Task state and
commits a new transaction; it never resumes a transaction or blindly executes a stored mutation.
The start-unassigned Ask is the first required concrete use of this contract.

## Lifecycle and command contract

```text
create -> open <-> ready -> in_progress -> completed
                   |           |
                   +-> waiting <-+

open | ready | in_progress | waiting -> abandoned
completed -> reopened open
abandoned -> resumed open          (recommended default; still to approve)
```

### Commands and outcomes

| Intent                      | Contract                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create                      | Atomically creates the Task and Definition revision 1. New Tasks start `open`.                                                                                                  |
| Revise Definition           | Creates a full revision from `open`, `ready`, `in_progress`, or `waiting`; status and pinned artifacts do not change silently.                                                  |
| Mark ready / return open    | Explicit reversible queue grooming with actor and time, no manufactured reason.                                                                                                 |
| Assign / reassign / release | Changes only accountable assignment. No lifecycle command clears assignment implicitly.                                                                                         |
| Start                       | Starts a `ready` Task. Unresolved dependencies warn. If unassigned, persists or returns the take-this-Task Ask and commits no Task mutation.                                    |
| Take and start              | After Ask resolution, atomically assigns the acting OpenClaw agent and starts after revalidation.                                                                               |
| Wait                        | From `ready` or `in_progress`, requires `waiting_for` and `resume_when`; optional `follow_up_at`.                                                                               |
| Resume waiting              | Restores the Wait episode's previous `ready` or `in_progress` state and closes the episode.                                                                                     |
| Checkpoint Result           | Optionally records an immutable candidate while `in_progress` without changing status.                                                                                          |
| Complete                    | From `open`, `ready`, `in_progress`, or `waiting`, selects an applicable checkpoint or creates one atomically. Coordination conflicts warn but do not veto truthful completion. |
| Reopen                      | Moves `completed` to `open`, clears current Result applicability, and preserves the earlier completion and accepted checkpoint in history.                                      |
| Abandon                     | From any nonterminal state, requires a bounded reason in the event and closes an active Wait episode. It does not clear assignment.                                             |
| Resume abandoned            | Recommended to return to `open`; preserves assignment and abandonment history.                                                                                                  |

Repeated completion of a completed Task is a no-op. An abandoned Task must resume before completion,
and a completed Task must reopen before Definition revision or further execution.

The command result vocabulary must distinguish:

- `committed`: state changed successfully;
- `no_op`: requested truth was already current;
- `input_required`: one or more independently resolvable Asks are needed;
- `committed_with_warnings`: truthful state committed despite coordination discrepancies;
- `rejected`: a Falcon-owned invariant, authorization, or version precondition actually failed.

Warnings are not disguised blockers. They identify the exact dependency, stale pinned revision,
missing upstream reference, or other discrepancy and expose the next meaningful action.

## Aggregate invariants

1. Every Task has exactly one current Definition revision owned by that Task.
2. Every root revision/checkpoint pointer resolves to a child owned by that Task.
3. Definition, Plan, Result, and Change Control records are immutable after insertion.
4. Revision numbers are unique and monotonic within their Task chain; supersession cannot cycle.
5. Plan and Result records pin an exact Task Definition revision.
6. `status = waiting` if and only if `current_wait_id` points to an active Wait episode.
7. `status = completed` requires an exact current Result checkpoint.
8. Assignment is optional, singular, externally owned, and independent of lifecycle.
9. No Task transition changes assignment except an explicit assignment command or atomic take-and-start.
10. Project-local Milestone links cannot survive Project detachment or cross Project boundaries.
11. Dependency cycles are invalid, but unresolved dependencies are never execution-control gates.
12. A completed Task must reopen and an abandoned Task must resume before its Definition changes.
13. A source, context, or agent becoming unavailable never rewrites historical Work automatically.
14. Every mutation is idempotent, version-checked where necessary, and emits an Event Log record with
    actual actor provenance.

## Read projections

The UI and agent interface consume purpose-built projections rather than rendering the normalized
tables directly.

### Task list row

The desktop list needs the current title, bounded description excerpt, status, accountable agent
and upstream-resolution state, Project and relevant Milestones, exact attention reasons, active Wait
summary, Plan/Result presence, participant avatars derived from activity, and latest meaningful
activity time. Priority and schedule appear only if their fields survive the later audit.

This is a dense decision surface, not a card containing every Task field.

### Task detail

The detail projection groups information by the decision it supports:

- identity and lifecycle: title, status, assignment, Project, Milestones;
- Definition: description and `done_when`, with revision history on demand;
- execution: current Plan and exact Definition alignment;
- outcome: current Result checkpoint, validation, outputs, and prior checkpoints on demand;
- coordination: active Wait, dependencies, pending Asks, Questions, and warnings;
- governed execution: current Change Control and authorization state when present;
- collaboration: linked OpenClaw contexts, participating agents, and activity;
- related work: review, remediation, or other explicitly linked Tasks.

### Agent Task context

The default agent read returns the current Definition, lifecycle and assignment, Project/Milestone
context, current Plan, current Result, active Wait, dependency warnings, pending Asks, and relevant
OpenClaw context locators. It returns only compact metadata for earlier Definitions, Plans, Results,
and events. Bodies and diffs are explicit follow-up reads.

### Attention queue

The queue is a typed union projection over Asks, Questions, Decisions, waiting Tasks, review-focused
Tasks, dependency discrepancies, stale pinned artifacts, follow-ups, missing upstream references,
and derived loop risk. Each row retains its true object type and actions. There is no persisted
generic Attention, Blocker, or Review object.

## Data deliberately not persisted on Task

- `phase_id`, Project current-next item, archive state, or a general progress percentage;
- a parallel Task title/summary inside Plan, Result, review, or Change Control;
- `in_review`, `blocked`, or `looping` lifecycle states;
- a participant list inferred from context and activity;
- OpenClaw agent display metadata, session state, transcript, messages, or tool attempts;
- Plan step completion flags that imply Falcon executes the Plan;
- copied current Definition, Plan, Result, or waiting prose on the Task row;
- mutable `is_current`, `superseded`, or `accepted` flags on immutable children;
- abandonment, reassignment, reopen, or revision reasons duplicated outside their immutable record
  or Event Log event.

## Migration requirements

Migration must preserve uncertainty instead of inventing polished replacement data.

- `backlog` becomes `open`; `cancelled` becomes `abandoned`; other direct status equivalents remain.
  An `in_review` Task becomes `in_progress` unless evidence supports creating a separate review Task.
- Current `title`, `summary`, and `completion_condition` seed Definition revision 1. Missing legacy
  description or `done_when` becomes explicit migration attention; migration must not manufacture
  filler that pretends the old record was complete.
- A current free-text owner is resolved to an OpenClaw agent only on an exact match. Otherwise it
  remains visible as an unresolved legacy assignment until reconciled.
- Existing terminal and nonterminal assignments are preserved. No status migration clears owner.
- Current waiting fields seed a Wait episode. Missing typed cause or resume condition becomes
  migration attention rather than a guessed reference.
- A current `result_summary` becomes at most one legacy Result checkpoint. `output_revision` may be
  preserved as migration metadata, but Falcon cannot reconstruct checkpoint bodies that never
  existed.
- Task-attached Plan revisions migrate into the one logical Task chain only when ownership and order
  are unambiguous. Competing Plans are reported for reconciliation rather than merged silently.
- Existing Change Requests become Tasks with governed-change history; migration must not create a
  second Task when an exact existing Task identity is already authoritative without an explicit
  reconciliation rule.
- Existing Reviews become review Tasks or historical activity while preserving reviewer, target
  revision, outcome, comments, and sources.
- Existing Blockers are classified into dependencies, Asks or Questions, Wait episodes, or history
  according to their actual cause. They are not bulk-renamed.
- `phase_id` is removed. Project membership can remain, but migration cannot infer a Milestone link
  merely from Phase order.

## Consequential decisions still open

The Task's core identity and lifecycle are coherent enough to stop revisiting individual status
names. The remaining Task work is concentrated in a few real design boundaries:

1. **Scheduling:** whether priority and due dates earn persistence, including authority, conflict,
   and staleness semantics.
2. **Structured content:** exact fields and bounds for Plan revisions, Result checkpoints, output
   references, and governed-change revisions.
3. **Assignment policy:** who may assign, reassign, or release another agent, and whether resuming an
   abandoned Task always returns to `open`.
4. **Project relationships:** required versus supporting Milestone links and their effect on
   achievement requirements.
5. **OpenClaw context and Asks:** final context-purpose vocabulary, session versus external
   conversation addressing, Ask deduplication/staleness, and detached or missing upstream state.
6. **Artifact reconciliation:** the explicit actions for reaffirming or replacing Plans, Results,
   dependencies, and Change Control pinned to an older Definition.

These should be audited as clusters because each changes commands, projections, migration, and UI.
They should not be decomposed into isolated questions whose answers have no product consequence.
