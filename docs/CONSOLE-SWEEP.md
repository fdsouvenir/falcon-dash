# Console Sweep

This repo includes a manifest-driven browser console sweep for offline-safe routes.

## Goal

The sweep should make browser-side failures inspectable without requiring pasted console logs.

Each run captures:

- `console.error`
- `console.warn`
- uncaught page errors
- failed network requests
- screenshots for routes with unmatched error-level findings

## Command

```bash
npm run console:sweep
```

Or through the local loop:

```bash
npm run agent:loop -- console
```

## Inputs

- [harness/console-routes.json](../harness/console-routes.json) — route inventory and project targeting
- [harness/console-baseline.json](../harness/console-baseline.json) — allowlist for expected known noise

The initial manifest focuses on offline-safe routes. Gateway-dependent routes can be added later.

## Outputs

When run through `agent:loop`, findings land in:

- `artifacts/run-latest/console/findings.json`
- `artifacts/run-latest/console/findings.md`
- `artifacts/run-latest/console/status.json`
- `artifacts/run-latest/console/screenshots/`

## Failure Policy

- unmatched `pageerror`, `console.error`, and `requestfailed` findings fail the sweep
- `console.warn` findings are recorded but do not fail the sweep by default

## Tuning

If the sweep produces expected disconnected-state noise:

1. confirm the route really is offline-safe
2. add the narrowest possible baseline entry
3. avoid broad patterns like `Failed to fetch` unless there is no narrower option
