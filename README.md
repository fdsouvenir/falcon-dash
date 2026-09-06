# Falcon Dash

**One OpenClaw plugin with Work, Integrations, KeePassXC Vault and Documents.**

> This branch is an **incomplete engineering preview**, not a production release. Do not replace a
> live installation or supply real credentials based on these test results. Implementation is
> tracked in [#364](https://github.com/fdsouvenir/falcon-dash/issues/364) and
> [draft PR #366](https://github.com/fdsouvenir/falcon-dash/pull/366).

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

This preview is pinned to **OpenClaw 2026.9.2**, **Node 22.16+**, and **Linux**. KeePassXC CLI,
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
npm run check:skills
npm run check:historical-standalone
npm run test:historical-standalone -- --maxWorkers=1 --no-file-parallelism
npm pack --ignore-scripts
```

`check`, `test`, `test:coverage` and `build` target the plugin. The `*:historical-standalone`
commands retain regression coverage for the previous implementation; they do not launch or prove
the new UI. Historical Svelte routes and retired modules are not included in the plugin archive.

For installation smoke tests, invoke the **absolute pinned OpenClaw entry** with both
`OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH` pointing at isolated synthetic state. Then install
the local archive using `plugins install` and inspect it with `plugins inspect --runtime`.
Never let an experimental binary open an operator's normal OpenClaw state.

`scripts/verify-plugin-prompt.mjs` exercises an isolated real Gateway against a local provider
fixture. It requires the pinned OpenClaw entry and prepared isolated root as explicit positional
arguments. It does not activate native UI, send channel messages, or use real provider credentials.

## Not a release or cutover

Remaining gates are the explicitly unsettled #363 domain decisions, current packaged skill
authoring, real provider/application consent and dataset-specific identity/disposition review.
Work read/history/Ask workflows, Vault management/private recovery and legacy conversion,
connection explanations/audit/rebinding/Work attention, durable Documents trash, and release/
offline-placement guards are now implemented. See the [acceptance map](docs/Technical/plugin-v4-scope.md)
and [installed-artifact/recovery guide](docs/Technical/plugin-v4-installation.md). No full-product
or production readiness is inferred from a bounded browser matrix.
The current supported provider-request fixture is not proof for every OpenClaw harness/provider.

[Conversion and rollback preparation](docs/Technical/plugin-v4.md#deferred-controlled-cutover-not-executed)
is engineering recovery work, not an in-app migration product. No merge, publication, production
restart, live data migration or standalone-service retirement is part of this preview.

`docs/PURPOSE.md` is owner-protected and still contains the superseded standalone direction. It
has not been changed; current issue bodies govern this conversion.

## Contributing and security

Read [AGENTS.md](AGENTS.md), [the harness](docs/HARNESS.md), and
[quality requirements](docs/QUALITY.md). Report vulnerabilities according to [SECURITY.md](SECURITY.md),
not by posting credentials or private account data in issues.

License: [CC-BY-NC-ND-4.0](LICENSE); bundled dependency licenses remain with their respective code.
