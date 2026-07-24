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
- Use the shared `Input`, `Textarea`, `Select`, and `Field` primitives for operator forms. `Field`
  owns label, hint, error, and `aria-describedby` IDs; pass its snippet context through to the
  nested control so required and invalid states remain native and accessible. `Input` is for
  value-based text, numeric, color, and date/time controls; use a dedicated choice, toggle, or file
  control for checkbox, radio, and file inputs.
- Use the shared `Tabs` primitive for small in-page view switches. It renders a useful default
  panel during SSR and supports arrow, Home, and End keys.
- Use `ConfirmDialog` for destructive, terminal, authority-granting, and execution actions. It
  uses a native dialog on desktop and the focus-trapped `BottomSheet` modal on mobile, and it locks
  dismissal and repeat submission while an asynchronous action is pending.
- Build Work v3 routes from `src/lib/components/work/`. `CommandForm` reads the shared semantic
  command manifest, `CommandFeedback` owns structured failure and stale-version recovery, and
  `StatusBadge` maps each object vocabulary through `src/lib/work3/tones.ts`. Do not restore
  per-route command-label maps, raw form controls, or a universal status map.
- Repeated shared regions must use component-local IDs (for example, Svelte `$props.id()`) for
  `aria-labelledby`; never hard-code an ID that can repeat inside a Project ledger loop.
- Work object detail pages must keep guarded commands visible with an inline disabled reason,
  distinguish Reviews from Authorizations, and render unresolved source references explicitly.
  Decision option selection belongs in the shared radio-card field support rather than one form
  per option.
- Work v3 navigation belongs to `src/routes/work/+layout.svelte`; destination pages must not render
  their own copies of the Work navigation.
- Mission Control leads with four linked queue totals, then uses compact Work rows and tonal
  sections for priority-ordered drill-downs. Clamp long queue explanations, keep Review visually
  separate from Authorization/Verification, and use the shared keyboard-operable Tabs for waiting
  parties rather than rendering two competing first-level panels.
- Projects and Browse use the shared `FocusChips` URL contract. Definitions live in
  `src/lib/work3/focus.ts`, show counts, preserve the current query string, and declare either a
  reader-backed filter or a predicate over list-projection fields. Routes must not recreate those
  predicates or infer missing server state.
- Needs Resolution uses four distinct expandable Sections for Questions, Decisions, Reviews, and
  Authorizations. The expanded region may host a scoped `CommandBar`; Review controls stay
  information-toned while Authorization controls stay warning-toned.
- Browse type tabs are navigation links so the selected type survives SSR, reload, and sharing.
  Search snippets must be tokenized and highlighted as text rather than injected as HTML. Keep
  terminal and archived rows available behind a native disclosure.
- Automata render lifecycle, health, and Run outcome through separate tone maps. Native Runs are
  responsive rows rather than a desktop-only table, runtime unavailability is a visible health
  banner, and restoration owns a dedicated section on deleted records.

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
- Mobile Work details should prioritize actionable next steps, keep status and metadata quiet, and
  preserve at least 48px controls except for compact inline text actions. In-product agent
  communication is a v4 concern; Work v3 does not add an agent composer.
- In numbered project rows, use a hanging indent so blurbs and next-up badges align with the
  title text rather than the project number.
- In dense project columns, center narrow numeric counts such as blockers with a small metric
  anchor; reserve right alignment for date/time values.
- Project detail pages use the v3 Project Ledger: a five-section anchor rail on wide screens,
  Status/Route/Proof/Current work/History in the center, and a sticky operating brief on the right.
  Status renders server-derived health, progress, current next work, and risk flags. Route owns
  Phase progress and lifecycle. Proof keeps criteria satisfaction, contribution links, waivers,
  Milestones, schedules, and source-backed achievement together. Current work groups typed Tasks,
  Questions, Decisions, and Changes by Phase instead of presenting unrelated type lists.
- Project lifecycle actions belong to the header. Phase and Milestone lifecycle actions stay
  attached to their respective rows. The operating brief may contain collapsed Phase and
  Milestone composers; these are the only Work v3 operator-UI creation controls. Do not duplicate
  lifecycle, health, schedule, or progress derivation in the client.
- Prefer restrained transitions that improve state clarity, sheets, or affordances.
- Remove animation that does not help scanning or interaction.

## Implementation Rules

- Use Svelte 5 runes patterns already established in the repo.
- Follow the component conventions in `docs/Technical/components.md`.
- Preserve tokenized styles where possible; avoid one-off hardcoded color systems.
- Validate with the existing shell, not a detached component-only assumption.
- Keep global CSS compatible with the deployed CSP. Do not import remote fonts or stylesheets from
  `src/app.css`; use system font stacks or self-hosted assets when custom typography is required.
