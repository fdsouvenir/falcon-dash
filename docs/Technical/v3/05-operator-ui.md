# Falcon Dash v3 — Operator Work UI

> Consolidated from approved contract [#330](https://github.com/fdsouvenir/falcon-dash/issues/330) on 2026-07-22. Implementation tracked in #330.

> **Naming note (2026-07-24, #344):** the shipped destination labels are plain product names — "Mission Control" ships as **Work** (the module's overview/index) and "Automata" ships as **Automations** (`/work/automations`). This doc keeps the original contract names below; the semantics are unchanged, only surface naming. The overview also shipped inbox-first (prioritized item lists with counts inline in headings) rather than hero stat tiles; the queue-bucket contract is unaffected.

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

1. **Mission Control** — current action, needs-operator queues, blocked risk, unhealthy Automata, and material recent changes.
2. **Projects** — Project ledger with outcome, current-next, Phases, Milestones, criteria, active Work, and history.
3. **Needs Resolution** — Questions, Decisions, Reviews, and Authorizations requiring human attention.
4. **Automata** — the Falcon view of live OpenClaw automations, including configuration, health, next execution, and native Run history.
5. **Browse** — search and filter across Tasks, Changes, Plans, Findings, Areas, and archived/terminal Work.

Object types keep distinct detail experiences. The UI must not flatten everything into generic cards or one universal status board.

### Portfolio, focus, and Browse

- The Projects index leads with a portfolio pulse and health distribution. Focuses are `Blocked`,
  `At risk`, `No next move`, `Overdue`, and `Stale`; the Project reader supplies health,
  current-next validity, target time, and update time.
- Browse type selection and focus selection are URL-driven. Counted focus chips cover Tasks
  (`Overdue`, `Blocked`, `Waiting on you`, `In review`, `Ready`), Projects, Changes
  (`Needs authorization`, `Verification pending`, `Failed`), and Finding validity.
- A focus definition declares either a reader-known filter or a predicate over fields already
  present in the list projection. The client does not reconstruct lifecycle, health,
  actionability, Authorization effectiveness, or reconciliation.
- Full-text search highlights snippets without HTML injection. Search failures are visible.
  Terminal and archived results remain inspectable in a collapsed group.
- Browse contains no generic Task or Area creation form. Agent-driven creation remains the v3
  workflow.

### Mission Control

- Lead with the smallest set of actions that can materially advance Work.
- Lead with four drill-down totals: `Needs your call`, combined `At risk`, `Agent can act`, and
  combined `Waiting`. Each total includes the server-supplied object-type breakdown computed before
  bounded queue rows are sliced.
- Separate `Needs operator`, `Blocked risk`, `Governance`, `Waiting`, `Agent can act`,
  `Automation health`, and `Reconciliation` below the summary.
- Keep `Awaiting Review` information-toned and visually distinct from warning-toned
  `Needs Authorization / Verification`; Review never implies permission to execute.
- Split Waiting into keyboard-operable `Agent` and `External` tabs.
- Show why an item is present and the next relevant action.
- Authority-creating acts (decisions, authorizations, revocations, verification waivers, criterion waivers) unconditionally appear in the material-recent-changes feed with their claimed human authority source, resolvable to the original instruction (#327 actor model).
- Subscribe to `/api/work3/events` and debounce targeted `work3:queue` invalidation. EventSource
  unavailability is a silent loss of live refresh, not a page failure.
- Routine successful Runs, terminal history, and low-value counts remain out of the first viewport.
- Empty queues state that nothing requires attention; they do not fill space with generic advice.

### Project ledger

- Header: outcome and lifecycle, with the complete lifecycle command bar available from the
  header disclosure.
- Status: server-derived health, progress, current-next, and independent risk flags for blocked
  next work, blocked items, target/milestone schedule, missing next work, and open criteria.
- Route: ordered Phases with lifecycle and required Work progress across Tasks, Questions,
  Decisions, and Change Requests.
- Proof: Milestones and completion criteria with contribution versus satisfaction clearly
  distinguished. Criterion waivers are confirmed authority acts; Milestone achievement requests
  sources.
- Current work: typed Tasks, Questions, Decisions, and Changes grouped by Phase in Project
  context, with an explicit set-as-next action for eligible items.
- History: lifecycle events, supersession, Reviews, Authorizations, sources, and completed outcomes.
- Editing current-next is explicit and cannot point to terminal or unrelated Work.
- Desktop uses the three-column Project Ledger (section rail, ledger, sticky operating brief).
  The rail hides and the operating brief stacks at narrower widths. Collapsed Phase and Milestone
  composers in the brief are the only operator-UI creation controls.
- An archived Project is a read-only ledger: ordinary Project, Phase, Milestone, and proof
  mutations stay hidden and are rejected by the server until restoration.

### Human decision and approval surfaces

- Needs Resolution keeps four independently labeled expandable sections: Questions, Decisions,
  Reviews, and Authorizations. Expansion exposes a semantic command bar scoped to that exact row.
- Review rows carry the exact submitted revision. Authorization rows carry the current Change
  version and explain a missing prerequisite inline.
- Question view emphasizes prompt, impact, investigation context, sources, and authoritative answer.
- Question context is split into keyboard-operable native disclosure sections; the current answer
  keeps confidence and sources together while immutable answer revisions remain inspectable.
- Decision view presents the decision-ready package: stakes, options, recommendation, consequence of delay, and prior superseded decisions.
- A pending or deferred Decision uses one radio-card outcome form. The recommended option is
  labeled but never preselected or treated as the recorded outcome.
- Review view shows exact subject revision, content/diff, criteria, sources, and one immutable outcome.
- Authorization view shows exact governed subject/Plan revisions, scope, conditions, expiration/consumption, and source of the operator’s approval.
- Review and Authorization must never be visually conflated.

### Change Request and Plan

- Change Request shows execution, verification, and Authorization as separate facts with a derived overall summary.
- The current Plan revision is readable beside its Review disposition and supersession history.
- Execution controls remain visible when the exact revision lacks valid Authorization, but are
  disabled with the unmet Authorization state shown inline. This makes the guard explainable
  without implying that Review disposition grants permission.
- Failure, retry, verification, waiver, rollback, and cancellation preserve prior attempts and require their defined metadata.

### Automata

- The Automaton screen edits the same OpenClaw-backed object, not a mirrored Falcon configuration.
- Lifecycle, health, and native Run outcome use distinct semantic tone maps.
- Show paused/active/deleted lifecycle, trigger or schedule, payload summary, delivery, health, next execution, and recent native Runs.
- Runtime unavailability or failed updates appear as operation/health errors, never drift or a fake lifecycle state.
- Deleted Automata expose restoration history and restore to paused.
- Native Run detail is read-through; Falcon Dash creates no Run artifact or assessment object.

### Relationships, provenance, and history

- Detail views expose meaningful blockers, dependencies, supersession, criteria links, and sources in context.
- Sources use `Sources` or `Verified by`, not an Evidence administration surface.
- Source resolution failure is rendered as an explicit unavailable state with its reason; the UI
  never drops an unresolved reference from an authoritative answer or Finding.
- Default views summarize relationship/source counts; expansion reveals native links and history.
- The Event Log is presented as an auditable timeline without becoming the editable source of current state.

### Interaction and accessibility

- Semantic actions use object-specific language and explain unmet guards inline.
- Destructive, terminal, authority-granting, and execution actions require clear confirmation proportional to risk.
- Optimistic concurrency conflicts preserve unsaved user input and offer refresh/reapply context.
- Keyboard navigation, focus states, labels, contrast, reduced motion, and screen-reader semantics are required.
- Search and filters fail visibly on unsupported fields rather than silently returning misleading results.

The route implementation centralizes those contracts in `src/lib/components/work/`: command forms
are generated from `work3-shared/commands.ts`, failures use one structured feedback surface, and
object statuses use per-domain tone maps rather than a universal lifecycle palette. The shared Work
layout owns the five-destination navigation so detail routes remain focused on their object.
At mobile width, each Command Bar becomes a sticky, safe-area-aware action bar and opens one
selected command form in a focus-trapped bottom sheet. Guarded commands remain selectable so their
unmet reason stays visible. Failed submissions reopen the matching form with the submitted values.

### Rendered acceptance

- Validate Mission Control, Project, Decision, Change Request, Automaton, and Browse at representative desktop and mobile viewports.
- Acceptance includes hierarchy, density, typography, focus order, touch targets, clipping, overlap, long content, empty states, loading, errors, and stale-version recovery.
- Screens must remain usable with realistic high-density data and long titles, not only fixtures designed to fit.
- Visual implementation choices remain with the developer, but the object distinctions and interaction semantics above are mandatory.
