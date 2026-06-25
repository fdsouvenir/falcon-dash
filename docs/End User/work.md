# Work

Work is Falcon Dash's operator queue and agent-facing source of truth.

Use `/work` for an executive status board across active projects, operator decisions, blocked or
waiting work, near-term dates, and recent activity.

## What It Shows

- Executive signals for work needing your call, at-risk work, near-term dates, and recent changes.
  These signals jump to the matching overview section instead of opening an arbitrary item.
- A project health table that treats projects as outcomes and shows health, upcoming dates, next
  moves, concrete supporting work counts, and blockers
- Purpose-built overview sections for operator asks, blocked or waiting work, due-next work, and a
  single chronological recent activity log
- Type-specific pages for projects, change requests, questions, tasks, routines, and observations
- Type pages with a list on the left and a quick inspector on the right. Row clicks select the
  inspector in place; they do not open a random or appended detail view.
- Standalone detail pages for individual Work items. These pages show type-aware context, blockers,
  related work, and read-only narrative fields.
- Observation feed for captured findings, events, and evidence
- Work data generated from the new `~/.openclaw/data/falcon-dash/work.db` database

## Pages

- `/work` -- dashboard overview across all Work types
- `/work#needs-you`, `/work#at-risk`, `/work#due-next`, `/work#recent` -- focused overview sections
- `/work/search?q=...` -- read-only search across existing Work records
- `/work/projects`, `/work/changes`, `/work/decisions`, `/work/tasks`, `/work/routines`,
  `/work/observations` -- type-specific lists optimized for each Work shape
- `/work/{type}/{id}` -- routeable standalone detail page for one Work item

The top Work search field navigates to `/work/search` and searches existing agent-managed Work
records. It does not create new work. Direct capture or manual creation controls are intentionally
absent from the primary Work shell until an explicit capture workflow exists.

Quick inspectors and detail pages expose lightweight state controls for status, priority, and
waiting state. Narrative fields such as title, next action, notes, description, and results are
shown as agent-managed record content rather than casual text editors.

In UI copy, `/work/changes` is labeled **Change requests** because those items are implementation
or configuration work that may need approval. `/work/decisions` is labeled **Questions** because
those items are choices that need an answer before related work can move.

Areas remain part of the Work data model as evergreen grouping buckets, but they are not a primary
operator tab. They can be maintained by agents or database tooling until the product needs an
explicit area-management workflow.

## Agent Contract

Agents should use `/api/work/*` or generated context files:

- `WORK.md`
- `WORK-API.md`
- `FALCON-DASH.md`
- `Work/W-{id}.md`

In normal conversation and UI copy, refer to items by object type and ID, such as `Change 176` or
`Project 4`. The `W-` prefix is only for generated context filenames.

The former work interface is not part of active Falcon Dash.
