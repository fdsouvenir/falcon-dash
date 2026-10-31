# OpenClaw Plugin Compatibility Report

Generated: deterministic
Status: PASS

## Summary

| Metric                     | Value |
| -------------------------- | ----- |
| Fixtures                   | 1     |
| High-priority fixtures     | 1     |
| Hard breakages             | 0     |
| Warnings                   | 1     |
| Compatibility suggestions  | 0     |
| Issue findings             | 1     |
| Open issue findings        | 1     |
| Runtime-covered findings   | 0     |
| Runtime-partial findings   | 0     |
| P0 issues                  | 0     |
| P1 issues                  | 0     |
| Open P0 issues             | 0     |
| Open P1 issues             | 0     |
| Live issues                | 0     |
| Live P0 issues             | 0     |
| Compat gaps                | 0     |
| Deprecation warnings       | 0     |
| Inspector gaps             | 0     |
| Open inspector gaps        | 0     |
| Runtime coverage artifacts | 0     |
| Upstream metadata          | 1     |
| Contract probes            | 1     |
| Decision rows              | 0     |

## Triage Overview

| Class               | Count | P0 | Meaning                                                                                                                                                  |
| ------------------- | ----- | -- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| live-issue          | 0     | 0  | Potential runtime breakage in the target OpenClaw/plugin pair. P0 only when it is not a deprecated compat seam.                                          |
| compat-gap          | 0     | -  | Compatibility behavior is needed but missing from the target OpenClaw compat registry.                                                                   |
| deprecation-warning | 0     | -  | Plugin uses a supported but deprecated compatibility seam; keep it wired while migration exists.                                                         |
| inspector-gap       | 0     | -  | Plugin Inspector needs stronger capture/probe evidence before making contract judgments. Runtime-covered rows are proof-backed and not open report work. |
| upstream-metadata   | 1     | -  | Plugin package or manifest metadata should improve upstream; not a target OpenClaw live break by itself.                                                 |
| fixture-regression  | 0     | -  | Fixture no longer exposes an expected seam; investigate fixture pin or scanner drift.                                                                    |

## P0 Live Issues

_none_

## Other Live Issues

_none_

## Compat Gaps

_none_

## Deprecation Warnings

_none_

## Inspector Proof Gaps

_none_

## Runtime-Covered Inspector Gaps

_none_

## Upstream Metadata Issues

- P2 **falcon-dash** `upstream-metadata` `plugin-upstream-fix`
  - **manifest-unknown-fields**: falcon-dash: manifest uses unsupported top-level fields
  - state: open · compat:none
  - evidence:
    - categories @ openclaw.plugin.json
    - icon @ openclaw.plugin.json
  - author remediation:
    - Move unsupported top-level manifest fields into supported package metadata or remove them.
    - docs: https://docs.openclaw.ai/clawhub/plugin-validation-fixes#manifest-unknown-fields

## Hard Breakages

_none_

## Target OpenClaw Compat Records

| Metric                    | Value                                    |
| ------------------------- | ---------------------------------------- |
| Configured path           | npm:openclaw@2026.9.3                    |
| Status                    | ok                                       |
| Requested version         | latest                                   |
| Resolved version          | 2026.9.3                                 |
| Range eligibility version | 2026.9.3                                 |
| Source                    | npm:openclaw                             |
| NPM dist-tag              | latest                                   |
| Prepared cache            | hit                                      |
| Compat registry           | -                                        |
| Compat records            | 0                                        |
| Compat status counts      | -                                        |
| Record ids                | -                                        |
| Hook registry             | dist/agent-harness-runtime-DaJ4mxKg.d.ts |
| Hook names                | 42                                       |
| API builder               | dist/agent-harness-runtime-BwRgV0uy.d.ts |
| API registrars            | 57                                       |
| Captured registration     | dist/agent-harness-runtime-BwRgV0uy.d.ts |
| Captured registrars       | 57                                       |
| Package metadata          | package.json                             |
| Plugin SDK exports        | 338                                      |
| Manifest types            | dist/health-tuyyTTVY.d.ts                |
| Manifest fields           | 76                                       |
| Manifest contract fields  | 22                                       |

## Warnings

| Fixture     | Code                    | Level   | Message                                                                                        | Evidence                                                       | Compat record |
| ----------- | ----------------------- | ------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------- |
| falcon-dash | manifest-unknown-fields | warning | manifest uses top-level fields that are not present in the target OpenClaw PluginManifest type | categories @ openclaw.plugin.json, icon @ openclaw.plugin.json | -             |

## Suggestions To OpenClaw Compat Layer

_none_

## Issue Findings

- P2 **falcon-dash** `upstream-metadata` `plugin-upstream-fix`
  - **manifest-unknown-fields**: falcon-dash: manifest uses unsupported top-level fields
  - state: open · compat:none
  - evidence:
    - categories @ openclaw.plugin.json
    - icon @ openclaw.plugin.json
  - author remediation:
    - Move unsupported top-level manifest fields into supported package metadata or remove them.
    - docs: https://docs.openclaw.ai/clawhub/plugin-validation-fixes#manifest-unknown-fields

## Contract Probe Backlog

- P2 **falcon-dash** `manifest-loader`
  - contract: Manifest top-level fields are represented in target OpenClaw PluginManifest.
  - id: `manifest.schema.top-level-fields:falcon-dash`
  - evidence:
    - categories @ openclaw.plugin.json
    - icon @ openclaw.plugin.json

## Fixture Seam Inventory

| Fixture     | Priority | Seams        | Hooks               | Registrations                                                                              | Manifest contracts           |
| ----------- | -------- | ------------ | ------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| falcon-dash | high     | dynamic-tool | before_prompt_build | definePluginEntry, registerGatewayMethod, registerHttpRoute, registerService, registerTool | gatewayMethodDispatch, tools |

## Decision Matrix

_none_

## Raw Logs

| Fixture     | Code                    | Level | Message                                                                               | Evidence                                                                                                                                                                                                                                              | Compat record |
| ----------- | ----------------------- | ----- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| falcon-dash | seam-inventory          | log   | observed 1 hooks, 5 registrations, and 2 manifest contracts                           | hook:before_prompt_build, registration:definePluginEntry, registration:registerGatewayMethod, registration:registerHttpRoute, registration:registerService, registration:registerTool, manifestContract:gatewayMethodDispatch, manifestContract:tools | -             |
| falcon-dash | hook-names-present      | log   | all observed hooks exist in the target OpenClaw hook registry                         | before_prompt_build                                                                                                                                                                                                                                   | -             |
| falcon-dash | api-registrars-present  | log   | all observed api.register* calls exist in the target OpenClaw plugin API builder      | registerGatewayMethod, registerHttpRoute, registerService, registerTool                                                                                                                                                                               | -             |
| falcon-dash | sdk-exports-present     | log   | all observed plugin SDK imports exist in target OpenClaw package exports              | openclaw/plugin-sdk/control-ui, openclaw/plugin-sdk/feature-contract, openclaw/plugin-sdk/feature-plugin, openclaw/plugin-sdk/gateway-method-runtime, openclaw/plugin-sdk/gateway-runtime, openclaw/plugin-sdk/plugin-entry                           | -             |
| falcon-dash | manifest-fields-checked | log   | plugin manifest fields were compared with target OpenClaw manifest types              | openclaw.plugin.json                                                                                                                                                                                                                                  | -             |
| falcon-dash | package-metadata        | log   | selected package metadata for plugin contract checks                                  | package.json, @fdsouvenir/falcon-dash, version:4.4.0                                                                                                                                                                                                  | -             |
| falcon-dash | declarative-contracts   | log   | fixture declares manifest contracts that can be checked without executing plugin code | gatewayMethodDispatch, tools                                                                                                                                                                                                                          | -             |
