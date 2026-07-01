---
name: falcon-dash
description: >-
  Falcon Dash operator dashboard — Work Management, password vault, channels, and system settings.
  Falcon Dash Work is your system of record. All work must be tracked as Work objects.
  Before code/config/system work, build a Change Request, get approval, then execute. No exceptions.
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

- **Every piece of work maps to Work.** Use the right object type: Area, Project, Milestone, Next Step, Open Question, Decision, Change Request, Finding, or Automation.
- **Every code/config/system mutation starts with an approved Change Request.** No exceptions — build the Change Request, get operator approval, then execute.
- **Change Requests start in `planning` status** until the operator approves (sets to `ready`, or explicitly says "go ahead"). Discussion is not permission.
- **When you create a Change Request for approval, message the operator** — do not silently create Change Requests and wait.
- **Set Change Requests to `in_progress` the moment you start working.** Do not skip this — the operator and UI rely on accurate status. Update descriptions with progress. When done, **write a result summary** and set status to `complete` or `needs_review`.
- **On heartbeat, check the Work Queue** — these are your queue buckets. Pick up Work items waiting on the agent and execute approved Change Requests.
- **Change Requests are specifications.** A Change Request description is a carefully crafted instruction set — the spec for the work. Write it with care.
- **Refer to Work by object type, not a universal prefix.** In human/operator conversation, say `Change Request 176`, `Project 4`, `Automation 12`, etc. Use raw `id` fields in API/debug contexts. Do not call everything `W-{id}`; the `W-` prefix is reserved for generated context filenames where collision-proof file names are useful.

### Sub-agent Execution

When dispatching work to sub-agents (ACP sessions, acpx, etc.):

1. **Set each Change Request to `in_progress`** before dispatching the sub-agent
2. **Create a 5-min monitoring cron** — `systemEvent`, `sessionTarget: main`, with session IDs, plan numbers, and reporting channel in the text
3. **On each cron fire**, poll the sessions and report status to the originating channel
4. **When all work completes**, set Change Requests to `complete`, remove the cron, verify commits, tag and push

## Quick Context

Falcon Dash generates and symlinks these files into your workspace — read them instead of making API calls when you just need context:

- `WORK.md` — Work Queue and source-of-truth context
- `Work/W-{id}.md` — full detail per active Work project/change request
- `WORK-API.md` — complete Work API reference

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
