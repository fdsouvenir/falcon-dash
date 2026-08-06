# Falcon Dash Agent Guide

Use this file as a router. Keep repo truths in `docs/`, reusable workflows in `skills/`, and
verification in tests and scripts.

`AGENTS.md` is the canonical agent guide. `CLAUDE.md` must remain a symlink to this file so every
agent receives the same instructions.

## Start Here

- Read [docs/PURPOSE.md](docs/PURPOSE.md) for product intent and audience.
- Read [docs/ROADMAP.md](docs/ROADMAP.md) when a change affects version scope or future architecture.
- Read [docs/HARNESS.md](docs/HARNESS.md) for the repo-level execution and validation model.
- Read the smallest technical doc that matches the task.
- Load a skill only when the task matches that skill's scope.

## Product and Sources of Truth

- Falcon Dash is a standalone, self-hostable operator dashboard that requires a co-resident
  OpenClaw Gateway over loopback or a same-host container network. Remote gateways are outside the
  supported product scope.
- OpenClaw changes rapidly. For upstream behavior, consult the current official documentation at
  `docs.openclaw.ai`, its `llms-full.txt`, and the public `github.com/openclaw/openclaw` repository.
- Repository docs, code, and tests should agree. When they do not, investigate the discrepancy and
  reconcile them in the same change instead of silently treating either one as correct.

## Task Routing

### Product and UX intent

- [docs/PURPOSE.md](docs/PURPOSE.md) — product purpose, audience, and design philosophy
- [docs/ROADMAP.md](docs/ROADMAP.md) — current-versus-future version scope and post-v5 architecture
- [docs/End User/](docs/End%20User) — user-facing behavior by feature

### Architecture and implementation

- [docs/Technical/architecture.md](docs/Technical/architecture.md) — system overview and request flow
- [docs/Technical/components.md](docs/Technical/components.md) — Svelte 5 component conventions and shell layout
- [docs/Technical/stores.md](docs/Technical/stores.md) — store architecture and event wiring
- [docs/Technical/work-management.md](docs/Technical/work-management.md) — Work model, context generation, and API flow
- [docs/Technical/gateway-protocol.md](docs/Technical/gateway-protocol.md) — gateway protocol integration
- [docs/Technical/deployment.md](docs/Technical/deployment.md) — build, runtime, and deployment behavior

### Repo operating rules

- [docs/CONTRIBUTING-HARNESS.md](docs/CONTRIBUTING-HARNESS.md) — how to satisfy harness, docs, and skill checks
- [docs/HARNESS-LOOP.md](docs/HARNESS-LOOP.md) — recursive local work loop and artifacts
- [docs/CONSOLE-SWEEP.md](docs/CONSOLE-SWEEP.md) — route-based browser console sweep
- [docs/FRONTEND.md](docs/FRONTEND.md) — Falcon Dash frontend constraints and design patterns
- [docs/QUALITY.md](docs/QUALITY.md) — required validation levels and rerun paths
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — state, realtime, and failure-mode expectations
- [docs/PLANS.md](docs/PLANS.md) — how to write and maintain execution plans in this repo
- [docs/OWNERSHIP.md](docs/OWNERSHIP.md) — which docs should usually move with which code areas
- [docs/LEARNINGS.md](docs/LEARNINGS.md) — durable lessons that span the product roadmap

### Packaged runtime skills

- [skills/falcon-dash/SKILL.md](skills/falcon-dash/SKILL.md) — always-on OpenClaw agent orientation
- [skills/falcon-dash-work/SKILL.md](skills/falcon-dash-work/SKILL.md) — current v3 Work CLI and API workflow
- [skills/falcon-dash-vault/SKILL.md](skills/falcon-dash-vault/SKILL.md) — built-in Vault and SecretRef workflow

These skills ship to OpenClaw agents. Repo-development workflows belong in this guide and `docs/`,
or in environment-provided skills such as Stitch; do not add developer-only skills to `skills/`.

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
- `npm run console:sweep` — scan offline-safe routes for browser console issues

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
- When planning work, find the relevant GitHub issue and keep its scope, status, discoveries, and
  acceptance criteria current. Create an issue when the work needs tracking and no suitable issue
  exists. Follow `SECURITY.md` instead of opening public issues for vulnerabilities.
- Use [docs/OWNERSHIP.md](docs/OWNERSHIP.md) before completing a behavior change and update every
  owning current document in the same change.
- Document durable behavior, architecture, decisions, verification paths, and operational gotchas.
  Add a lesson to `docs/LEARNINGS.md` only when it is expected to remain useful across the full
  product roadmap; use code, tests, current technical docs, issues, or Git history for narrower facts.
- Commit early and often. Prefer small, coherent commits and never include unrelated user changes.
- Do not commit secrets or machine-specific config.
- Do not assume a gateway is running or use a hardcoded gateway port. Inspect the current same-host
  environment and follow the gateway and deployment docs for configuration and authentication.
