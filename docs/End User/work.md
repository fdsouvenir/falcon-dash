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
- Type-specific pages for projects, milestones, next steps, open questions, decisions, change
  requests, findings, and automations
- Desktop type pages with the section title above fixed search/filter controls, a scrollable item
  list, and a quick inspector on the right. Single clicks select and highlight a row in place;
  double clicks open that item's standalone detail page.
- Mobile type pages skip the quick inspector. Tapping a row opens the standalone detail page
  directly.
- Standalone detail pages for individual Work items. These pages show type-aware context, health
  reasons, literal blockers, related work, and read-only narrative fields. Question detail pages use
  a sectioned Question Brief so long agent-written Markdown plans remain scannable.
- Findings feed for captured facts, events, and evidence
- Work data generated from the new `~/.openclaw/data/falcon-dash/work.db` database

## Pages

- `/work` -- dashboard overview across all Work types
- `/` -- redirects to `/work`
- `/work#needs-you`, `/work#at-risk`, `/work#due-next`, `/work#recent` -- focused overview sections
- `/work/search?q=...` -- read-only search across existing Work records
- `/work/projects`, `/work/milestones`, `/work/next-steps`, `/work/open-questions`,
  `/work/decisions`, `/work/change-requests`, `/work/findings`, `/work/automations` --
  type-specific lists optimized for each Work shape
- `/work/settings` -- category and subcategory setup, opened from the Work settings gear
- `/work/{section}?q=...&status=...&focus=...` -- shareable type-list filters. Projects use
  portfolio filters such as `focus=blocked`; next steps use due filters such as
  `focus=due-this-week`; open questions and decisions use answer/review filters such as
  `focus=needs-answer`.
- `/work/{type}/{id}` -- routeable standalone detail page for one Work item

The top Work search field navigates to `/work/search` and searches existing agent-managed Work
records. It does not create new work. Direct capture or manual creation controls are intentionally
absent from the primary Work shell until an explicit capture workflow exists.

Desktop quick inspectors and detail pages expose lightweight state controls for status, priority,
and waiting state. Narrative fields such as title, next action, notes, description, and results are
shown as agent-managed record content rather than casual text editors.

Open questions and decisions are separate. An open question captures unresolved knowledge; a
decision captures a commitment or approval with options and a recommendation. Change requests are
reserved for controlled mutation of code, config, systems, data, auth, deployment, or automation.

Categories and subcategories are setup records rather than front-and-center Work item lists. They
are maintained from Work settings and can be used by agents through the Work API to group projects
and related work.

## Agent Contract

Agents should use `/api/work/*` or generated context files:

- `WORK.md`
- `WORK-API.md`
- `FALCON-DASH.md`
- `Work/W-{id}.md`

In normal conversation and UI copy, refer to items by object type and ID, such as
`Change Request 176` or `Project 4`. The `W-` prefix is only for generated context filenames.

The former work interface is not part of active Falcon Dash.
