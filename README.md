# Falcon Dash

**One OpenClaw plugin with Work, Integrations, KeePassXC Vault and Documents.**

> **4.0 carries no awareness of any prior Falcon Dash version** — no migration, conversion or
> legacy detection. It installs onto a machine with no earlier Falcon Dash present; pre-4.0 data is
> handled out of band. See [Clean installation](docs/Technical/plugin-v4.md#clean-installation-no-cutover).

OpenClaw owns the shell, chat, agents, sessions, runtime approvals and Automations. Falcon Dash
adds its Work domain and credential/integration/document capabilities inside that host. It does
not require Fredbot Backend or a separate Falcon web server.

## Implemented backend

- **Work:** immutable Task revisions, explicit assignment/waiting/results, Task-scoped change
  control, review targets, typed dependencies and Asks, derived Project/Milestone behavior,
  Questions, Decisions, Findings, Areas, bounded projections and versioned semantic operations.
- **Integrations:** shared lifecycle/health/audit services, fenced credential rotation and
  HighLevel OAuth backend fixtures. Provider authentication is not claimed from mocked tests.
- **Vault:** real KeePassXC storage, groups, scoped executor grants, human-owner field access,
  redacted access history, lock fencing and a native exec SecretRef resolver.
- **Documents:** authorized text workspaces, safe traversal, stale-edit protection, create/edit,
  transfer, no-clobber rename and recoverable deletion.

The package registers real tools, Gateway methods, typed feature operations, services and four
native Control UI pages, including protected human credential entry/reveal/copy. Native UI is
approved; [native implementation and evidence](docs/Technical/plugin-v4-native-ui.md) distinguish
offline tests from actual rendered acceptance. The baseline at `215111f` passed 20 real-Gateway
desktop/narrow cases on the authorized isolated CI runner. The separate local browser restriction
remains unchanged. Passing those cases is not [full v4 readiness](docs/Technical/plugin-v4-scope.md).

See [current backend coverage and remaining audits](docs/Technical/plugin-v4-backend.md).
The [first checkpoint evidence](docs/Technical/plugin-v4-evidence.md) is explicitly historical;
current PR comments carry later validation results.

## Engineering prerequisites

This preview requires **OpenClaw 2026.9.3 or later**, **Node `>=24.16.0 <25 || >=26.1.0`**, and
**Linux**. KeePassXC CLI,
`flock`, and descriptor-anchored `/proc/self/fd` access are required. TypeBox is bundled with its
license; OpenClaw's SDK remains supplied by the host.

The managed SecretRef preset requires the Gateway's actual Node executable to be owned by the
Gateway user and not group/world writable. A user-owned Node runtime is verified with the real
managed preset, including plugin disable/removal denial; root-owned system Node is incompatible
with this pinned ownership contract. No check was relaxed. See the
[exact compatibility evidence](docs/Technical/plugin-v4-backend.md#native-resolver-verification-and-managed-preset-limitation).

## Build and validate

```sh
npm ci --include=dev
npm run check
npm test
npm run lint
npm run format:check
npm run check:harness
npm run check:docs
npm pack --ignore-scripts
```

`check`, `test`, `test:coverage` and `build` target the plugin; it is the only runtime in this
repo. The published archive contains `plugin/`, `dist/control-ui/`, the manifest, the build script
and the plugin technical docs.

For installation smoke tests, invoke the **absolute pinned OpenClaw entry** with both
`OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH` pointing at isolated synthetic state. Then install
the local archive using `plugins install` and inspect it with `plugins inspect --runtime`.
Never let an experimental binary open an operator's normal OpenClaw state.

`scripts/verify-plugin-prompt.mjs` exercises an isolated real Gateway against a local provider
fixture. It requires the pinned OpenClaw entry and prepared isolated root as explicit positional
arguments. It does not activate native UI, send channel messages, or use real provider credentials.

## What 4.0 does not include

Work read/history/Ask workflows, Vault management and private recovery, connection
explanations/audit/rebinding/Work attention, durable Documents trash, and the release guards are
implemented and verified. What is not in 4.0:

- **The coordination agent is 4.1** — [#367](https://github.com/fdsouvenir/falcon-dash/issues/367).
  4.0 records Work faithfully but cannot notice that nothing has happened. Four Work contract
  changes ship with it; see [the roadmap](docs/ROADMAP.md).
- **No live provider proof.** Adapters are exercised against fixtures. Real application credentials
  and vendor consent are separately authorized, and mocked tests are never reported as live
  authentication.
- **Native UI opt-in has only been enabled in synthetic runtimes.** Production
  `gateway.controlUi.experimental.customPlugins` and its restart remain an operator step.
- **No packaged Vault skill.** The pre-4.0 one targeted retired paths and was removed.

The browser matrix is Chromium desktop and narrow. It is not every browser, arbitrary zoom, or a
pixel recreation of the old standalone shell. See the
[acceptance map](docs/Technical/plugin-v4-scope.md).

`docs/PURPOSE.md` is owner-protected and still contains the superseded standalone direction. It has
not been changed; current issue bodies govern.

## Contributing and security

Read [AGENTS.md](AGENTS.md), [the harness](docs/HARNESS.md), and
[quality requirements](docs/QUALITY.md). Report vulnerabilities according to [SECURITY.md](SECURITY.md),
not by posting credentials or private account data in issues.

License: [CC-BY-NC-ND-4.0](LICENSE); bundled dependency licenses remain with their respective code.
