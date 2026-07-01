# Work

Work is Falcon Dash's operator queue and agent-facing source of truth.

Use `/work` for an executive status board across active projects, operator decisions, blocked or
waiting work, near-term dates, and recent activity. Falcon Dash opens to Work by default; `/`
redirects to `/work`.

## What It Shows

- Executive signals for work needing your call, at-risk work, near-term dates, and recent changes.
  These signals jump to the matching overview section instead of opening an arbitrary item, and
  avoid clipped preview snippets that are hard to read at a glance.
- Purpose-built overview sections for due-next work, operator asks, blocked or waiting work, and a
  single chronological recent activity log. The due-next section appears before the ask/risk
  sections so near-term action is visible first.
- Type-specific pages for projects, next steps, open questions, decisions, change requests,
  findings, and automations
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
- `/work/projects`, `/work/next-steps`, `/work/open-questions`, `/work/decisions`,
  `/work/change-requests`, `/work/findings`, `/work/automations` -- type-specific lists optimized
  for each standalone Work shape
- `/work/settings` -- category and subcategory setup, opened from the Work settings gear
- `/work/{section}?q=...&status=...&focus=...` -- shareable type-list filters. Projects use
  project filters such as `focus=blocked`; next steps use due filters such as `focus=due-this-week`;
  open questions and decisions use answer/review filters such as `focus=needs-answer`.
- `/work/{type}/{id}` -- routeable standalone detail page for one Work item

The top Work search field navigates to `/work/search` and searches existing agent-managed Work
records. It does not create new work. Direct capture or manual creation controls are intentionally
absent from the primary Work shell until an explicit capture workflow exists.

Desktop quick inspectors and detail pages expose lightweight state controls for status, priority,
and waiting state. Narrative fields such as title, next action, notes, description, and results are
shown as agent-managed record content rather than casual text editors.

The desktop Projects section is a searchable, filterable project list rather than a list-plus-form
workspace. Project rows render as separated multi-line rows with a numbered title, short blurb,
next step, status, coming-up, open-work, blocker, and update columns. Desktop rows highlight on
hover only, and double-clicking opens the full project page. The project page is a ledger-style
operating brief: goal, definition of done, why it matters, scope, current next step, blockers, and
waiting state lead into a project plan where milestone groups contain their related next steps,
decisions, open questions, and change requests. Milestones are short checkpoints inside the
project, not separate pages; the project right rail includes an Add milestone control for a title
and one-sentence description. Work that is not attached to a milestone appears as project-level
work, while automations, findings, activity, and health/status context remain supporting sections.

Open questions and decisions are separate. An open question captures unresolved knowledge; a
decision captures a commitment or approval with options and a recommendation. Change requests are
reserved for controlled mutation of code, config, systems, data, auth, deployment, or automation.

Categories and subcategories are setup records rather than front-and-center Work item lists. Work
settings presents them as a grouped directory where rows are selected for editing in the right-side
form. Top-level category and subcategory creation starts from the action strip above that editor;
when a category is selected, `Add subcategory` preselects it as the parent. Deleting a category or
subcategory removes that directory entry and leaves any linked Work items unassigned.

## Agent Contract

Agents should use `/api/work/*` or generated context files:

- `WORK.md`
- `WORK-API.md`
- `FALCON-DASH.md`
- `Work/W-{id}.md`

In normal conversation and UI copy, refer to items by object type and ID, such as
`Change Request 176` or `Project 4`. The `W-` prefix is only for generated context filenames.

The former work interface is not part of active Falcon Dash.
