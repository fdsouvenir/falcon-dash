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
- verify desktop and narrow-viewport behavior if the route supports both shells

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

CI also runs a docs ownership check for high-signal directories. If a change touches frontend
surfaces, stores, Work flows, Vault behavior, or gateway-facing integration without touching every
required owner group, the build should fail and force an explicit documentation decision. The
harness separately rejects broken local links and orphaned files under `docs/`.

## Plugin v4 checkpoint

Canonical `check`, `test`, `test:coverage`, and `build` now target the plugin. CI installs the
exact 2026.9.2 SDK into a runner-temporary prefix and KeePassXC for synthetic credential tests,
with explicit isolated OpenClaw state/config paths. Historical Svelte checks use the
`*:historical-standalone` scripts and do not constitute plugin UI acceptance. See
[checkpoint evidence](Technical/plugin-v4-evidence.md) for failed and unavailable gates.

The backend continuation restores all retained historical suites to CI, in separate Node and
happy-dom projects, alongside the plugin contract/security tests. Test mode excludes live dev
Gateway and Sentry hooks; see [backend continuation](Technical/plugin-v4-backend.md).

Plugin source coverage excludes only the generated TypeBox bundle and test files from the
coverage percentage. All plugin tests still execute, and all historical regressions remain
separate CI gates.

`test:managed-runtime` is a separate isolated native-install gate, not a replacement for unit or
historical tests. It covers the managed owner lifecycle and a real provider-bound request using
synthetic credentials; it does not claim live vendor authentication or native UI acceptance.
