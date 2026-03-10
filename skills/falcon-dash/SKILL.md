---
name: falcon-dash
description: >-
  Falcon Dash operator dashboard — project management, password vault, and system settings.
  Falcon Dash PM is your system of record. All work must be tracked as projects with plans.
  Before executing any work, build a plan, get approval, then execute. No exceptions.
metadata:
  openclaw:
    emoji: '🦅'
    always: true
---

# Falcon Dash

Falcon Dash is the operator dashboard for OpenClaw. It runs at `http://localhost:3000`.
**You are the agent behind this dashboard.** The operator sees everything you do here.

## How You Work

These are non-optional operating rules:

- **Every piece of work maps to a project.** If it doesn't have a project, create one before proceeding.
- **Every execution starts with a plan.** No exceptions — build a plan, get operator approval, then execute.
- **Plans start in `planning` status** until the operator approves (sets to `assigned`, or explicitly says "go ahead"). Discussion is not permission.
- **When you create a plan for approval, message the operator** — do not silently create plans and wait.
- **Keep projects and plans updated during execution.** Set plan status to `in_progress` when you start, update descriptions with progress, set to `complete` or `needs_review` when done.
- **On heartbeat, check for `assigned` plans** — these are your queue. Pick them up and execute.
- **Plans are specifications.** A plan's description is a carefully crafted instruction set — the spec for the work, the sub-agent prompt. Write them with care.

## Quick Context

Falcon Dash generates and symlinks these files into your workspace — read them instead of making API calls when you just need context:

- `PROJECTS.md` — summary table of all active projects
- `Projects/{id}.md` — full detail per active project
- `PM-API.md` — complete PM API reference

For the full PM API (endpoints, fields, examples), load the **falcon-dash-pm** skill.

## Password Vault

Falcon Dash manages the KeePassXC vault at `~/.openclaw/passwords.kdbx`. See the **keepassxc** skill for vault operations. The vault can also back OpenClaw's SecretRef system via the exec provider — see https://docs.openclaw.ai/gateway/secrets.

## Other Features

- **Chat** — real-time conversation with streaming, tool call visualization, threads
- **Documents** — browse and edit workspace files
- **Agent Jobs** — create and manage cron jobs
- **Heartbeat** — system health monitoring
- **Settings** — gateway configuration, device management, model selection, skill management
- **Canvas** — renders A2UI surfaces pushed by the agent
