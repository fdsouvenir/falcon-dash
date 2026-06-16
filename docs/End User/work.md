# Work

Work is Falcon Dash's operator queue and agent-facing source of truth.

Use `/work` to inspect active projects, tasks, decisions, routines, changes, blocked items, and
items waiting on Fred or the agent.

## What It Shows

- Queue buckets for next actions, review, waiting states, blocked/risky work, and routines
- Recent Work items with type, status, priority, and last update
- Work data generated from the new `~/.openclaw/data/falcon-dash/work.db` database

## Agent Contract

Agents should use `/api/work/*` or generated context files:

- `WORK.md`
- `WORK-API.md`
- `FALCON-DASH.md`
- `Work/W-{id}.md`

The former work interface is not part of active Falcon Dash.
