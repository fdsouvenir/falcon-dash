# Falcon Dash v3 — Operator Work UI

> Consolidated from approved contract [#330](https://github.com/fdsouvenir/falcon-dash/issues/330) on 2026-07-22.

> **Closeout amendment (2026-08-06, #344):** the final surface uses the plain product names **Work** and **Automations**. Page chrome omits eyebrows, taglines, object-type explanations, and repeated counts. Counts appear once in section headings; compact status strips and row-oriented lists replace equal-card mosaics.

## Objective

Build a human-first operator surface for the approved v3 Work model without flattening every object into one queue.

## Scope

- Work overview and actionability queues
- Project portfolio and detail with Milestones, chronological work, finish-line criteria, sources, and history
- Needs Resolution and approval experiences
- Object-specific detail and editing surfaces
- Relationship, blocker, source, and provenance views
- Search, filtering, and navigation
- Desktop information hierarchy; a dedicated mobile experience remains a later roadmap item

## Acceptance direction

Rendering is not completion. Verify the real interface at target desktop and mobile viewports for hierarchy, density, clipping, overlap, typography, accessibility, and usability.

## Final operator UI contract

### Information architecture

Falcon Dash v3 has five primary Work destinations:

1. **Work** — current action, needs-operator queues, blocked risk, unhealthy Automations, and material recent changes.
2. **Projects** — outcome portfolio and Project detail with current-next, Milestones, finish-line criteria, active Work, and history.
3. **Needs Resolution** — Questions, Decisions, Reviews, and Authorizations requiring human attention.
4. **Automations** — the Falcon view of live OpenClaw automations, including configuration, health, next execution, and native Run history.
5. **Browse** — search and filter across Tasks, Changes, Plans, Findings, Areas, and archived/terminal Work.

Object types keep distinct detail experiences. The UI must not flatten everything into generic cards or one universal status board.

### Portfolio, focus, and Browse

- The Projects index starts with one compact control strip and the portfolio rows; it does not
  repeat the Work navigation with a back link, page title block, health cards, or a second list
  heading. A lifecycle selector sits beside counted focus filters. Focuses are `Blocked`,
  `At risk`, `Needs next`, `Overdue`, and `Stale`; needs-next applies only to active Projects.
  The Project reader supplies health, current-next details, target time, summary, progress, and
  update time.
- Project rows sort attention first and present lifecycle and attention as plain text. Major state
  is not a badge. Pills remain appropriate for filter controls, tags, and small governance facts.
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

### Work overview

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

### Project detail

- Header: ID, outcome, plain-language lifecycle and attention state, compact progress, and visible
  contextual actions. One recommended lifecycle action and Edit stay visible; rare or destructive
  actions live under More. The page does not use a giant all-actions disclosure.
- Main work stream: Tasks, Questions, Decisions, and Changes ordered by due date, with overdue
  first, nearest upcoming dates next, and undated items last. Current-next is marked in place and
  never reorders the stream.
- Milestone grouping: Work linked to a Milestone sits beneath that ordered exit gate. Work without
  a Milestone stays as an ordinary chronological row; there is no "Unassigned work" section.
- Finish line: completion criteria form a separate checklist. Criterion waivers remain confirmed
  authority acts.
- Milestones: ordered exit gates with success conditions, schedule state, sources, and local
  lifecycle actions. A standalone Phase layer is not exposed in the Project UI.
- Sources use `Sources` or `How we know`; the page never labels this area `Proof` or surfaces
  contribution/satisfaction ontology as its primary language.
- History is collapsed by default and keeps lifecycle events, supersession, Reviews,
  Authorizations, sources, and completed outcomes available without displacing current work.
- An archived Project is read-only until restored.

### Human decision and approval surfaces

- Needs Resolution keeps four independently labeled expandable sections: Questions, Decisions,
  Reviews, and Authorizations. Expansion exposes a semantic command bar scoped to that exact row.
- Needs Resolution reads the complete Authorization work set rather than the overview's bounded
  queue slice. Authority-ready Plans sort ahead of Change Requests whose Plans are not submitted.
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

### Automations

- The Automaton screen edits the same OpenClaw-backed object, not a mirrored Falcon configuration.
- Lifecycle, health, and native Run outcome use distinct semantic tone maps.
- Show paused/active/deleted lifecycle, trigger or schedule, payload summary, delivery, health, next execution, and recent native Runs.
- Runtime unavailability or failed updates appear as operation/health errors, never drift or a fake lifecycle state.
- Deleted Automations expose restoration history and restore to paused.
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

- Validate Work, Project, Needs Resolution, Decision, Change Request, Automation, and Browse at
  representative desktop viewports. Narrow layouts must remain safe, but a dedicated mobile view
  is outside v3.
- Acceptance includes hierarchy, density, typography, focus order, touch targets, clipping, overlap, long content, empty states, loading, errors, and stale-version recovery.
- Screens must remain usable with realistic high-density data and long titles, not only fixtures designed to fit.
- Visual implementation choices remain with the developer, but the object distinctions and interaction semantics above are mandatory.
