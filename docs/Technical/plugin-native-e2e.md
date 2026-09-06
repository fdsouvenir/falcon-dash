# Native plugin Gateway acceptance

## What CI actually runs

The `CI` workflow first runs source/types, plugin unit/DOM/security tests, 402 retained historical
tests, and the managed-SecretRef/provider-bound proof. Its required `native-e2e` job then calls
`e2e.yml`. There is no `if: false`, success skip, standalone app dev server, or Node 20 host in
that acceptance path. A failing real-Gateway browser test fails the CI workflow.

The native job installs OpenClaw **2026.9.2**, Node from `.nvmrc`, KeePassXC and Chromium into its
disposable GitHub runner. `npm run test:native-e2e` builds and packs the plugin, installs that
archive, and starts the actual pinned Gateway with explicit isolated state/config/workspace paths.
It uses a byte-identical user-owned Node copy; no system Node permissions or ownership change.

The harness has a **test-only identity proxy** on runner loopback. It strips incoming forwarded
identity headers and supplies one of two declared synthetic people to the Gateway's documented
trusted-proxy authenticator. The Gateway creates and returns the durable profile through
`users.self`; the harness does not invent profile IDs or inject `client.internal` objects. The
plugin now accepts this Gateway-populated authenticated profile in addition to an explicit
verified role actor, still denying shared system/owner identities, synthetic delegated clients,
conflicting identity fields and authority changes during async work.

Only the isolated config opts into native Custom plugin UI. Test fixtures include encrypted
human/agent credentials, high-density Work, a document workspace and a paused synthetic
connection. No real provider credentials or third-party authentication are used. No trading,
payment or provider write is exercised. Provider HTTP adapters have separate synthetic tests.

Chromium loads the **real Control UI served by that Gateway**, not a hand-built HTML harness or
mock `host.request`. Desktop and narrow projects run serially. Tests cover native navigation,
Work creation through typed operations, owner credential entry/reveal/copy and lock cleanup,
Documents editing/concurrency/Markdown, persisted integration controls, disconnect/reconnect,
nonowner denial and useful native-opt-in-off guidance. Screenshots mask protected fields. Trace
and video capture are disabled so credential interactions cannot enter those artifacts.

## Commands and evidence

- `npm run test:native-host`: install/start/verify the real Gateway/profile/modules and stop it;
  no browser navigation. This passed locally with the documented proxy boundary.
- `npm run test:native-e2e`: the real browser suite, where browser navigation is authorized.
- `npm run test:e2e`: alias for native Gateway acceptance, not the retired standalone server.
- `playwright.historical.config.ts` and `e2e/` retain historical standalone tests as source;
  they are not the active CI acceptance target and are not counted as native passing tests.
- `artifacts/plugin-v4/native-e2e-*/host-proof.json`: actual Gateway, profile and module evidence.
- `artifacts/plugin-v4/native-screenshots/`: actual desktop/narrow screenshots after a successful
  browser run, including explicitly masked credential inventory and denial states.
- `artifacts/plugin-v4/native-playwright-report/`: browser assertions and failures.

The model's configured local browser denied loopback navigation. That local restriction is
unchanged and was not bypassed with direct local CDP or another local proxy URL. The separately
authorized CI browser suite runs on its own disposable runner, under that runner's policy.
Do not count a host-only proof or offline Happy DOM test as rendered acceptance. A green E2E
result and its screenshots are required before claiming native acceptance.

## Publication boundaries

`release.yml` already depends on the reusable CI workflow; it now transitively requires native
E2E. `publish.yml` also depends on that complete CI workflow and uses pinned SDK/Node/isolated
state during its package checks. These are workflow edits only: no release tag, publication,
production restart, production configuration change or data cutover was triggered.

The first real CI run reached the Gateway's first-run Model Setup page, not a missing plugin or
mock host. Its screenshot showed the supported **Back to app** affordance. The browser helper
now uses that normal navigation before selecting native pages; it does not disable model
verification or invent a verified-model record. Provider-bound inference remains a separate
real-Gateway synthetic-endpoint gate in the quality job.

Independent review regressions cover a listed document replaced by a FIFO or symlink in a
child process with a two-second timeout, pending Reveal/Copy followed by Hide, and dirty
rename both with and without a preceding version conflict. Reads open nonblocking, validate
the descriptor as a single-link regular file, and read no more than 262145 bytes.

The required browser suite now reloads and reads the exact created Task, reloads and
reveals/copies the human-created credential as well as the agent-created credential, and
asserts saved integration pause state after each action and navigation reload. It scopes
slotted form controls through the host modal element: the host's shadow dialog and its
light-DOM content are not DOM descendants for nested Playwright locators.

The Documents browser case also renames its unsaved conflict-recovered draft, verifies the
buffer survives, saves it, restores the original path, then reloads and reads the saved text.
