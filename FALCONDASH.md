# FALCONDASH.md

Falcon Dash is the operator console for OpenClaw deployments. It exists so operators can inspect agent health, manage chat channels, approve sensitive actions, configure gateway-backed capabilities, and recover from problems without SSH.

## Product Priorities

- Operator clarity over internal cleverness.
- Mission control first: the homepage should surface health, readiness, approvals, failures, and next actions.
- Shared semantics: channel readiness, approvals, and alert states must mean the same thing across homepage, settings, and wizards.
- Mobile usability at 375px width is required for operator-facing surfaces.
- Favor visible diagnostics over silent failure paths.

## Main Surfaces

- `/` mission control and agent overview
- `/channels/*` channel setup and repair
- `/settings` devices, approvals, diagnostics, skills, config, agents
- chat and session control through the main shell
- `/jobs`, `/documents`, `/projects`, `/passwords`, `/heartbeat`, `/apps/[surfaceId]`

## Architecture Rules

- Real-time state comes from shared stores and gateway events, not ad hoc per-route polling.
- Reuse shared stores before adding route-local state.
- Keep protocol mapping and readiness logic centralized.
- Do not fork Discord and Telegram semantics.
- Preserve operator-facing action paths: alerts should lead to the place where the problem can be fixed.

## Verification

- `npm run check`
- `npm run lint`
- `npm run test`
- `npm run test:e2e` for browser harness work

## Read Next

- `CLAUDE.md`
- `docs/Technical/architecture.md`
- `docs/Technical/stores.md`
- `docs/Technical/gateway-protocol.md`
- `docs/Technical/pm-pipeline.md`
