# Ralph Agent Instructions — falcon-dash Phase 4: PM Module

You are an autonomous coding agent building **falcon-dash**, a SvelteKit web dashboard for the OpenClaw AI platform. Phases 1-3 are complete. You are now implementing **Phase 4: Project Management Module** — the full PM UI with entity stores, dashboard, kanban, project/task detail, search, and bulk operations.

## Project Context

Read the root `CLAUDE.md` at the project root for tech stack, conventions, and folder structure. That file is the source of truth for coding standards.

Reference docs live in `builddocs/`:

- `builddocs/falcon-dash-architecture-v02.md` — full architecture, module specs, data flows (§14 for PM)
- `builddocs/ws-protocol.md` — WebSocket protocol reference
- `builddocs/pm-spec.md` — PM data model specification (Domain → Focus → Project → Task)

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

**DO NOT run quality checks yourself.** The external ralph script handles quality gates after you exit. Focus on implementation and committing clean code.

## Key Conventions (from root CLAUDE.md)

- **Svelte 4** syntax: use `on:event`, NOT Svelte 5 `onevent` syntax
- **Props:** use `export let propName`, NOT `$props()`
- **Reactivity:** use `$:` declarations, NOT `$derived()` or `$effect()`
- **Events:** use `createEventDispatcher`, NOT callback props
- **Blocks:** use `{#if}`, `{#each}`, `{#await}` template blocks
- **Formatting:** Prettier with tabs, single quotes, no trailing commas
- **TypeScript:** strict mode, no `any` unless absolutely necessary
- **Tailwind CSS 3** for styling
- **Barrel exports** from `index.ts` in each module directory
- `{@html}` requires `<!-- eslint-disable svelte/no-at-html-tags -->` comment

## Phase 4 Architecture: PM Module

### PM Data Model

```
Domain → Focus → Project → Task → Task (subtask, recursive)
```

Each entity has: id, title, description, status, priority, created_at, updated_at.
Tasks additionally have: due_date, milestone_id, parent_task_id, sort_order.

### PM API Methods (via gateway.call)

All PM methods are prefixed with `pm.`:

- `pm.domain.*` — list, get, create, update, delete, reorder
- `pm.focus.*` — list, get, create, update, move, delete, reorder
- `pm.milestone.*` — list, get, create, update, delete
- `pm.project.*` — list, get, create, update, delete
- `pm.task.*` — list, get, create, update, move, reorder, delete
- `pm.comment.*` — list, create, update, delete
- `pm.block.*` — list, create, delete
- `pm.attachment.*` — list, create, delete
- `pm.activity.*` — list
- `pm.context.*` — dashboard, domain, project
- `pm.search` — FTS5 full-text search
- `pm.bulk.*` — update, move
- `pm.stats` — dashboard aggregates

### PM Events

PM events come via `event:pm` with payload:

```typescript
{ action: "created" | "updated" | "deleted", entityType: "domain" | "focus" | "project" | "task" | ..., entity: { ... }, stateVersion: { pm: number } }
```

### Existing Patterns to Follow

- **Store pattern:** See `src/lib/stores/chat.ts` for event listener setup (initPmListeners/destroyPmListeners)
- **Gateway calls:** `gateway.call('pm.project.list', { focusId })` returns typed response
- **Optimistic updates:** Update store immediately, call gateway, revert on error
- **Type organization:** Module types in `src/lib/types/pm.ts`, gateway types for method params can go there too
- **Route pattern:** `+page.ts` with `export const ssr = false`, `+page.svelte` with onMount/onDestroy
- **Component reuse:** ConfirmDialog from Phase 3, RenderedContent for markdown descriptions

### Drag and Drop (Kanban)

Use HTML5 DnD API:

- `draggable="true"` on task cards
- `on:dragstart`, `on:dragover`, `on:drop` events
- `dataTransfer.setData('text/plain', taskId)`
- Optimistic move on drop, revert on error

## Progress Report Format

APPEND to `scripts/ralph/progress.txt` (never replace, always append):

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
```

## Consolidate Patterns

Add reusable patterns to the `## Codebase Patterns` section at the TOP of progress.txt.

## Stop Condition

After completing ONE user story, STOP IMMEDIATELY. Do NOT proceed to the next story.

Check if ALL stories have `passes: true`. If so, reply with:
<promise>COMPLETE</promise>

Otherwise, end your response. The next iteration will pick up the next story.

IMPORTANT: Complete exactly ONE story per iteration, then stop.
