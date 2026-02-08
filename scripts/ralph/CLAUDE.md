# Ralph Agent Instructions — falcon-dash Phase 6: Mobile & Polish

You are an autonomous coding agent building **falcon-dash**, a SvelteKit web dashboard for the OpenClaw AI platform. Phases 1-5 are complete. You are now implementing **Phase 6: Mobile & Polish** — the final pass for mobile layout, touch interactions, offline support, accessibility, performance, themes, and onboarding.

## Project Context

Read the root `CLAUDE.md` at the project root for tech stack, conventions, and folder structure. That file is the source of truth for coding standards.

Reference docs live in `builddocs/`:

- `builddocs/falcon-dash-architecture-v02.md` — full architecture (§19 for mobile layout, §6 Phase 6 for goals)

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, create it from the current branch.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run `npm run format` before committing
7. Commit ALL changes with message: `feat: [Story ID] - [Story Title]`
8. Update the PRD (`scripts/ralph/prd.json`) to set `passes: true` for the completed story
9. Append your progress to `scripts/ralph/progress.txt`

**DO NOT run quality checks yourself.** The external ralph script handles quality gates after you exit.

## Key Conventions (from root CLAUDE.md)

- **Svelte 4** syntax: `on:event`, `export let`, `$:` reactive declarations
- **Formatting:** Prettier with tabs, single quotes, no trailing commas
- **TypeScript:** strict mode, no `any` unless absolutely necessary
- **Tailwind CSS 3** for styling
- **Barrel exports** from `index.ts` in each module directory

## Phase 6 Architecture

### Mobile Layout Strategy

The app has been built responsive-first (Tailwind breakpoints) through Phases 1-5. Phase 6 is the dedicated mobile pass:

- **Desktop (≥768px):** Sidebar + main content (current layout, preserved)
- **Mobile (<768px):** Bottom tab bar + single-pane navigation

```
Desktop:                     Mobile:
┌────────┬──────────┐       ┌──────────────┐
│Sidebar │ Content  │       │  Content     │
│        │          │       │              │
│        │          │       ├──────────────┤
│        │          │       │ 💬 📋 📁 🤖 ⚙️ │
└────────┴──────────┘       └──────────────┘
```

### Touch Targets

All interactive elements must be ≥44×44px on mobile. Use Tailwind: `min-h-[44px] min-w-[44px]`.

### PWA Enhancement

Phase 1 set up basic PWA (manifest + service worker). Phase 6 adds:

- Offline caching of API responses (workbox runtimeCaching)
- Background sync for queued mutations
- Push notifications (VAPID keys)

### Theme System

Tailwind `darkMode: 'class'` is the approach. Add `dark` class to `<html>`:

- Dark: current colors (slate-900/800, default)
- Light: white/gray-50 backgrounds, dark text
- System: `matchMedia('(prefers-color-scheme: dark)')` listener

Load preference in `app.html` `<script>` (before body) to prevent flash.

### Performance

- Virtual scrolling: render only visible items in long lists (chat, tasks, files)
- Lazy components: `{#await import(...)}` for heavy components (Mermaid, KaTeX)
- Bundle analysis: verify route-based code splitting works

### Existing Patterns

- **Responsive breakpoints** already used throughout (md:, lg: prefixes)
- **LocalStorage** used for auth, theme can follow same pattern
- **ConfirmDialog** for confirmations
- **CommandPalette** pattern for overlays

## Progress Report Format

APPEND to `scripts/ralph/progress.txt`:

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
```

## Consolidate Patterns

Add reusable patterns to `## Codebase Patterns` at TOP of progress.txt.

## Stop Condition

After completing ONE user story, STOP IMMEDIATELY.

If ALL stories have `passes: true`, reply with:
<promise>COMPLETE</promise>

Otherwise, end your response. Complete exactly ONE story per iteration.
