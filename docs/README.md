# Falcon Dash Documentation

`docs/` is the system of record for Falcon Dash product behavior, architecture, operating rules,
and approved contracts. A document must say whether it describes the current product, a future
roadmap target, or a retained contract. Do not present planned behavior as shipped behavior.

## Start here

- [PURPOSE.md](PURPOSE.md) — product intent, audience, and non-negotiable product boundaries
- [ROADMAP.md](ROADMAP.md) — the v3 through v5 product sequence and the desired post-v5 system
- [HARNESS.md](HARNESS.md) — repo execution and validation model
- [OWNERSHIP.md](OWNERSHIP.md) — code-to-document ownership and update requirements
- [QUALITY.md](QUALITY.md) — validation levels and rerun expectations
- [LEARNINGS.md](LEARNINGS.md) — only lessons durable across the full roadmap

## Current product documentation

These files describe the implementation that exists now.

### End-user behavior

- [End User/quick-start.md](End%20User/quick-start.md)
- [End User/work.md](End%20User/work.md)
- [End User/passwords.md](End%20User/passwords.md)
- [End User/secrets.md](End%20User/secrets.md)
- [End User/channels.md](End%20User/channels.md)
- [End User/documents.md](End%20User/documents.md)
- [End User/jobs.md](End%20User/jobs.md)
- [End User/heartbeat.md](End%20User/heartbeat.md)
- [End User/operations.md](End%20User/operations.md)
- [End User/apps.md](End%20User/apps.md)
- [End User/agents.md](End%20User/agents.md)
- [End User/skills.md](End%20User/skills.md)
- [End User/exec-approvals.md](End%20User/exec-approvals.md)
- [End User/settings.md](End%20User/settings.md)
- [End User/troubleshooting.md](End%20User/troubleshooting.md)

### Technical implementation

- [Technical/architecture.md](Technical/architecture.md) — current system boundaries and request flow
- [Technical/components.md](Technical/components.md) — current Svelte shell and component conventions
- [Technical/stores.md](Technical/stores.md) — current browser state and realtime wiring
- [Technical/gateway-protocol.md](Technical/gateway-protocol.md) — server-side OpenClaw transport
- [Technical/gateway-plugin.md](Technical/gateway-plugin.md) — Falcon-specific plugin extensions
- [Technical/work-management.md](Technical/work-management.md) — current Work implementation
- [Technical/deployment.md](Technical/deployment.md) — supported same-host runtime and packaging
- [secretrefs.md](secretrefs.md) — built-in KeePassXC vault as an OpenClaw SecretRef provider

### Frontend and repo operation

- [DESIGN.md](DESIGN.md) — visual language and tokens
- [FRONTEND.md](FRONTEND.md) — frontend implementation constraints
- [RELIABILITY.md](RELIABILITY.md) — state, realtime, and failure-mode expectations
- [CONSOLE-SWEEP.md](CONSOLE-SWEEP.md) — route-based browser console verification
- [CONTRIBUTING-HARNESS.md](CONTRIBUTING-HARNESS.md) — satisfying harness checks
- [HARNESS-LOOP.md](HARNESS-LOOP.md) — recursive local work loop
- [PLANS.md](PLANS.md) — execution-plan expectations

## Retained contracts

[Technical/v3/](Technical/v3/README.md) contains the approved v3 product contracts. They preserve the
contract and decision record behind the current Work implementation. They are not a substitute for
the current technical overview above, and historical names or sequencing inside them do not make a
surface current again.

## Optional deployment profiles

[Technical/fredbot-integration.md](Technical/fredbot-integration.md) records one optional managed
hosting profile. Falcon Dash must not depend on it, and core product or installation instructions
must not route through it.

## Documentation classes

| Class            | Meaning                                           | Update rule                                                   |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| Current          | Describes code and UI that ship now               | Must change with the owning code                              |
| Roadmap          | Describes an approved future target               | Must identify its target version and never imply availability |
| Contract         | Preserves an approved semantic or design contract | Amend explicitly; do not silently rewrite history             |
| Optional profile | Describes one deployment integration              | Must remain outside core product requirements                 |

Unclassified historical notes, screenshots, abandoned proposals, and implementation diaries do not
belong in `docs/`. Git history and closed issues retain that information.
