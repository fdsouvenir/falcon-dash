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
- Prefer restrained transitions that improve state clarity, sheets, or affordances.
- Remove animation that does not help scanning or interaction.

## Implementation Rules

- Use Svelte 5 runes patterns already established in the repo.
- Follow the component conventions in `docs/Technical/components.md`.
- Preserve tokenized styles where possible; avoid one-off hardcoded color systems.
- Validate with the existing shell, not a detached component-only assumption.
- Keep global CSS compatible with the deployed CSP. Do not import remote fonts or stylesheets from
  `src/app.css`; use system font stacks or self-hosted assets when custom typography is required.
