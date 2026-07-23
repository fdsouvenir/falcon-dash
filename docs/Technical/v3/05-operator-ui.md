# Falcon Dash v3 — Operator Work UI

> Consolidated from approved contract [#330](https://github.com/fdsouvenir/falcon-dash/issues/330) on 2026-07-22. Implementation tracked in #330.

## Objective

Build a human-first operator surface for the approved v3 Work model without flattening every object into one queue.

## Scope

- Mission Control and actionability queues
- Project ledger with Phases, Milestones, current work, criteria, sources, and history
- Needs Resolution and approval experiences
- Object-specific detail and editing surfaces
- Relationship, blocker, source, and provenance views
- Search, filtering, and navigation
- Desktop and mobile information hierarchy

## Acceptance direction

Rendering is not completion. Verify the real interface at target desktop and mobile viewports for hierarchy, density, clipping, overlap, typography, accessibility, and usability.

## Final operator UI contract

### Information architecture

Falcon Dash v3 has five primary Work destinations:

1. **Mission Control** — current action, needs-Fred queues, blocked risk, unhealthy Automata, and material recent changes.
2. **Projects** — Project ledger with outcome, current-next, Phases, Milestones, criteria, active Work, and history.
3. **Needs Resolution** — Questions, Decisions, Reviews, and Authorizations requiring human attention.
4. **Automata** — the Falcon view of live OpenClaw automations, including configuration, health, next execution, and native Run history.
5. **Browse** — search and filter across Tasks, Changes, Plans, Findings, Areas, and archived/terminal Work.

Object types keep distinct detail experiences. The UI must not flatten everything into generic cards or one universal status board.

### Mission Control

- Lead with the smallest set of actions that can materially advance Work.
- Separate `Needs Fred`, `Agent can act`, `Waiting`, `Blocked risk`, and `Automation health`.
- Show why an item is present and the next relevant action.
- Authority-creating acts (decisions, authorizations, revocations, verification waivers, criterion waivers) unconditionally appear in the material-recent-changes feed with their claimed human authority source, resolvable to the original instruction (#327 actor model).
- Routine successful Runs, terminal history, and low-value counts remain out of the first viewport.
- Empty queues state that nothing requires attention; they do not fill space with generic advice.

### Project ledger

- Header: outcome, lifecycle, health, progress, Area, current-next, and material blockers.
- Route: ordered Phases with lifecycle and required Work progress.
- Proof: Milestones and completion criteria with contribution versus satisfaction clearly distinguished.
- Current work: actionable Tasks, Questions, Decisions, Changes, and Plans in Project context.
- History: lifecycle events, supersession, Reviews, Authorizations, sources, and completed outcomes.
- Editing current-next is explicit and cannot point to terminal or unrelated Work.

### Human decision and approval surfaces

- Question view emphasizes prompt, impact, investigation context, sources, and authoritative answer.
- Decision view presents the decision-ready package: stakes, options, recommendation, consequence of delay, and prior superseded decisions.
- Review view shows exact subject revision, content/diff, criteria, sources, and one immutable outcome.
- Authorization view shows exact governed subject/Plan revisions, scope, conditions, expiration/consumption, and source of Fred’s approval.
- Review and Authorization must never be visually conflated.

### Change Request and Plan

- Change Request shows execution, verification, and Authorization as separate facts with a derived overall summary.
- The current Plan revision is readable beside its Review disposition and supersession history.
- Execution controls appear only when the exact revision has valid Authorization.
- Failure, retry, verification, waiver, rollback, and cancellation preserve prior attempts and require their defined metadata.

### Automata

- The Automaton screen edits the same OpenClaw-backed object, not a mirrored Falcon configuration.
- Show paused/active/deleted lifecycle, trigger or schedule, payload summary, delivery, health, next execution, and recent native Runs.
- Runtime unavailability or failed updates appear as operation/health errors, never drift or a fake lifecycle state.
- Deleted Automata expose restoration history and restore to paused.
- Native Run detail is read-through; Falcon Dash creates no Run artifact or assessment object.

### Relationships, provenance, and history

- Detail views expose meaningful blockers, dependencies, supersession, criteria links, and sources in context.
- Sources use `Sources` or `Verified by`, not an Evidence administration surface.
- Default views summarize relationship/source counts; expansion reveals native links and history.
- The Event Log is presented as an auditable timeline without becoming the editable source of current state.

### Interaction and accessibility

- Semantic actions use object-specific language and explain unmet guards inline.
- Destructive, terminal, authority-granting, and execution actions require clear confirmation proportional to risk.
- Optimistic concurrency conflicts preserve unsaved user input and offer refresh/reapply context.
- Keyboard navigation, focus states, labels, contrast, reduced motion, and screen-reader semantics are required.
- Search and filters fail visibly on unsupported fields rather than silently returning misleading results.

### Rendered acceptance

- Validate Mission Control, Project, Decision, Change Request, Automaton, and Browse at representative desktop and mobile viewports.
- Acceptance includes hierarchy, density, typography, focus order, touch targets, clipping, overlap, long content, empty states, loading, errors, and stale-version recovery.
- Screens must remain usable with realistic high-density data and long titles, not only fixtures designed to fit.
- Visual implementation choices remain with the developer, but the object distinctions and interaction semantics above are mandatory.
