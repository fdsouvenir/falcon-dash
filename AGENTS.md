# Falcon Dash Agent Guide

Use this file as a router. Keep repo truths in `docs/`, reusable workflows in `skills/`, and
verification in tests and scripts.

## Start Here

- Read [docs/PURPOSE.md](docs/PURPOSE.md) for product intent and audience.
- Read [docs/HARNESS.md](docs/HARNESS.md) for the repo-level execution and validation model.
- Read the smallest technical doc that matches the task.
- Load a skill only when the task matches that skill's scope.

## Task Routing

### Product and UX intent

- [docs/PURPOSE.md](docs/PURPOSE.md) — product purpose, audience, and design philosophy
- [docs/End User/](docs/End%20User) — user-facing behavior by feature

### Architecture and implementation

- [docs/Technical/architecture.md](docs/Technical/architecture.md) — system overview and request flow
- [docs/Technical/components.md](docs/Technical/components.md) — Svelte 5 component conventions and shell layout
- [docs/Technical/stores.md](docs/Technical/stores.md) — store architecture and event wiring
- [docs/Technical/pm-pipeline.md](docs/Technical/pm-pipeline.md) — PM model, context generation, and API flow
- [docs/Technical/gateway-protocol.md](docs/Technical/gateway-protocol.md) — gateway protocol integration
- [docs/Technical/deployment.md](docs/Technical/deployment.md) — build, runtime, and deployment behavior

### Repo operating rules

- [docs/CONTRIBUTING-HARNESS.md](docs/CONTRIBUTING-HARNESS.md) — how to satisfy harness, docs, and skill checks
- [docs/HARNESS-LOOP.md](docs/HARNESS-LOOP.md) — recursive local work loop and artifacts
- [docs/FRONTEND.md](docs/FRONTEND.md) — Falcon Dash frontend constraints and design patterns
- [docs/QUALITY.md](docs/QUALITY.md) — required validation levels and rerun paths
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — state, realtime, and failure-mode expectations
- [docs/PLANS.md](docs/PLANS.md) — how to write and maintain execution plans in this repo
- [docs/OWNERSHIP.md](docs/OWNERSHIP.md) — which docs should usually move with which code areas
- [docs/LEARNINGS.md](docs/LEARNINGS.md) — historical implementation pitfalls and fixes

### Skills

- [skills/falcon-dash/SKILL.md](skills/falcon-dash/SKILL.md) — operator dashboard rules and PM-first workflow
- [skills/falcon-dash-harness/SKILL.md](skills/falcon-dash-harness/SKILL.md) — harness routing and verification workflow
- [skills/falcon-dash-pm/SKILL.md](skills/falcon-dash-pm/SKILL.md) — PM API reference
- [skills/frontend-skill/SKILL.md](skills/frontend-skill/SKILL.md) — Falcon Dash frontend execution guidance
- [skills/keepassxc/SKILL.md](skills/keepassxc/SKILL.md) — password vault workflows

## Project Structure

- `src/routes/` — SvelteKit pages and API handlers
- `src/lib/components/` — shared UI components
- `src/lib/stores/` — client state and feature stores
- `src/lib/server/` — server-only logic
- `src/lib/channels/` — channel setup helpers
- `src/lib/canvas/` — canvas-related code
- `e2e/` — Playwright coverage
- `docs/` — system-of-record docs
- `skills/` — reusable agent workflows

## Commands

Use Node 20+.

- `npm install` — install dependencies and repo skills
- `npm run dev` — start the local Vite dev server
- `npm run build` — create the production build in `build/`
- `npm run preview` — serve the built app locally
- `npm run check` — run Svelte and TypeScript checks
- `npm run lint` — run ESLint
- `npm run format` — apply Prettier
- `npm run format:check` — verify Prettier formatting
- `npm run test` — run Vitest unit tests
- `npm run test:coverage` — run unit tests with coverage
- `npm run test:e2e` — run Playwright tests
- `npm run check:harness` — verify the harness doc map
- `npm run check:docs` — verify high-signal code changes touched matching docs
- `npm run check:skills` — verify repo-local skills are structurally valid
- `npm run agent:loop -- <mode>` — run recursive local checks and write artifacts

## Coding Rules

- Follow strict TypeScript, ESLint, and Prettier.
- Use tabs, single quotes, no trailing commas, and `printWidth` 100.
- Use `PascalCase` for Svelte components and `camelCase` for functions and stores.
- Keep route handlers in `+server.ts` and route components in `+page.svelte`.
- Prefer `rg` for file and text search.

## Testing Rules

- Prefer unit tests for stores, utilities, and server logic.
- Use Playwright for routing, auth, gateway, and cross-surface flows.
- When full automation is not practical, leave explicit manual rerun steps.
- Do not say "tested manually" without route, setup, action, and expected result.

## Change Discipline

- Keep `AGENTS.md` short. Put durable repo knowledge in `docs/`.
- Do not commit secrets or machine-specific config.
- Local development expects an OpenClaw gateway and reads `~/.openclaw/openclaw.json`.
