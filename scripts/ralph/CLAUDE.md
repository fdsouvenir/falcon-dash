# Ralph Agent Instructions — falcon-dash

You are an autonomous coding agent building **falcon-dash**, a SvelteKit web dashboard for the OpenClaw AI platform.

## Project Context

Read the root `CLAUDE.md` at the project root for tech stack, conventions, and folder structure. That file is the source of truth for coding standards.

Reference docs live in `builddocs/`:
- `builddocs/falcon-dash-architecture-v02.md` — full architecture, module specs, data flows
- `builddocs/ws-protocol.md` — WebSocket protocol reference (frames, methods, events)
- `builddocs/pm-spec.md` — project management specification

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks: `npm run check`, `npm run lint`, `npm run build`, `npm run test`
7. Run `npm run format` before committing (agents never match Prettier config exactly)
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD (`scripts/ralph/prd.json`) to set `passes: true` for the completed story
10. Append your progress to `scripts/ralph/progress.txt`

## Key Conventions (from root CLAUDE.md)

- **Svelte 4** syntax: use `on:event`, NOT Svelte 5 `onevent` syntax
- **Formatting:** Prettier with tabs, single quotes, no trailing commas
- **TypeScript:** strict mode, no `any` unless absolutely necessary
- **Tailwind CSS 3** for styling
- **Barrel exports** from `index.ts` in each module directory
- `{@html}` requires `<!-- eslint-disable svelte/no-at-html-tags -->` comment
- `EventListener` global type triggers ESLint `no-undef` — use wrapper functions instead of `as EventListener`

## Gateway WS Protocol Quick Reference

- Port: `18789` (default `ws://127.0.0.1:18789`)
- `client.id` must be `"openclaw-control-ui"` (gateway validates against enum)
- `client.mode` must be `"webchat"`
- Protocol version: `3`
- Frame types: `req`, `res`, `event`
- First frame must be `connect` request
- `policy.tickIntervalMs`: 30000 (30s), timeout at 2x = 60s
- Reconnection: exponential backoff, 800ms base, 1.7x multiplier, 15s cap
- Dev auth: set `gateway.controlUi.allowInsecureAuth: true` for token-only

## Progress Report Format

APPEND to `scripts/ralph/progress.txt` (never replace, always append):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

## Consolidate Patterns

If you discover a **reusable pattern**, add it to the `## Codebase Patterns` section at the TOP of `scripts/ralph/progress.txt` (create it if it doesn't exist):

```
## Codebase Patterns
- Example: Svelte stores use writable() from svelte/store
- Example: Gateway types are in src/lib/gateway/types.ts
```

Only add patterns that are **general and reusable**, not story-specific details.

## Quality Requirements

- ALL commits must pass: `npm run check` (0 errors), `npm run lint`, `npm run build`, `npm run test`
- Always run `npm run format` before committing
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally (another iteration will pick up the next story).

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting
- When in doubt, consult `builddocs/` for architecture decisions
