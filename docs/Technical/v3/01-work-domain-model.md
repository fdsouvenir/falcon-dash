# Falcon Dash v3 — Canonical Work Domain Model

> Consolidated from approved contract [#324](https://github.com/fdsouvenir/falcon-dash/issues/324) on 2026-07-22. The docs in this directory are the authoritative copies of the approved v3 contracts; the issues are the approval record.

## Objective

Define the canonical Falcon Dash v3 Work domain model object by object before implementation. Each object must have one clear job, explicit fields, type-specific lifecycle semantics, invariants, allowed relationships, completion rules, and derived projections.

This is a living RFC. Approved object recommendations will be added as the review proceeds.

> **Edited in place 2026-07-22:** the earlier object sections below were updated to match the later "Approved correction" sections (Decision without draft, Change review not embedded, Automaton as one OpenClaw-backed aggregate, Plan lifecycle vs Review disposition, no Run artifact, source references instead of an Evidence object). The correction sections are retained as the approval record; see issue edit history for prior text.

## Review template for every object

- Purpose and non-purpose
- Canonical fields and types
- Required versus optional fields
- Derived fields that must not be canonical state
- Type-specific lifecycle
- Invariants and legal relationships
- Completion, cancellation, and archival semantics
- AXI default and detail projections
- V2 fields retained, renamed, split, or removed
- Representative canonical record

## Objects in scope

- [x] Project
- [x] Phase
- [x] Milestone
- [x] Task
- [x] Question
- [x] Decision
- [x] Change Request
- [x] Automaton
- [x] Finding
- [x] Area and Tags; Category/Subcategory removed
- [x] Minimal shared identity, timestamps, and versioning envelope

Relationships, blockers, provenance, source references, and cross-object lifecycle rules receive dedicated RFCs but must remain consistent with this model.

## Approved: Project

A Project is a bounded outcome with an explicit finish line. It is not a folder, task list, permanent responsibility, or generic container.

Canonical concepts:

- title and one-sentence summary
- desired outcome
- why it matters
- explicit included and excluded scope
- structured completion criteria with source-backed proof
- optional long-form plan
- project-specific status and health
- owner and Area
- current next actionable item
- project timeline and outcome summary

Project lifecycle: draft, planned, active, paused, completed, cancelled. Archival is orthogonal visibility metadata.

Project health: on_track, at_risk, blocked, unknown. Health is normally derived; an override requires a reason and expiration.

Key invariants:

- A Project cannot parent another Project.
- A Project cannot become active without at least one completion criterion.
- current_next_item_id must reference an active Task, Question, Decision, or Change Request in the Project.
- No free-text Project next_action; the linked current next item is authoritative.
- Completion requires every criterion to be satisfied or explicitly waived, plus completed_at and an outcome summary.
- owner replaces the current owner/operator duplication.
- Project target_at replaces generic due_date.

Derived summaries include open, blocked, and completed Work counts; milestone and completion progress; last meaningful update; and current-next-item summary.

AXI default projection: id, title, status, health, current_next_item.

## Approved: Phase

A Phase is an optional project-local planning section. It groups the route through a Project but is not globally browsable actionable Work.

Canonical concepts:

- project_id
- title and summary
- sequence
- status
- optional start, target, and completion timestamps

Phase status: planned, active, completed, skipped.

Key invariants:

- A Phase belongs to exactly one Project and cannot contain another Phase.
- Tasks, Questions, Decisions, and Change Requests may reference an optional phase_id while still belonging directly to the Project.
- Deleting a Phase unassigns Work; it never deletes Work.
- Small Projects need no Phases.
- One active Phase is the normal default; explicitly parallel Projects may allow more.

## Approved: Milestone

A Milestone is a zero-duration checkpoint proving meaningful progress. It is not a Phase or child-work container.

Canonical concepts:

- project_id
- title and summary
- observable success condition
- status
- optional target and achievement timestamps
- source references
- display sequence

Milestone status: planned, achieved, cancelled. Schedule state such as due_soon or overdue is derived.

Key invariants:

- A Milestone belongs directly to one Project.
- It cannot parent Work and has no owner, priority, next action, waiting state, or approval state.
- Achievement requires achieved_at and source references unless explicitly waived.
- Work contributes to or satisfies a Milestone through explicit relationships.
- Achieving every Milestone does not itself complete the Project; Project completion criteria remain authoritative.

AXI default projection: id, title, status, schedule_state.

Formerly open points, now resolved: parallel active Phases use an explicit parallel-phase exception (#327); the relationship vocabulary for contributes_to and satisfies is finalized in #328; exact storage shape for structured completion criteria and scope lists is a developer implementation decision per #326.

## Approved: Task

A Task is a concrete action. Next step is not an object type; it is a contextual role that a Task, Question, Decision, or Change Request may hold through a Project current-next-item pointer.

Canonical concepts:

- optional Project and Phase membership
- required Area
- action-oriented title and concise summary
- optional completion condition for nontrivial work
- task-specific status and priority
- owner
- optional due timestamp
- structured waiting state
- result summary and terminal timestamps

Task status: backlog, ready, in_progress, waiting, in_review, completed, cancelled.

Key invariants:

- A Task cannot parent another Task.
- phase_id requires project_id and the Phase must belong to that Project.
- The Task is itself the action; remove redundant action and next_action fields.
- Waiting requires structured waiting-on, reason, since, and resume-condition metadata.
- Blocking is derived from active blocker relationships, not stored as Task status.
- Completion requires completed_at; cancellation requires cancelled_at and a reason.
- Controlled mutations require an approved Change Request; approval_required does not belong on Task.
- Repeating a completion mutation on an already-completed Task is an idempotent no-op.

AXI default projection: id, title, status, owner. Context-specific projections may add Project, Phase, priority, due date, and blocker/waiting summary.

## Approved: Plan artifact

A Plan is a first-class, versioned, human-reviewable artifact describing how an agent proposes to tackle a piece of work. It is distinct from the desired outcome, the action itself, and authority to mutate systems.

Canonical concepts:

- attached work_item_id
- immutable version and supersedes_plan_id
- title and summary
- ordered approach steps with expected outputs
- assumptions, risks, out-of-scope boundaries, and validation checks
- revision lifecycle
- author and submission timestamp; review outcomes live on Review artifacts

Plan revision lifecycle: draft, submitted, superseded, withdrawn. Approved, changes_requested, rejected, and unreviewed are Review dispositions derived from Review artifacts, not Plan lifecycle states (see correction below).

Key invariants:

- Submitted Plans are immutable; revisions create a new version.
- Applicable Work exposes a current_plan_id while preserving Plan history.
- Plans may attach to Projects, Phases, Tasks, Change Requests, and Automatons.
- Plan approval means the approach is acceptable; it does not authorize controlled mutation.
- Change Request approval remains the authority boundary for code, configuration, system, data, authentication, deployment, and automation mutations.
- Open Questions are investigated through related Tasks with Plans rather than carrying execution Plans directly.

Remove the mutable free-text Project plan field in favor of versioned Plan artifacts.

## Approved: Question

The canonical object is Question, not Open Question. Open is lifecycle state; an answered object must not remain an answered Open Question. V2 open_question migrates directly to v3 question.

A Question represents missing knowledge that materially affects work. It is not a choice, approval request, investigation Task, or casual conversational question.

Canonical concepts:

- optional Project and Phase membership
- required Area
- syntactically explicit question
- context and impact
- question-specific status and priority
- steward responsible for driving resolution
- structured answerable_by identities
- optional source-backed working hypothesis
- structured, versioned answer
- optional target timestamp

Question status: open, answered, withdrawn.

Key invariants:

- Steward and answerable_by are different roles.
- Rename proposed_answer to working_hypothesis; it must carry confidence and source references when present.
- Investigation is performed through related Tasks, which may carry Plans.
- Choices and commitments belong in Decisions.
- Answered status requires answer text, answerer, timestamp, confidence, and applicable source references.
- Re-answering preserves the prior answer as history.
- Withdrawal requires a reason.
- Blocking is represented through relationships, not a single blocked_item_id field.
- Answering resolves applicable Question blocker links but does not silently complete related Tasks.

AXI default projection: id, question, priority, answerable_by. Fred-facing projections may add impact and waiting age.

## Approved: Decision

A Decision represents a choice or commitment requiring an authorized decider. It is not an unanswered fact, ordinary review, investigation Task, or vague approval request.

Canonical concepts:

- optional Project and Phase membership
- required Area
- title and explicit decision prompt
- context, stakes, and consequence of no decision
- decision-specific status and priority
- structured authorized deciders
- at least two structured options with stable IDs, tradeoffs, risks, and evidence
- evidence-backed recommendation referencing an option
- structured immutable decision outcome and authority basis
- optional needed-by timestamp

Decision status: pending, deferred, decided, withdrawn. There is no draft state; create_decision validates the complete decision-ready package and creates the Decision directly as pending (see correction below).

Key invariants:

- At least two materially distinct options are required at creation; the Decision is created decision-ready.
- Recommendation must reference a listed option and remains distinct from the actual Decision.
- Options and recommendation are immutable once created; material changes create a new immutable revision.
- Decided status requires selected outcome, authorized decider, timestamp, rationale, and authority basis.
- Historical commitments are never rewritten; changed commitments require a superseding Decision.
- Deferral and withdrawal require reasons.
- Investigation belongs in Questions, Findings, and Tasks; execution approach belongs in Plans.
- Plan review, routine Task review, and controlled Change authorization are not automatically separate Decisions.
- Repeating the same Decision outcome is an idempotent no-op.

AXI general projection: id, title, status, deciders. Fred-facing projection: id, prompt, recommendation, consequence_of_no_decision.

## Approved: Change Request

A Change Request is the authority envelope for controlled mutation. It defines exactly what may change, where, under what constraints, who authorized it, and how successful completion will be judged. The attached Plan explains the proposed method; it is not itself authority.

Canonical concepts:

- optional Project and Phase membership
- required Area
- title and summary
- explicit allowed and prohibited scope
- structured systems/resources/operations targets
- structured risk level, impact, likelihood, and failure modes
- safety preconditions, stop conditions, and rollback strategy
- structured acceptance criteria
- pinned current Plan revision
- independent execution and verification state machines
- structured authorization record
- result summary

Review disposition is derived from Review artifacts and Authorization state is derived from Authorization artifacts; neither is embedded Change state (see correction below).

Execution state: not_started, in_progress, paused, succeeded, failed, cancelled, rolled_back.

Verification state: not_started, in_progress, passed, failed, waived.

Key invariants:

- Controlled mutation cannot begin without authorization pinned to the exact Change Request revision, Plan revision, scope fingerprint, authorizer, source, timestamp, conditions, and optional expiration.
- Material scope, target, risk, or Plan changes invalidate authorization and require renewed approval.
- Plan approval accepts the approach but does not authorize mutation.
- Remove verification_plan. Plan describes execution/validation method; acceptance criteria define observable success; verification evidence records what actually proved each criterion.
- Execution success and verification success remain distinct.
- Verification cannot pass until every criterion is satisfied or explicitly waived with authority and rationale.
- Completion requires successful execution, passed or authorized-waived verification, and a result summary.
- Failure, cancellation, and rollback are separate outcomes with preserved history.
- Read-only investigation and ordinary internal Work maintenance do not inherently require Change Requests; governed mutations and external side effects do.

AXI projections vary by queue: review shows title, review state, risk, scope, and Plan state; execution shows title, execution state, and authorization validity.

## Superseded proposal: Automaton control plane with mirrored state and Run artifacts

Replaced in full by "Approved correction: Automaton is one OpenClaw-backed aggregate" and "Approved correction: no Falcon Dash Run artifact" below. The rejected proposal mirrored OpenClaw runtime state into Falcon Dash with desired-versus-actual reconciliation, management states (managed, discovered, drifted, missing, operation_failed, ignored), and a Falcon-owned immutable Run artifact per execution. See issue edit history for the full superseded text.

Still true from that proposal: the user-facing object is Automaton, plural Automatons; cron terminology stays out of ordinary product UI; deletion is recoverable via a restoration snapshot; and the AXI default projection is id, title, lifecycle state, health.

## Approved: Finding artifact

Finding remains first-class, but as an attached knowledge artifact rather than a Work item. It records a durable evidence-backed conclusion and remains outside action queues, ownership, priority, scheduling, blocking, and Project current-next-item semantics.

The distinction is:

- Sources record what was directly observed; the observations stay in their native systems, referenced through source_refs (there is no Evidence object — see correction below).
- Finding records what those sources mean.

Canonical concepts:

- optional Area and Project scope
- one or more attached Work/artifact targets
- title, conclusion statement, and significance
- confidence
- source references
- current, superseded, or retracted validity
- author, observation timestamp, and recording timestamp
- supersession and structured retraction metadata

Confidence: tentative, supported, confirmed.

Validity: current, superseded, retracted.

Key invariants:

- A Finding requires source references.
- It states a conclusion, not an intended action.
- Material corrections create a superseding Finding; history is never silently rewritten.
- Retraction requires reason, actor, timestamp, and supporting sources.
- Confirmed confidence requires primary or directly verified sources.
- Findings may answer Questions, inform Decisions, justify Changes, and motivate Tasks through relationships.
- If action is required, create related actionable Work rather than turning the Finding itself into Work.
- Finding is grouped with Plan, Authorization, and Review as a first-class artifact.

AXI default projection: id, title, confidence, validity. Detail adds conclusion, significance, source summary, and observed timestamp.

## Approved: Area, Tags, and removal of Category/Subcategory

Area is the single durable organizational boundary. Category and Subcategory are removed in v3. Lightweight many-to-many Tags provide optional cross-cutting classification without lifecycle, ownership, hierarchy, or authority semantics.

An Area represents an enduring sphere of responsibility and has no finish line.

Canonical Area concepts:

- stable ID
- title and summary
- active or archived state
- timestamps
- optional separate routing, authority, and visibility policy references

Area state: active, archived.

Key invariants:

- Areas are flat; an Area cannot parent or contain another Area.
- Area has no required owner. Ownership belongs on actionable Work.
- Optional default assignment, stewardship, approval, or visibility rules are policy attachments rather than Area ownership.
- Every top-level actionable Work item belongs to one Area; Project-attached Work inherits the Project Area by default but may explicitly differ when valid.
- Artifacts inherit Area from attachments unless independently scoped.
- Archiving an Area never archives its Work; active Work must be reassigned or covered by an explicit exception.
- Normal UI does not delete Areas. Merges preserve history and redirects.

Tags are optional, non-hierarchical, many-to-many descriptors used for technologies, sources, themes, clients, locations, and reporting. They never replace Area, Project, Phase, or semantic relationships.

V2 Category/Subcategory migration classifies each record as Area, Tag, merge, archive, or manual review. It must not mechanically promote every existing category to an Area.

AXI Area projection: id, title, active_work_count, health; counts and health are derived.

## Approved: minimal shared entity envelope

V3 shares only identity, Area, audit timestamps, and optimistic-concurrency metadata. It does not preserve the v2 universal nullable business-field envelope.

Canonical shared fields:

- id
- type
- area_id
- created_at
- updated_at
- version

There is no workspace_id. Falcon Dash Work spans OpenClaw agents and filesystem workspaces; agent/workspace execution context belongs only on relevant Plans, Runs, Change targets, or Automaton runtime context. If Falcon Dash later becomes multi-tenant, tenancy is an explicit infrastructure boundary rather than an overloaded OpenClaw workspace field.

Type-specific records own title, summary, lifecycle, ownership, priority, Project/Phase membership, timing, waiting, result, Plan linkage, approval, execution, verification, and deletion semantics.

Database shape:

- minimal shared entity identity table
- type-specific Work tables for Projects, Tasks, Questions, Decisions, Change Requests, and Automatons
- project-local planning tables for Phases and Milestones
- separate artifact tables for Plans, Findings, Authorizations, and Reviews, plus the transactional event outbox (see Falcon Dash Event Log below)

Key invariants:

- Optimistic mutations require expected_version and fail with a structured version_conflict instead of last-write-wins.
- Every mutation emits an immutable actor/source-aware audit event with before/after changes and version transition.
- Actor references use person, agent, or system identity with authoritative ID and historical display-label snapshot; actor identity is credential identity per the #327 actor model.
- Some approved/submitted records use immutable revision or supersession semantics beyond the general version counter.
- Deletion is type-specific rather than one generic deleted_at behavior.
- AXI projections omit envelope metadata unless explicitly requested or operationally relevant.

## Approved correction: lightweight source references, no Evidence object

V3 does not create a first-class Evidence artifact or automatically retain every tool result. Claims that need traceability carry compact source_refs pointing to the native source: message ID, OpenClaw session/tool-call ID, Automaton Run ID, commit SHA, file path/hash, URL, screenshot path, or external record ID.

Only high-value ephemeral proof such as authorization, destructive Change verification, major Findings, and rendered acceptance may be selectively snapshotted. Ordinary sources remain in their native systems and may later show source unavailable.

The UI presents Sources or Verified by links on relevant claims and criteria. Source attachment may be deterministic when a structured check is launched for a known target, explicitly selected by an agent when creating a Finding, or attached by a human. If no source is linked, the record cannot claim sourced or verified status.

## Approved: Blocker relationship

A Blocker is a specialized, historical relationship explaining what actionable Work cannot proceed, what prevents it, and the observable condition that resolves it. It is neither a Work object nor a generic lifecycle status.

Canonical concepts:

- blocked actionable Work reference
- blocker reference to Work, person, agent, system, or external dependency
- reason and observable resolution condition
- optional unblock Task
- active, resolved, or invalidated state
- creator and creation timestamp
- structured resolution actor, timestamp, summary, and optional source references

Key invariants:

- Only Task, Question, Decision, Change Request, or Automaton may be directly blocked. Project health derives from its current next item; Milestones derive impact from contributing Work.
- Blocking never rewrites the blocked object lifecycle.
- Self-blocking and duplicate active blockers are invalid or idempotent no-ops.
- Resolution preserves history and requires actor, timestamp, and summary. Invalidated means the relationship was wrong or ceased to apply.
- Deterministic resolution rules may auto-resolve; otherwise completion or answering only suggests resolution.
- Waiting is intentional idleness pending a known response/time; blocking is an explicit constraint preventing progress.

## Approved: constrained semantic relationship links

V3 uses a narrow typed link table rather than a free-form knowledge graph. Initial relationship vocabulary: contributes_to, satisfies, investigates, informs, motivates, implements, and depends_on. Blockers remain specialized records because they require richer lifecycle and resolution semantics.

Containment, Plan attachment, sources, supersession, runtime binding, and Change authorization remain explicit fields or specialized records rather than generic links. The generic relates_to relationship is prohibited.

Key invariants:

- Every relation has one canonical direction; the UI may render its inverse.
- Allowed source-target combinations are enforced and exposed contextually by the API.
- Self-links and duplicate links are invalid or idempotent no-ops.
- depends_on cycles are invalid.
- contributes_to does not imply satisfaction; satisfies requires a terminal supporting result.
- Cross-Area links are allowed. Removing a link emits an audit event.
- Agents create links only when they materially improve navigation, understanding, or derived state.

AXI list projections omit raw links. Detail views show compact relationship aggregates with full links available explicitly.

## Approved: Review artifact

A Review is an immutable evaluation of a specific artifact or Work revision and the outcome generated by that evaluation. It supports Plan review, Task output review, Change Request review, and similar review surfaces without duplicating review metadata across every object.

Canonical concepts:

- exact subject type, ID, and revision
- reviewer identity
- approved, changes_requested, rejected, or commented outcome
- concise summary
- optional section-addressed comments with required or advisory severity
- compact source references
- submission timestamp

Key invariants:

- A Review always targets an exact immutable revision.
- Reviews are immutable; reconsideration creates another Review.
- New material subject revisions invalidate approval of earlier revisions.
- Multiple reviewers create separate Review records.
- Required comments must be resolved in a revision before approval.
- Subject review state is derived from Reviews rather than independently edited.
- Plan approval means the proposed approach is acceptable but does not authorize controlled mutation.
- Task output review is ordinary acceptance, not a strategic Decision.
- Repeated identical submissions with the same idempotency key are no-ops.

The Review preserves both the evaluation and its resulting disposition. It is not a Decision artifact because it does not choose among strategic options or establish a broader commitment.

## Approved: Authorization artifact

Authorization records permission to perform a governed action: who allowed exactly what, under which conditions, and for how long. It remains distinct from Review because accepting an approach and authorizing controlled execution are not always the same act.

Canonical concepts:

- exact governed subject type, ID, and revision
- exact Plan ID and revision when applicable
- scope fingerprint
- authorizer identity
- enforceable conditions
- authorization and optional expiration timestamps
- compact source references
- valid, expired, revoked, invalidated, or consumed state

Key invariants:

- Authorization pins the exact Change Request revision, Plan revision, and scope fingerprint.
- Material scope, target, risk, or Plan changes invalidate it.
- Conditions are enforceable execution boundaries, not review comments.
- Revocation preserves actor, timestamp, and reason.
- consumed represents one-time authority such as one external send or destructive action.
- Repeatable authority requires explicit expiration or a governing policy and never silently becomes permanent.
- Effective validity is checked immediately before each governed action, not only when work begins.
- A direct imperative may generate both a Review outcome and Authorization while preserving their separate meanings.
- Authorization may cite a Decision as its authority basis.

Critical agent-interface requirement: every actionable projection automatically includes compact derived authorization state whenever authority matters: valid, missing, expired, revoked, or invalidated with a short reason. The agent never has to remember to ask whether authorization exists. Full conditions, scope, source, and authorizer are fetched before execution or during diagnosis.

## Approved infrastructure: Falcon Dash Event Log

The Falcon Dash Event Log is deterministic infrastructure, not a Work object or artifact. It provides audit history, object timelines, derived meaningful-update timestamps, and debugging without requiring manual creation or LLM generation.

V3 uses two databases from day one:

1. The canonical Falcon Dash Work database stores operational objects, planning structures, artifacts, relationships, and a small transactional event outbox.
2. A separate append-only Falcon Dash Event Log database stores durable domain events. High-volume runtime logs remain outside both.

Every meaningful canonical mutation writes its corresponding outbox row in the same database transaction. A deterministic worker idempotently transfers outbox rows into the Event Log database, confirms persistence, and prunes delivered rows after a safety window. This preserves mutation/event reliability without allowing years of event volume to increase canonical database contention, backup size, checkpoint cost, vacuum cost, or blast radius.

Event Log rules:

- structured schemas and deterministic summaries per controlled event type
- append-only; corrections generate new events
- actor, subject, timestamp, version transition, safe payload, and optional compact source references
- secrets never enter event payloads
- routine reads and high-frequency execution noise do not create domain events
- UI timelines are projections of selected event types
- old event partitions may be archived independently without touching canonical Work data
- no normal UI object, no manual creation workflow, and no LLM dependency
- UI timelines, the agent history command, and derived meaningful-update timestamps read from the Event Log through the server API; nothing reads the outbox except the transfer worker
- outbox transfer lag and failed publication are observable operational states surfaced through health/diagnostics, never silent

## Approved correction: Decision is created decision-ready

This section supersedes the earlier Decision lifecycle details where they conflict. Decision has no canonical draft state. Research, missing inputs, and unfinished option development belong in Questions, Tasks, Findings, and Plans. A temporary unsaved UI form is not a domain object.

create_decision validates the complete Decision package and creates it directly as pending. Canonical states are pending, deferred, decided, and withdrawn. The object retains prompt, context, stakes, consequence of no decision, authorized deciders, at least two structured options, recommendation, optional needed-by timestamp, structured outcome, deferment/withdrawal metadata, and supersession links.

Pending Decision packages may be revised only through a new immutable revision. Decided outcomes are never rewritten; a changed commitment requires a new Decision linked through supersedes.

## Approved correction: Change review is not embedded state

This section supersedes earlier Change Request review-state details where they conflict. Change Requests carry canonical execution and verification state machines; Authorization state is derived from Authorization artifacts. Review feedback and outcomes remain Review artifacts and are not duplicated as an embedded Change review_state.

create_change requires the complete authority-ready package, including scope, targets, risk, safety boundaries, acceptance criteria, and current Plan. Plan handles evolving execution design; Change has no separate draft workflow. Effective user-facing state is derived from execution, verification, and Authorization.

## Approved correction: Automaton is one OpenClaw-backed aggregate

This section supersedes all earlier Automaton mirroring, backing-provider, discovery-projection, and drift-management language where it conflicts. Product-wise and semantically, a Falcon Dash Automaton and its OpenClaw runtime job are one entity. Technically, the aggregate is composed from the live OpenClaw record plus Falcon Dash extension attributes keyed by the same OpenClaw ID.

OpenClaw remains authoritative storage for its native runtime fields. Falcon Dash does not duplicate them. The current runtime schema includes id, name, enabled, agentId, sessionKey, sessionTarget, wakeMode, schedule, payload, delivery, state, created/updated timestamps, and derived run/delivery fields. Falcon Dash stores only additional attributes such as Area/Project context, summary, Plan, authority, policies, assessed health/results, and recoverable deletion history. The API composes both into one Automaton representation.

Creating or editing through Falcon Dash mutates the same OpenClaw object seen by agents and the OpenClaw Control UI. Creating or editing directly through OpenClaw changes that same Automaton and Falcon Dash reflects it; there is no persistent desired-versus-actual copy and no drift state. Concurrent edits use version/ETag conflict handling.

Directly created OpenClaw jobs appear automatically as Automatons with sparse Falcon attributes. Direct deletion deletes the runtime component and Falcon Dash preserves the restoration snapshot/history. Restore recreates the OpenClaw component and reconnects the Falcon attributes. User-facing language remains Automaton/Automatons; cron terminology and internal composition remain implementation details.

Remove managed, discovered, drifted, missing, operation_failed, and ignored as management states. Runtime reachability and failure are health/operation outcomes, not competing lifecycle state.

## Approved correction: Plan lifecycle versus Review outcome

Plan revision lifecycle is draft, submitted, superseded, or withdrawn. Approved, changes_requested, rejected, and unreviewed are derived Review dispositions, not Plan lifecycle states.

Draft Plans are mutable. Submitted Plans are immutable. revise_plan creates a new draft revision; the prior submitted revision becomes superseded only when its replacement is submitted. Withdrawal requires a reason. Work points to the current applicable Plan revision. Approval applies only to the exact submitted revision and never grants execution authority.

## Approved correction: no Falcon Dash Run artifact

This section supersedes all earlier Run artifact, assessment, normalized Run history, and generated-Work-on-Run design. Runs belong entirely to OpenClaw and are not Falcon Dash domain objects or extension records. Falcon Dash reads and displays OpenClaw Run history inside the Automaton view without copying or annotating it.

If a Run reveals a meaningful issue that OpenClaw status does not capture, create a normal Finding linked to the Automaton with the OpenClaw Run as a compact source_ref. Action follows through ordinary Task or Change Request relationships. Automaton health may surface active Findings, but Falcon Dash never overwrites, reinterprets, or stores parallel Run status. There is no need for Falcon-specific stable Run identity.
