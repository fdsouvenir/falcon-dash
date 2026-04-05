---
name: falcon-dash-harness
description: >-
  Harness and verification workflow for Falcon Dash. Use when implementing or debugging Falcon Dash
  features that need reproducible local validation, gateway-aware manual checks, Playwright E2E
  coverage, smoke tests, or issue-driven acceptance criteria for operator surfaces such as mission
  control, approvals, device pairing, channels, settings, and canvas.
---

# Falcon Dash Harness

Use this skill to turn a Falcon Dash change into a reproducible verification loop instead of a one-off manual check.

This skill is a router, not the full source of truth. Read the relevant docs first and keep durable
knowledge in `docs/`.

## Goals

- Reproduce the issue with the smallest possible setup.
- Encode acceptance criteria as tests or explicit manual steps.
- Prefer repo-local harnesses over chat-only instructions.
- Leave behind a clear rerun path for the next agent.

## Read Order

Start with the smallest matching docs:

1. `docs/HARNESS.md`
2. One or more of:
   - `docs/FRONTEND.md`
   - `docs/QUALITY.md`
   - `docs/RELIABILITY.md`
   - `docs/PLANS.md`
3. Technical docs under `docs/Technical/` for the affected architecture slice
4. Product or user docs under `docs/PURPOSE.md` and `docs/End User/` if behavior or UX is involved

## Default Workflow

1. Read `docs/HARNESS.md` and the relevant issue or request.
2. Read the smallest technical doc that explains the affected surface.
3. Identify whether the work is store-driven, route-driven, gateway-driven, or server-route-driven.
4. Pick the cheapest trustworthy validation layer:
   - unit test for pure store or mapping logic
   - Playwright for operator-facing flows and routing
   - manual gateway verification only when the flow depends on a live OpenClaw environment
5. Add or update the harness before or alongside the feature work.
6. Run the narrowest checks that prove the behavior.

## Verification Commands

Use the smallest command set that matches the change:

```bash
npm run check:harness
npm run check
npm run lint
npm run test
npm run test:e2e
```

For browser work, install Chromium first if needed:

```bash
npm run test:e2e:install
```

## Playwright Guidance

Playwright lives in `playwright.config.ts` and `e2e/`.

- Keep one smoke test runnable without a fully configured gateway.
- Use issue-numbered specs for major operator-console work so acceptance criteria stay attached to the backlog item.
- Start unfinished issue coverage as `test.fixme(...)` contracts instead of inventing brittle fake assertions.
- Add helpers for navigation and repeated setup in `e2e/fixtures.ts`.
- When a flow depends on a live gateway state, make that dependency explicit in the test title or skip reason.

## Falcon Dash-Specific Heuristics

- For homepage, approvals, and channel work, test desktop and mobile widths.
- For readiness or approval logic, put shared semantics in stores or utilities first, then test the UI surface.
- For pairing and gateway bugs, verify whether the problem is missing RPC data, swallowed errors, or stale event wiring before touching UI copy.
- For dashboard changes, keep quick actions, alerts, and remediation links operator-visible.
- For documentation-heavy or cross-cutting work, update the relevant file in `docs/` rather than expanding this skill.

## Manual Check Format

If full automation is not yet practical, leave a concise manual verification checklist in the issue-specific spec or PR notes:

1. exact route
2. exact setup prerequisite
3. action
4. expected visible result

Do not leave behind "tested manually" without the rerun steps.
