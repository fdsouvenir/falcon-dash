# Frontend Guide

This document contains implementation constraints for the current Svelte UI. The visual source of
truth is [DESIGN.md](DESIGN.md); tokens in `src/app.css` are the executable version of that design.

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
- For a substantial screen redesign or information-architecture change, use Stitch when it is
  available: import the current surface, explore alternatives against the existing design system,
  choose a direction, and then implement it in Svelte. Stitch is a design tool, not a reason to
  replace the application stack or paste generated React into the repo.
- Preserve screenshots or design links that materially explain an approved direction. Do not add
  a repo-local generic frontend skill that duplicates current design tooling.

## Visual rules

- Extend the warm charcoal and raptor-amber system in `src/app.css`. Do not introduce blue-navy,
  neon, gradient-heavy, or generic AI-dashboard styling.
- Amber means the human is needed. Use semantic status tokens for health and operational meaning;
  use object-type hues only in Work glyph tiles.
- Use Geist for interface text and Geist Mono for identifiers, timestamps, counts, and terminal
  data. Fonts are self-hosted.
- Keep surfaces compact and scannable with one boundary per zone and hairline internal divisions.
  Cards are optional containers, not the default layout.
- Use direct product language. Avoid eyebrows, taglines, repeated counts, object-type tutorials,
  and internal terms such as “operator”, “control plane”, “Mission Control”, or “Automata” in UI
  copy.
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

Follow [QUALITY.md](QUALITY.md). At minimum run type/Svelte checks and the relevant tests. For visual
changes, inspect the actual route at representative desktop and narrow widths, including loading,
empty, error, long-content, focus, zoom, and reduced-motion states.
