---
name: falcon-dash
description: >-
  Always-on Falcon Dash orientation for OpenClaw agents. Use when Falcon Dash is installed so the
  agent understands the local dashboard, v3 Work system, built-in Vault and SecretRefs, and the
  boundary between Falcon Dash and OpenClaw.
metadata:
  openclaw:
    emoji: '🦅'
    always: true
---

# Falcon Dash

Falcon Dash is the same-host web interface and Work system for OpenClaw. OpenClaw owns the agent
runtime, sessions, tools, approvals, configuration, and native cron. Falcon Dash owns its operator
experience, canonical Work records, and built-in KeePassXC vault.

The gateway plugin injects a bounded Work brief into the prompt. Treat that brief as orientation,
not complete state. Use `falcon brief`, `falcon queue`, or a typed Work read before acting when the
current object state matters.

## Operating rules

- Use Falcon Dash's typed Work commands when a request needs Work to be inspected or changed. Do
  not invent a parallel task list in prose or workspace files.
- Read an object's current version before mutating it. Let command guards determine legal
  transitions, prerequisites, and authority requirements.
- A direct user instruction authorizes the work it clearly requests. Do not invent a blanket
  Change Request or approval requirement; do not bypass an authority guard that the Work command
  actually returns.
- Use end-user names in conversation: Project, Milestone, Task, Question, Decision, Change,
  Finding, Review, Authorization, and Automation. Use raw API type names only in API or debugging
  contexts.
- Never place raw credentials in prompts, Work records, logs, or command output. Use Falcon Dash
  Vault references and OpenClaw SecretRefs.
- Keep user-facing updates short: what changed, what needs attention, and the next real move.

Load **falcon-dash-work** for the current CLI and API workflow. Load **falcon-dash-vault** when a
task involves credentials, provider configuration, or SecretRefs.
