# Quality Guide

This document defines the minimum validation standard for Falcon Dash changes.

## Default Commands

- `npm run check:harness`
- `npm run check:docs`
- `npm run check:skills`
- `npm run check`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

Run the smallest subset that proves the change. Do not skip validation silently.

## Validation by Change Type

### Store, parser, or utility changes

- add or update adjacent `*.test.ts`
- run `npm run test`
- run `npm run check` if types or public interfaces changed

### Route or component changes

- run `npm run check`
- run `npm run lint`
- add or update Playwright coverage for user-critical flows when practical
- verify desktop and mobile if the route supports both shells

### Server route or gateway-facing changes

- run `npm run check`
- run `npm run test`
- add or update Playwright coverage when the UI contract changes
- document live-gateway prerequisites if a check cannot run locally

## Manual Verification Standard

If automation is incomplete, record:

1. route or command
2. prerequisite state
3. action
4. expected result

"Tested manually" by itself is not an acceptable verification note.

## Documentation Freshness

When changing stable behavior, update the matching doc in `docs/` in the same change when
possible. At minimum, update the doc if you changed:

- system architecture or request flow
- shell or navigation behavior
- route-level UX patterns
- verification expectations
- plan-writing or operator workflow

CI also runs a lightweight docs freshness check for high-signal directories. If a change touches
frontend surfaces, stores, PM flows, or gateway-facing integration without touching a matching doc,
the build should fail and force an explicit documentation decision.
