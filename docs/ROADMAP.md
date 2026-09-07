# Falcon Dash Roadmap

This document separates the current product from approved future work. It is the source for version
sequencing; it does not claim that future modules already ship.

## Current: 4.0 — one OpenClaw plugin

Falcon Dash 4.0 is a single installable OpenClaw plugin with four internal modules. It requires
OpenClaw 2026.8.1 or later and carries no awareness of any prior Falcon Dash version — no
migration, conversion, legacy detection or compatibility code, and no standalone web application.

- **Work** — the shared human-and-agent source of truth: the reconciled domain model, immutable
  Definition/Plan/Result revisions, event history, relationships, provenance and authority
  semantics, plus typed agent projections and bounded session context.
- **Integrations** — structured provider/account records with purpose, capabilities, scopes,
  expiry, health, validation, audit history and reauthorization; provider adapters for validation,
  refresh, keepalive and rotation; an internal scheduler for credential lifecycle work.
- **Vault** — built-in KeePassXC storage, scoped operations, private recovery snapshots, and
  server-side SecretRef resolution. Raw credentials stay behind SecretRefs.
- **Documents** — the workspace file browser and editor, including durable trash and restore.

Falcon Dash lifecycle schedules are not OpenClaw automations. They have separate ownership,
persistence, execution and failure semantics even if a UI presents both coherently.

The domain contract is issue
[#363](https://github.com/fdsouvenir/falcon-dash/issues/363); its body is the current spec and its
comments are chronological history including reversals. The implementation overview lives in
[Technical/plugin-v4-backend.md](Technical/plugin-v4-backend.md).

## What OpenClaw owns instead

The pre-4.0 roadmap sequenced Integrations, then contextual conversations, then a dedicated mobile
product, as separate Falcon Dash versions. OpenClaw 2026.9.x now owns most of that natively, so
those versions do not exist:

| Retired plan                                      | Why it is gone                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Separate Integrations release                     | Integrations is a 4.0 module, not a version of its own                                                      |
| Contextual conversations                          | Control UI chat already shows sessions, tool activity and approvals                                         |
| Dedicated mobile product                          | The plugin renders inside Control UI, which owns the responsive shell                                       |
| Channels, apps, jobs, ops, heartbeat, shell, labs | Channel onboarding, agents, approvals, skills, automations and canvas apps are all native OpenClaw surfaces |

## System shape

Falcon Dash and OpenClaw run on the same box. Remote gateway support and any dependency on a
provider-specific backend are outside the supported product boundary.

The integration points are deliberate:

- **Plugin runtime:** registered through the OpenClaw plugin SDK; no separate server, port, or
  session transport of its own.
- **Native Control UI:** Falcon surfaces render inside the host UI rather than a competing shell.
- **Built-in vault:** KeePassXC storage plus server-side SecretRef resolution.
- **Two schedulers:** OpenClaw runs native agent Automations; Falcon Dash runs integration
  lifecycle jobs.
- **External dependencies:** provider APIs and the model/tool services OpenClaw already uses. No
  external Falcon Dash control plane or external vault is required.
