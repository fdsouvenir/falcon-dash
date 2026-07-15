# Frontend Guide

This document captures Falcon Dash frontend constraints that should stay stable across feature work.

## Stack

- SvelteKit 2
- Svelte 5 runes
- Tailwind 4
- shared design tokens in `src/app.css`
- typed UI token helpers in `src/lib/components/ui/design-tokens.ts`

## Core UI Rules

- Extend the warm navy-charcoal V2 surface system in `src/app.css` instead of inventing a new
  palette.
- Use semantic status colors for operational meaning.
- Keep operator surfaces compact and scannable, but avoid visuals that feel like a utilitarian IT
  admin console.
- Prefer soft panel depth, 8px radius, readable sentence-case labels, and clear hierarchy over
  harsh grids, heavy borders, all-caps labels, and dense monospaced chrome.
- Design for low-vision operators by default. Normal UI copy should stay at a readable floor, text
  size preferences must be honored globally, and browser zoom should not create horizontal
  scrolling in normal workflows.
- Prefer existing UI primitives in `src/lib/components/ui/` before building bespoke variants.
- Treat cards as optional containers, not default layout.
- Use the MD3-compatible aliases in `src/app.css` for shape, typography, motion, and semantic color
  while keeping Falcon's own palette. Shared buttons use full-radius silhouettes and cards use
  tonal elevation instead of default drop shadows.

## Shell Model

- Desktop routes render inside `AppShell`.
- Mobile routes render inside `MobileShell`.
- New surfaces should be designed with shell context, not as isolated pages.
- If a route has separate mobile and desktop implementations, verify both.

## Preferred Layout Patterns

- list + detail
- workspace + inspector
- status overview + activity feed
- editor + preview
- inbox + action panel

These fit Falcon Dash better than generic landing-page or dashboard-card mosaics.

## Copy and Motion

- Use direct operational copy, not ad language.
- Keep support text short and decision-oriented.
- Avoid clipped helper snippets in executive summaries; show labels, counts, status, dates, and
  exact item titles before adding narrative preview text.
- Settings directories should read as clean configuration surfaces: avoid lifecycle badges,
  operational stats, and archived rows when the entries either exist or do not exist.
- Settings routes inside feature surfaces should highlight their settings affordance, not the
  nearest content tab; create actions for settings editors should stay with the sticky editor.
- Project browsing should prioritize a searchable full-width list of structured multi-line project
  rows: keep the numbered title, short blurb, and next up contained in the project column while
  status, coming-up, open-work, blocker, and updated values stay aligned as scannable columns.
- Desktop project rows should use hover-only emphasis, not persistent selected-row highlighting;
  opening the full page is a double-click action.
- Desktop non-project Work rows should use type-specific structured columns with a persistent
  right inspector. Row selection can be cleared by clicking the selected row again; the inspector
  should stay visible with a placeholder instead of collapsing the layout, and it should not become
  a separate scrolling surface.
- Mobile Work details should prioritize the agent note, actionable next steps, and a persistent
  agent composer. Keep status and metadata quiet, place secondary facts in a collapsed section, and
  preserve at least 48px controls except for compact inline text actions.
- In numbered project rows, use a hanging indent so blurbs and next-up badges align with the
  title text rather than the project number.
- In dense project columns, center narrow numeric counts such as blockers with a small metric
  anchor; reserve right alignment for date/time values.
- Project detail pages should use the project ledger pattern: low header chrome with last update in
  the upper-right, left section index on desktop, a compact Project Status section for editable
  status/health/priority/waiting/category basics, current next up, and active blocker
  relationships, a milestone-contained project plan, and a pinned right rail for static operating
  brief context plus lightweight project-local milestone creation. The project plan should use a
  continuous milestone rail with nested work rows and in-context due dates; avoid a separate
  global date bar unless the page becomes a true timeline/Gantt surface. Do not repeat status,
  health, priority, dates, or category in the right rail.
  Do not render milestones, tasks, Needs Resolution items, and change requests as unrelated type
  lists inside a project page. Milestones are not standalone browse/detail records in the UI; show
  them only as short headings inside a project plan, with project-page creation limited to a title
  and one-sentence description.
- Prefer restrained transitions that improve state clarity, sheets, or affordances.
- Remove animation that does not help scanning or interaction.

## Implementation Rules

- Use Svelte 5 runes patterns already established in the repo.
- Follow the component conventions in `docs/Technical/components.md`.
- Preserve tokenized styles where possible; avoid one-off hardcoded color systems.
- Validate with the existing shell, not a detached component-only assumption.
- Keep global CSS compatible with the deployed CSP. Do not import remote fonts or stylesheets from
  `src/app.css`; use system font stacks or self-hosted assets when custom typography is required.
