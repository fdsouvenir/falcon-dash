# Work

Work is Falcon Dash's operator queue and agent-facing source of truth.

Use `/work` for an executive status board across active projects, operator decisions, blocked or
waiting work, near-term dates, and recent activity. Falcon Dash opens to Work by default; `/`
redirects to `/work`.

## What It Shows

- Executive signals for work needing your call, at-risk work, near-term dates, and recent changes.
  These signals jump to the matching overview section instead of opening an arbitrary item, and
  avoid clipped preview snippets that are hard to read at a glance.
- A project portfolio pulse that summarizes open project count, blocked work, overdue work,
  decisions needed, projects without a next move, stale projects, and the overall health mix.
- Purpose-built overview sections for operator asks, blocked or waiting work, due-next work, and a
  single chronological recent activity log
- Type-specific pages for projects, change requests, questions, tasks, routines, and observations
- Desktop type pages with the section title above fixed search/filter controls, a scrollable item
  list, and a quick inspector on the right. Single clicks select and highlight a row in place;
  double clicks open that item's standalone detail page.
- Mobile type pages skip the quick inspector. Tapping a row opens the standalone detail page
  directly.
- Standalone detail pages for individual Work items. These pages show type-aware context, health
  reasons, literal blockers, related work, and read-only narrative fields. Question detail pages use
  a sectioned Question Brief so long agent-written Markdown plans remain scannable.
- A Work integrity panel on detail pages for checking stale state, opening a scoped agent session,
  and reviewing recent reconciliation runs.
- Observation feed for captured findings, events, and evidence
- Work data generated from the new `~/.openclaw/data/falcon-dash/work.db` database

## Pages

- `/work` -- dashboard overview across all Work types
- `/` -- redirects to `/work`
- `/work#needs-you`, `/work#at-risk`, `/work#due-next`, `/work#recent` -- focused overview sections
- `/work/search?q=...` -- read-only search across existing Work records
- `/work/projects`, `/work/changes`, `/work/decisions`, `/work/tasks`, `/work/routines`,
  `/work/observations` -- type-specific lists optimized for each Work shape
- `/work/{section}?q=...&status=...&focus=...` -- shareable type-list filters. Projects use
  portfolio filters such as `focus=blocked`; tasks use due filters such as `focus=due-this-week`;
  questions use answer/review filters such as `focus=needs-answer`.
- `/work/{type}/{id}` -- routeable standalone detail page for one Work item

The top Work search field navigates to `/work/search` and searches existing agent-managed Work
records. It does not create new work. Direct capture or manual creation controls are intentionally
absent from the primary Work shell until an explicit capture workflow exists.

Desktop quick inspectors and detail pages expose lightweight state controls for status, priority,
and waiting state. Narrative fields such as title, next action, notes, description, and results are
shown as agent-managed record content rather than casual text editors.

Falcon Dash also runs Work integrity reconciliation after Work changes. When structured
relationships prove that a blocker, dependency, or decision is stale, the dashboard can update the
related Work and record an audit run. When the next move is ambiguous, it opens a contextual agent
session tied to the Work item so the agent can resolve the stale state with the right project
context.

In UI copy, `/work/changes` is labeled **Change requests** because those items are implementation
or configuration work that may need approval. `/work/decisions` is labeled **Questions** because
those items are choices that need an answer before related work can move.

Areas remain part of the Work data model as evergreen grouping buckets, but they are not a primary
operator tab. They can be maintained by agents or database tooling until the product needs an
explicit area-management workflow.

## Agent Contract

Agents should use `/api/work/*` or generated context files:

- `WORK.md` -- compact current-state home view with queue counts, visible empty states, item
  summaries, and next-command templates
- `WORK-API.md` -- endpoint reference and mutation examples
- `FALCON-DASH.md` -- generated context location and Falcon Dash module guidance
- `Work/W-{id}.md` -- full detail for one active Work item

In normal conversation and UI copy, refer to items by object type and ID, such as `Change 176` or
`Project 4`. The `W-` prefix is only for generated context filenames.

The former work interface is not part of active Falcon Dash.
