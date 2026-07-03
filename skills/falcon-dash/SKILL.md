---
name: falcon-dash
description: >-
  Falcon Dash operator dashboard — Work Management, password vault, channels, and system settings.
  Falcon Dash Work is your system of record. All work must be tracked as Work objects.
  Before code/config/system work, build a Change, get approval, then execute. No exceptions.
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

- **Every piece of work maps to Work.** Use the right object type: Area, Project, Task, Decision, Routine, Observation, or Change.
- **Every code/config/system mutation starts with an approved Change.** No exceptions — build the Change, get operator approval, then execute.
- **Changes start in `planning` status** until the operator approves (sets to `ready`, or explicitly says "go ahead"). Discussion is not permission.
- **When you create a Change for approval, message the operator** — do not silently create Changes and wait.
- **Set Changes to `in_progress` the moment you start working.** Do not skip this — the operator and UI rely on accurate status. Update descriptions with progress. When done, **write a result summary** and set status to `complete` or `needs_review`.
- **On heartbeat, check the Work Queue** — these are your queue buckets. Pick up Work items waiting on the agent and execute approved Changes.
- **Changes are specifications.** A Change description is a carefully crafted instruction set — the spec for the work. Write it with care.
- **Refer to Work by object type, not a universal prefix.** In human/operator conversation, say `Change 176`, `Project 4`, `Routine 12`, etc. Use raw `id` fields in API/debug contexts. Do not call everything `W-{id}`; the `W-` prefix is reserved for generated context filenames where collision-proof file names are useful.

### Sub-agent Execution

When dispatching work to sub-agents (ACP sessions, acpx, etc.):

1. **Set each Change to `in_progress`** before dispatching the sub-agent
2. **Create a 5-min monitoring cron** — `systemEvent`, `sessionTarget: main`, with session IDs, plan numbers, and reporting channel in the text
3. **On each cron fire**, poll the sessions and report status to the originating channel
4. **When all work completes**, set Changes to `complete`, remove the cron, verify commits, tag and push

## Quick Context

Falcon Dash generates and symlinks these files into your workspace — read them instead of making API calls when you just need context:

- `WORK.md` — compact source-of-truth home view with counts, explicit `0 results` empty states, capped queue rows, detail-file links, and concrete next-command templates
- `Work/W-{id}.md` — full detail per active Work item, with type-plus-ID heading and item-specific update templates
- `WORK-API.md` — complete Work API reference, filters, and mutation examples
- `FALCON-DASH.md` — context directory and Falcon Dash module guidance

Treat `WORK.md` like the first tool result: read the content before asking for help text. Open
`Work/W-{id}.md` or call `/api/work/items/{id}` only when the compact row is not enough.

For the full Work API (endpoints, fields, examples), load the **falcon-dash-work** skill.

## Password Vault

Falcon Dash manages the KeePassXC vault at `~/.openclaw/passwords.kdbx`. See the **keepassxc** skill for vault operations. The vault can also back OpenClaw's SecretRef system via the exec provider — see https://docs.openclaw.ai/gateway/secrets.

## Other Features

- **Chat** — real-time conversation with streaming, tool call visualization, threads
- **Documents** — browse and edit workspace files
- **Agent Jobs** — create and manage cron jobs
- **Heartbeat** — system health monitoring
- **Settings** — gateway configuration, device management, model selection, skill management
- **Canvas** — renders A2UI surfaces pushed by the agent
