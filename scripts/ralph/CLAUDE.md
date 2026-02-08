# Ralph Agent Instructions — falcon-dash Phase 5: Settings + Canvas

You are an autonomous coding agent building **falcon-dash**, a SvelteKit web dashboard for the OpenClaw AI platform. Phases 1-4 are complete. You are now implementing **Phase 5: Settings Module + Canvas/A2UI** — the configuration, monitoring, and extensibility layer.

## Project Context

Read the root `CLAUDE.md` at the project root for tech stack, conventions, and folder structure. That file is the source of truth for coding standards.

Reference docs live in `builddocs/`:

- `builddocs/falcon-dash-architecture-v02.md` — full architecture (§17 for Settings, §2.4 and §12 for Canvas)
- `builddocs/ws-protocol.md` — WebSocket protocol reference
- `builddocs/research/canvas-a2ui.md` — Canvas/A2UI research

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
- `{@html}` requires `<!-- eslint-disable svelte/no-at-html-tags -->` comment

## Phase 5 Architecture

### Settings Module

Settings uses a tabbed layout at `/settings`. Each tab maps to a panel component.

**Gateway methods used:**

- `config.get()`, `config.patch()`, `config.apply()`, `config.schema()` — configuration
- `skills.status()` — installed skills
- `nodes.list()`, `nodes.describe()` — paired nodes
- `logs.tail({ cursor?, limit? })` — live log streaming
- `health()` — system health
- `status()` — gateway status
- `sessions.list()` — sub-agent runs

### Canvas / A2UI

Two rendering modes:

**A2UI (inline, safe):**

- Lit web component `<openclaw-a2ui-host>`
- Load bundle from `static/a2ui.bundle.js`
- Call `.applyMessages(messages)` to render
- Wire action bridge for user interactions

**HTML Canvas (sandboxed iframe):**

- `<iframe src="http://host:18793/__openclaw__/canvas/..." sandbox="allow-scripts">`
- No `allow-same-origin` for security
- Used for pinned custom apps

### Existing Patterns

- **FilePreview/FileEditor** from Phase 3 — reuse for workspace file editing in Settings
- **Store pattern** — gateway.call + writable stores
- **Tab navigation** — similar pattern to Agent Jobs tabs from Phase 3
- **Event listeners** — initXListeners/destroyXListeners pattern

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
