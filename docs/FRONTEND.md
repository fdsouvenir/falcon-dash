# Frontend Guide

This document contains implementation constraints for the current Svelte UI. The linked
[Stitch project](https://stitch.withgoogle.com/projects/13701669844013221224) is the visual and
interaction-design authority for the active desktop redesign. [DESIGN.md](DESIGN.md) records its
target design system, while `src/app.css` remains the executable source for currently shipped
tokens. Where an approved redesigned screen differs from the current implementation, treat that as
migration work rather than evidence that the target system already ships globally.

## Stack and shell

- SvelteKit 2, Svelte 5 runes, Tailwind 4, and shared primitives under
  `src/lib/components/ui/`.
- Desktop routes render in `AppShell`; narrow viewports render in `MobileShell`.
- Work navigation belongs to `src/routes/work/+layout.svelte`, not individual destination pages.
- Design inside the real shell and verify every changed viewport; do not assume a detached
  component represents the product.

## Design workflow

- Use direct source edits and browser inspection for localized copy, spacing, density, and
  interaction corrections.
- For a substantial screen redesign or information-architecture change, begin with the canonical
  Stitch project and its `Synthesized Intelligence` design system. Extend that project when a
  required state or route has no approved screen, then implement the approved result in Svelte.
  Stitch is a design tool, not a reason to replace the application stack or paste generated HTML
  into the repo.
- Preserve screenshots or design links that materially explain an approved direction. Do not add
  a repo-local generic frontend skill that duplicates current design tooling.

## Visual rules

- Implement the `Synthesized Intelligence` system in [DESIGN.md](DESIGN.md) incrementally on
  approved redesigned screens: workplace-white and cool-slate surfaces, Indigo for human-led action
  and core navigation, Violet for agent activity, and saturated semantic colors for success,
  warning, and error.
- Use the desktop shell shown in Stitch as the reference composition: a persistent 260px labeled
  sidebar, a 64px workspace header, and a fluid 12-column content grid at 1280px and wider.
- Favor high information density, compact 8px vertical table/list padding, horizontal row dividers,
  restrained 4px corners, and tonal surface layers over heavy shadows or decorative effects.
- Use Geist for interface text and JetBrains Mono for identifiers, timestamps, counts, status
  labels, reasoning traces, and system data. Fonts remain self-hosted in the application.
- Keep human and agent activity visually distinct. Indigo communicates human action and navigation;
  Violet communicates agent actions, reasoning, execution, and live activity. Never rely on color
  alone to express actor or state.
- Status-heavy badges are compact rectangles with 2px–4px corners and tinted semantic backgrounds.
  Pills remain exceptional rather than the default badge shape.
- Tables, timelines, reasoning blocks, progress bars, contextual agent panels, and split execution
  workspaces should follow the corresponding approved Stitch screen rather than a generic local
  abstraction.
- Treat mockup labels and fixture content as structural examples, not product facts. Preserve the
  current Work object distinctions, authority model, guarded actions, and gateway boundaries when
  mapping the screens to live Falcon Dash data.
- The current redesign is desktop-web-first. Do not invent a new mobile information architecture in
  this pass; preserve the existing narrow route well enough to avoid catastrophic regressions until
  the dedicated mobile design work begins.
- Motion must clarify state or interaction and respect `prefers-reduced-motion`.

## Shared interaction rules

- Prefer existing primitives before creating a bespoke input, button, dialog, tab, sheet, badge, or
  status treatment.
- Use `Field` with `Input`, `Textarea`, or `Select` so labels, help, errors, required state, and
  `aria-describedby` remain connected.
- Use the shared `Tabs` primitive for small view switches; URL navigation is preferable when the
  selection must survive reload or sharing.
- Use `ConfirmDialog` for destructive, terminal, authority-granting, or execution actions. Pending
  actions cannot be dismissed or submitted twice.
- Shared regions use component-local IDs. Never hard-code an `aria-labelledby` ID that may repeat.
- Normal copy must remain readable under user text-size preferences and browser zoom. Avoid
  horizontal scrolling in ordinary workflows and preserve visible keyboard focus.

## Work rules

- Build Work routes from `src/lib/components/work/` and the shared command manifest. Do not restore
  route-local command maps, raw form controls, or one universal lifecycle vocabulary.
- Keep guarded actions visible with the exact disabled reason. Reviews evaluate a submitted
  revision; Authorizations grant permission. The UI must never collapse those facts.
- Use `FocusChips` and `src/lib/work3/focus.ts` for counted, URL-stable filters. Do not duplicate
  server-derived health, progress, schedule, or actionability logic in the browser.
- Needs Resolution keeps Questions, Decisions, Reviews, and Authorizations distinct. Browse keeps
  object types distinct and renders highlighted search text without injected HTML.
- Automation lifecycle, runtime health, and run outcome use separate tone maps. Runtime errors are
  not lifecycle states.
- The v3 Work UI does not add an agent composer. Contextual conversation is a v5 roadmap feature.

## Verification

Follow [QUALITY.md](QUALITY.md). At minimum run type/Svelte checks and the relevant tests. For this
desktop-web redesign, inspect the actual route at representative 1280px, 1440px, and wide desktop
widths, including loading, empty, error, long-content, focus, zoom, and reduced-motion states. Keep
the existing narrow shell free of catastrophic regressions, but defer dedicated mobile UX decisions
to the separate mobile design effort.
