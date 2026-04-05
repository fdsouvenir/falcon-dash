---
name: frontend-skill
description: >-
  Use when the task is to design or implement a visually strong frontend: landing pages,
  marketing sites, app surfaces, prototypes, dashboards, demos, or game UIs. This skill
  pushes for strong art direction, clear hierarchy, restrained composition, real visual
  anchors, and deliberate motion while avoiding generic card piles, weak branding, and
  cluttered first screens.
---

# Frontend Skill

Use this skill when frontend quality depends on visual direction, hierarchy, restraint,
imagery, and interaction polish, not just on assembling components.

Default goal: produce interfaces that feel intentional and current. Favor one strong idea,
tight copy, disciplined spacing, and a small set of meaningful motions.

When working inside Falcon Dash, optimize for the existing product language rather than for a
generic showcase site. This repo is a SvelteKit 2 app using Svelte 5 runes, Tailwind 4, and a
shared dark token system. Most work should extend that system, not replace it.

## Start Here

Before building, write these down in working notes:

- `visual thesis`: one sentence on mood, material, and energy
- `content plan`: what the first screen and the next 2-4 sections need to accomplish
- `interaction thesis`: 2-3 motions or transitions that materially improve the feel

If any of those are fuzzy, pause and define them before editing code.

## Core Workflow

### 1. Set constraints first

Define the design system early:

- one primary visual direction
- two typefaces max unless the existing product already uses more
- one accent color by default
- explicit tokens for `background`, `surface`, `text`, `muted`, and `accent`
- one clear above-the-fold action

If the repo already has a design system, preserve it instead of inventing a new one.

For Falcon Dash specifically:

- use the shared CSS tokens in `src/app.css`
- prefer utility constants from `src/lib/components/ui/design-tokens.ts`
- preserve the dark layered surface model: `surface-0` through `surface-3`
- use semantic status colors for operational meaning instead of inventing page-specific palettes
- keep typography compact and information-dense unless the brief explicitly asks for a branded
  marketing treatment

Do not introduce an unrelated color system, bright marketing palette, or light-theme rewrite
unless the task explicitly requires that change.

### 2. Start from composition, not components

Design the first viewport as a single composition.

- On branded landing pages, make the brand or product identity unmistakable.
- Lead with one dominant visual anchor, not a grid of UI devices.
- Prefer layout, spacing, alignment, and contrast before adding borders, shadows, or cards.
- Treat cards as interaction containers, not default decoration.

If the first screen still works after removing the hero image, the visual idea is too weak.

Inside Falcon Dash, most screens are product surfaces rather than marketing pages. Default to:

- shell-aware layouts that fit inside the existing desktop sidebar/agent rail structure
- views that cooperate with mobile shells, bottom sheets, and bottom tab navigation
- working surfaces first: lists, inspectors, detail panes, editors, timelines, approvals, logs
- compact controls and dense layouts that still scan clearly

Avoid introducing homepage-style hero sections into operational pages unless the user asks for it.

### 3. Build a narrative

For marketing-style pages, default to:

1. Hero
2. Support or proof
3. Detail or workflow
4. Final CTA

Each section gets one job, one dominant visual idea, and one primary takeaway.

For product UIs, skip the marketing hero unless the user explicitly asks for one. Start with
the working surface itself: navigation, status, filters, charts, tables, task context, or the
core editor/workspace.

### 4. Use real content and references

When possible, work from:

- real product copy
- real data or believable examples
- screenshots, mood boards, or attached references

If references are missing and the task is visually led, create a short mood-board direction in
notes before building. See [article-notes.md](./references/article-notes.md) for a prompt
template.

### 5. Verify the result visually

When tooling allows it, validate across desktop and mobile.

- Check the first viewport for hierarchy and crowding.
- Make sure fixed or floating elements do not cover key text or controls.
- Confirm motion is noticeable, fast, and not ornamental noise.
- Confirm the page still reads clearly when scanning only headings, labels, and primary actions.

Use browser automation or screenshots for verification when available.

For Falcon Dash, also check:

- desktop in `AppShell` with the sidebar and agent rail present
- mobile in `MobileShell` with the header, tab bar, and sheets present
- `100dvh` and safe-area behavior
- overflow behavior for long logs, tables, code blocks, and inspector panels
- whether stateful surfaces still read clearly when data is loading, empty, or disconnected

## Falcon Dash Build Rules

### Use the existing stack

- Write Svelte components and routes, not React.
- Follow Svelte 5 runes patterns already used in the repo: `$props`, `$state`, `$derived`,
  and `$effect`.
- Keep route files in `src/routes/` and shared UI in `src/lib/components/`.
- Prefer existing UI primitives from `src/lib/components/ui/` before inventing ad hoc buttons,
  badges, cards, or scroll containers.

### Respect the existing information architecture

Falcon Dash already has a strong app shell model:

- desktop uses `AppShell` with agent rail, sidebar, and main content
- mobile uses `MobileShell` with header, bottom tab bar, and sheets
- several routes switch between dedicated desktop and mobile implementations

New UI should fit into that structure. Do not design a page in isolation from its shell.

### Treat cards as optional, not default

This repo does include card primitives, but use them deliberately.

- Use cards for contained interactions, grouped summaries, or distinct panels.
- Do not turn whole dashboards into a mosaic of equal-weight cards.
- Prefer plain layout, dividers, spacing, and surface changes when those communicate structure
  more clearly.

### Prefer semantic status over decorative styling

Falcon Dash is an operator dashboard. Color should primarily communicate:

- active vs idle
- warning vs danger
- info vs muted
- plan and project state

If color is not carrying state, reduce it.

## Defaults By Surface

### Landing Pages

Use these defaults unless the brief clearly calls for something else:

- full-bleed or dominant visual first screen
- one headline, one short support line, one CTA group
- minimal chrome in the hero
- tight copy that scans in seconds
- no detached badges, stat strips, or promo clutter in the first viewport

Avoid:

- boxed hero layouts when the concept wants full bleed
- side-by-side hero mosaics without a clear calm area for text
- floating cards layered over the hero by default
- logo clouds or multi-row feature grids as the first impression

### Product UI

Default to restrained product surfaces:

- clear workspace hierarchy
- strong typography and spacing
- few colors
- minimal chrome
- a single accent for action or status

Avoid:

- dashboard-card mosaics
- thick borders around every region
- decorative gradients behind routine app UI
- ornamental icons that do not improve scanning
- marketing copy inside operational surfaces

If a panel can become plain layout without losing meaning, remove the card treatment.

For Falcon Dash product pages, strongly prefer one of these patterns:

- list + detail
- workspace + inspector
- status overview + activity feed
- editor + preview
- inbox + action panel

These match the repo better than center-column landing-page compositions.

## Copy Rules

- Use product language, not design commentary.
- Keep headlines compact and specific.
- Supporting copy should usually be one sentence.
- Cut repeated claims between sections.
- Remove filler until the structure becomes obvious.

For dashboards and admin tools, prefer utility copy:

- headings should orient the user
- support text should explain scope, freshness, or decision value
- if a sentence sounds like ad copy, rewrite it

Falcon Dash copy should sound operational: direct, compact, and useful under scan.

## Motion Rules

Ship a small number of intentional motions on visually led work:

- one entrance or reveal in the first screen
- one scroll, depth, or sticky behavior
- one hover, state, or layout transition that sharpens affordance

Motion should be:

- visible in a quick recording
- smooth on mobile
- fast and restrained
- removed if it adds spectacle without clarity

In Falcon Dash, favor subtle state transitions, sheet behavior, and panel affordances over
showcase animation.

## Hard Checks

Run these checks before you stop:

- Is the brand or product clear in the first screen?
- Is there one dominant visual anchor?
- Does each section have one job?
- Are cards necessary, or just inherited habit?
- Does the layout still work on mobile?
- Does motion improve hierarchy or atmosphere?
- Would the design still feel strong if most shadows disappeared?
- Does it still look like Falcon Dash rather than a pasted-in mini app?
- Does it use shared tokens and primitives instead of hardcoded one-off styles?
- Does it preserve useful density for operators?

## Failure Modes

If the output starts drifting toward any of these, correct course:

- generic SaaS card grids
- weak branding in the first screen
- too many accents or competing visual ideas
- decorative imagery that does not carry meaning
- repeated sections saying the same thing
- product surfaces written like homepage marketing
- large one-off style blocks that bypass shared tokens
- React-style architectural choices in Svelte files
- desktop-only layouts that ignore the existing mobile shell

## Reference Notes

Load [article-notes.md](./references/article-notes.md) when you need:

- a compact prompt recipe derived from the OpenAI article
- guidance on references, reasoning level, and verification
- a short set of frontend review questions
