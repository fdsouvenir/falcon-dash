# Falcon Dash v3 — Work Lifecycle, Authority, and State Transitions

> Consolidated from approved contract [#327](https://github.com/fdsouvenir/falcon-dash/issues/327) on 2026-07-22.

## Objective

Define type-specific states, legal transitions, authority boundaries, approval semantics, waiting versus blocking, idempotency, and contradiction prevention across every v3 Work object.

## Scope

- Per-object status enums rather than one universal status list
- Transition guards and required transition metadata
- Ownership versus authority
- Approval state versus execution state
- Waiting, blocking, pausing, cancellation, completion, and archival
- Idempotent mutation behavior
- Optimistic concurrency and stale-write handling
- Cross-field and cross-object consistency rules

## Deliverables

- State machine for every actionable object
- Transition authorization matrix
- Structured error contract for invalid transitions
- Completion and cancellation requirements

## Approved foundation: semantic transition commands

V3 has no universal status machine. Every object retains its type-specific lifecycle while one shared transition engine enforces legal source-to-destination transitions, required metadata, actor authority, optimistic concurrency, idempotency, side effects, reconciliation, and Falcon Dash Event Log emission.

Agents and UI clients issue semantic commands such as complete_task, answer_question, authorize_change, pause_automaton, or complete_project rather than directly patching lifecycle fields into arbitrary combinations. The server deterministically applies status, timestamps, version increments, derived effects, and event-outbox records in one canonical transaction.

Every command includes expected_version and an idempotency key where retries are possible. Invalid commands return structured errors such as transition_not_allowed, transition_requirements_not_met, authority_required, authorization_invalid, version_conflict, or invariant_violation, including the valid alternatives or missing requirements. Repeating an already-achieved semantic transition returns a successful no-op.

## Approved: Project lifecycle

Project lifecycle states are draft, planned, active, paused, completed, and cancelled. Archived is not a lifecycle status; archived_at is an orthogonal visibility/retention treatment that preserves whether the Project completed or was cancelled.

Semantic transitions:

- plan_project: draft to planned
- activate_project: planned or paused to active
- pause_project: active to paused
- complete_project: active to completed
- cancel_project: any nonterminal state to cancelled
- reopen_project: completed or cancelled to active
- archive_project: sets archived_at without changing lifecycle
- restore_project: clears archived_at

Guards:

- Planning requires desired outcome, scope, owner, and at least one completion criterion.
- Activation requires a valid current Plan or an explicit plan_not_required reason.
- Completion requires all criteria satisfied or waived, no current-next item, no active Project-level blockers, outcome summary, and completion timestamp.
- Cancellation requires a reason and explicit disposition of active child Work.
- Reopening requires a reason, revised completion state, and a new current-next item.
- Archived Projects reject ordinary mutations until restored.
- Repeated completion, archival, or restoration of an already-achieved state is an idempotent no-op.

This corrects the domain RFC Project status list: archival never erases the historical lifecycle outcome.

## Approved: Phase lifecycle

Phase lifecycle is planned to active to completed, with planned or active to skipped and explicit reopening. Activating normally completes the previously active Phase or requires an explicit parallel-phase exception. Completion requires all required Phase Work terminal; optional Work may remain. Skipping requires a reason and disposition of unfinished Work. Empty Phases cannot become active. Phase transitions never automatically change Project lifecycle.

## Approved: Milestone lifecycle

Milestone lifecycle is planned to achieved or cancelled, with explicit reopening. Achievement requires the observable success condition, achieved_at, and source references unless waived. Contributing Work does not automatically achieve the Milestone unless a deterministic rule fully proves the condition. Cancellation and reopening require reasons. Sequence and schedule state never alter lifecycle. Repeated achievement with the same supporting result is an idempotent no-op.

Phase completion and Milestone achievement are evaluated independently: Phase is route structure; Milestone is proof that a meaningful condition became true.

## Approved: Task lifecycle

Task lifecycle is backlog to ready to in_progress, then either completed directly or in_review to completed. ready and in_progress may transition to waiting; resume returns to ready or in_progress. Any nonterminal state may be cancelled. Completed or cancelled Tasks may be explicitly reopened to ready.

Commands: ready_task, start_task, wait_task, resume_task, submit_task_for_review, accept_task, complete_task, cancel_task, and reopen_task.

Guards and semantics:

- ready_task requires an owner and enough definition to act.
- start_task requires no active blocker and valid governing authorization when applicable.
- wait_task requires structured waiting-on, reason, resume condition, and optional follow-up time; resume clears waiting metadata.
- submit_task_for_review requires an output/result and moves the Task to in_review.
- An in_review Task requires an approving Review of the current output revision before completion; changes requested return it to in_progress.
- Tasks never submitted for review may complete directly when other completion requirements are met.
- There is no separate review_required or review_policy structure. Governing Plan acceptance criteria or Authorization conditions may require submission for Review without recreating the Review artifact.
- Completion requires result_summary and completed_at. Cancellation and reopening require reasons.
- Blocking is derived and never rewrites Task lifecycle; blocked takes visual precedence over waiting when both apply.
- Completed and cancelled Tasks retain no active waiting metadata or blocker relationships.
- Repeated identical transitions are idempotent no-ops.

## Approved: Question lifecycle

Question lifecycle is open to answered or withdrawn. Answered and withdrawn Questions may be explicitly reopened to open. Answer revision is separate from Question lifecycle.

Commands: answer_question, withdraw_question, reopen_question, and revise_answer.

Guards and semantics:

- Answering requires answer text, answerer, timestamp, and confidence. Supported factual answers require compact source references; an authoritative answer may use the recorded human source.
- Withdrawal applies only to unanswered Questions and requires a reason.
- Reopening requires a reason explaining why the prior answer or withdrawal is insufficient.
- Revising an answer preserves the prior immutable revision and leaves lifecycle answered.
- Working hypotheses never change lifecycle.
- Answering flags remaining investigation Tasks for reconciliation but never completes them or creates Decisions automatically.
- Blockers auto-resolve only when their deterministic resolution condition says this authoritative answer is sufficient.
- Repeating the same answer from the same authoritative source is an idempotent no-op.

## Approved correction: Decision lifecycle without draft or submit

This section supersedes the earlier Decision lifecycle where it conflicts. There is no canonical draft and no submit_decision verb. create_decision requires a decision-ready package and creates pending directly.

Lifecycle: pending may become deferred, decided, or withdrawn; deferred may resume to pending, become decided, or be withdrawn. A decided commitment is immutable and may only be replaced by a new pending Decision linked through supersedes.

Verbs: create_decision, decide, defer_decision, resume_decision, withdraw_decision, revise_decision, and supersede_decision. Revision replaces a pending/deferred package with a new immutable version while preserving history. Creation requires the full prompt, context, stakes, consequence, authorized deciders, at least two materially distinct options, and recommendation.

Repeated identical authorized outcomes are idempotent no-ops.

## Approved: Change Request lifecycle

Change Request has two canonical state machines. Execution: not_started, in_progress, paused, succeeded, failed, cancelled, and rolled_back. Verification: not_started, in_progress, passed, failed, and waived. Authorization state is automatically derived from Authorization artifacts as missing, valid, expired, revoked, invalidated, or consumed.

Verbs: create_change, authorize_change, start_change, pause_change, resume_change, succeed_execution, fail_execution, retry_change, cancel_change, start_verification, pass_verification, fail_verification, waive_verification, start_rollback, and complete_rollback.

Execution requires valid Authorization pinned to current Change and Plan revisions, rechecked before every governed action. Success and verification remain separate facts. Verification requires every criterion satisfied or validly waived. Retry is legal only inside current Authorization; scope-changing remediation requires revision and renewed Authorization. Rollback preserves original execution history. Effective display state is derived. Completion means succeeded execution plus passed or validly waived verification. All identical repeated transitions are idempotent no-ops.

There is no embedded Change review state or separate Change draft workflow. Review uses Review artifacts; Plan owns evolving method; Authorization owns permission.

## Approved correction: Automaton lifecycle over one aggregate

This section supersedes the earlier desired-versus-effective and drift model. Automaton lifecycle is paused, active, and deleted; there is no canonical draft. create_automaton creates the complete OpenClaw runtime object plus Falcon extension attributes and defaults to paused. activate_automaton and pause_automaton mutate OpenClaw enabled state directly. update_automaton modifies the same OpenClaw object and relevant Falcon attributes with concurrency protection. delete_automaton removes runtime execution and preserves the Falcon restoration snapshot/history. restore_automaton recreates runtime and returns paused.

Direct OpenClaw creation, editing, enabling, disabling, or deletion acts on the same Automaton and is reflected in Falcon Dash; it does not create drift. Missing/unreachable runtime and failed cross-component operations are health or operation errors, not lifecycle states. Runs affect health but not lifecycle. Repeated identical lifecycle operations are idempotent.

## Approved: Plan lifecycle

Plan revision lifecycle is draft to submitted, then superseded or withdrawn. Review disposition is separately derived as unreviewed, approved, changes_requested, or rejected.

Verbs: create_plan, update_plan for drafts only, submit_plan, revise_plan, and withdraw_plan. Submitted Plans are immutable. revise_plan creates a linked draft replacement; the prior revision becomes superseded only when the replacement is submitted. A rejected or changes-requested Plan remains submitted with that Review outcome. Approval targets only the exact revision and does not authorize execution.

## Approved: Review and Authorization lifecycle semantics

Review has no lifecycle. create_review produces one immutable point-in-time outcome: approved, changes_requested, rejected, or commented. Pending review is represented by the subject being submitted or in_review, not an empty Review. Changing judgment creates another Review; current disposition is derived.

Authorization effectiveness begins valid and may become expired, revoked, invalidated, or consumed. grant_authorization creates a pinned immutable grant. Expiration is derived from time; invalidation from subject/Plan/scope mismatch; consumption follows exercising one-time authority. revoke_authorization requires actor, timestamp, and reason. Terminal Authorizations never become valid again; renewed authority creates a new artifact. Effective validity is checked before every governed action. Repeated terminal operations are idempotent no-ops.

## Approved: Finding validity and Area lifecycle

Finding uses validity rather than lifecycle: current may become superseded or retracted. create_finding requires source references. supersede_finding creates a linked replacement without rewriting the original. retract_finding requires actor, timestamp, reason, and corrective source when applicable. Terminal Findings never return to current.

Area lifecycle is active to archived with explicit restoration. archive_area never changes contained Work and requires reassignment of active Work or an explicit exception. restore_area reopens assignment. merge_area moves assignments/policies, archives the source, and preserves a permanent redirect. Areas are not normally deleted. Identical repeated operations are idempotent.

## Approved correction: no Run lifecycle in Falcon Dash

Run has no Falcon Dash lifecycle or artifact. OpenClaw exclusively owns Run creation, status, timing, delivery, output, usage, and history. Falcon Dash provides a read-through view inside Automaton UI only. Semantic problems produce Findings referencing the OpenClaw Run; they do not create Run assessments. Remove Run from lifecycle deliverables.

## Approved correction: no domain-level IAM or RBAC

This section supersedes the earlier cross-cutting authority matrix. Falcon Dash v3 has one human and one agent and no real identity-management, organizational-role, or authentication-policy system. It must not simulate IAM through owner, reviewer, decider, authorizer, executor, Project, or Area roles.

OpenClaw/Falcon Dash access control remains the actual security boundary. created_by, decided_by, reviewed_by, and authorized_by are attribution/provenance fields, not permission principals. The server enforces object state, revision matching, transition guards, required Reviews, and valid Authorization artifacts before governed execution. Fred approval sources provide authority provenance; the agent is the normal executor.

Future multi-user IAM requires an explicit identity/session/organization design and is outside v3. Current cross-cutting enforcement is state and Authorization validation, not RBAC.

## Approved: structured command errors

Every semantic command failure returns a machine-stable error code, concise human message, relevant object/revision/state context, and only useful valid commands or next actions. Expected classes include not_found, invalid_transition, validation_failed, revision_conflict, authorization_required, authorization_invalid, and runtime_unavailable. Unknown commands, flags, fields, and filters fail loudly. Repeated identical mutations remain idempotent. CLI failures use stable nonzero exit codes; internal API transport remains JSON.

## Final cross-cutting lifecycle contract

### Concurrency and idempotency

- Every mutable canonical record carries an integer `version`.
- A command that can change canonical state requires `expected_version`. A mismatch returns `revision_conflict` with the current version and no partial effects.
- Retriable mutations require an idempotency key scoped to command, target, and caller context. Reuse with the same normalized payload returns the original result; reuse with a different payload returns `idempotency_conflict`.
- A command, its derived canonical changes, relationship reconciliation, and Event Log outbox entry commit atomically.
- Cross-system Automaton operations report partial-operation failure explicitly. They never manufacture a Falcon lifecycle state to conceal runtime failure.

### Waiting, blocking, and pausing

- `waiting` is Task lifecycle metadata for intentional idleness pending a named response, event, or time. It requires `waiting_on`, reason, and resume condition.
- A Blocker is an independent active relationship proving that an explicit constraint prevents action. Blocking is derived and never becomes a universal lifecycle state.
- A Task may be waiting and blocked simultaneously; blocked takes display precedence.
- Project health derives from its current-next item and Project-level Blockers. Later blocked Work creates risk, not a falsely blocked Project.
- `paused` means execution was deliberately stopped while the object remains viable. It is never inferred from waiting, blocking, runtime unavailability, or inactivity.

### Completion, cancellation, reopening, and archival

- Completion is legal only when the object-specific completion contract is satisfied. Children, relationships, or elapsed time never imply completion unless an approved deterministic rule proves it.
- Cancellation requires a reason and disposition of nonterminal dependent Work. It never deletes history.
- Reopening requires a reason, clears stale terminal metadata, increments version, and preserves the prior terminal event.
- Archival is visibility/retention treatment, not a substitute for completion or cancellation.
- Terminal objects cannot retain active waiting metadata or active Blockers. The transition must resolve, invalidate, or reject them atomically.

### Contradiction prevention

- Lifecycle fields are command-owned; clients cannot patch them directly.
- Derived fields such as health, authorization effectiveness, review disposition, progress, blocked state, and current action are read-only projections.
- Review never grants execution authority. Authorization never substitutes for Review. A valid Authorization is pinned to the exact governed subject, revision, Plan revision, scope, and validity conditions.
- Superseded revisions are immutable and cannot receive new execution, Review, or Authorization actions.
- Deleting or archiving a referenced object never silently removes history; relationship reconciliation must preserve a tombstone, redirect, or explicit invalidation.
- No attribution field is an IAM principal. State and Authorization guards are the v3 enforcement model.

### Final lifecycle deliverables

- The per-object state machines and semantic commands in this issue are normative.
- Invalid state combinations are rejected server-side with the structured error contract above.
- V2 migration mapping is removed from this RFC. Migration is not part of the Falcon Dash v3 application contract.

## Approved: actor model and authority classes

V3 records actors without building IAM. Actor identity is credential identity: the server deterministically knows which authenticated connection issued a command — an agent's CLI/API credential or a person's operator-UI session — and records that identity with a historical display-label snapshot on every semantic command, Event Log entry, Review, Authorization, Decision outcome, and answer. Nothing beyond the credential is authenticated; who is behind the intent is never guessed.

- There are exactly three actor classes: person, agent, and system. Person actorship occurs only through the operator UI and is expected to be rare; in normal operation nearly all commands arrive over agent credentials. system is reserved for deterministic internal processes (reconciliation, derived expiry, outbox transfer) and can never grant authority, decide, review, or answer.
- Authority-creating acts — decide, grant_authorization, revoke_authorization, waive_verification, and completion-criterion waivers — require a human authority basis. When the executing actor is a person (operator UI), the session itself is the authority basis and the strongest form of provenance. When the executing actor is an agent (the normal case), the human authority basis is an agent-asserted, auditable claim: the command must carry a source_ref to the explicit human instruction (message or human-statement kind), and the guard enforces presence, shape, and resolvability of that reference. The guard does not and cannot verify intent. The command records both the executing actor and the claimed human authority source.
- The integrity mechanism for asserted authority is auditability, not gatekeeping: authority sources must resolve to the actual native record (for example gateway chat history) so a human can see exactly what was said, and every authority-creating act unconditionally appears in the Mission Control material-recent-changes feed (#330) for routine review.
- An agent may voluntarily route a high-risk act through operator-UI confirmation; the resulting person-session authority basis supersedes the conversational claim. This is agent behavior, not a permission rule; v3 defines no policy machinery forcing it.
- Object-level identity lists (authorized deciders, answerable_by, owner, steward) name specific person or agent identities. They are plain identity references, not roles, groups, or permission grants.
- All other semantic commands are equally available to person and agent actors, subject to the transition guards, Authorization validity checks, and invariants defined in this RFC. There is no per-command permission table.
- The transition authorization matrix deliverable therefore reduces to three checks: per-command transition guards, the human-authority-basis requirement on the authority-creating commands above (a person session, or presence and resolvability of the instruction source_ref), and Authorization validity on governed actions. No RBAC, roles, or permission storage exist in v3; a future identity-management design would be a separate contract per #326.
