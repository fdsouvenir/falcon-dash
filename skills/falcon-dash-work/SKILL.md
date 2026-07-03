---
name: falcon-dash-work
description: >-
  Work Management API for Falcon Dash. Use when creating, updating, inspecting, migrating,
  or listing operator work. Work is the only active Falcon Dash work system.
metadata:
  openclaw:
    emoji: '🦅'
---

# Falcon Dash Work API

Base URL: `http://localhost:3000/api/work`

Work is the agent-facing source of truth for Falcon Dash. Old PM data may exist on disk only as
archived migration input; there is no active PM API.

## Object Types

- `area` — evergreen responsibility bucket
- `project` — bounded outcome with a finish line
- `task` — concrete next action
- `decision` — approval/review/judgment point
- `routine` — standing operator loop with cadence/run history
- `observation` — captured event or finding
- `change` — bounded approval/execution unit for code/config/migration/deploy/system work

Evidence is attached through evidence refs/provenance. It is not standalone work.

## ID References

Use object-type references in human/operator conversation: `Change 176`, `Project 4`,
`Routine 12`, `Decision 9`, etc. Use raw `id` values in API/debug contexts. Do not prefix
all Work items as `W-{id}`. The `W-` prefix is reserved for generated context filenames where
collision-proof file names are useful.

## Statuses

`backlog`, `planning`, `ready`, `in_progress`, `waiting`, `needs_review`, `blocked`,
`scheduled`, `complete`, `cancelled`, `archived`

## Queue

```
GET /api/work/queue
```

Returns actionability buckets:

- `nextActions`
- `needsOperator`
- `waitingOnOperator`
- `waitingOnAgent`
- `waitingOnExternal`
- `needsReview`
- `scheduledRoutines`
- `staleCleanup`
- `blockedRisky`

`waitingOnFred` is still returned as a legacy alias for older callers. Prefer the operator-focused
bucket names in new code, docs, and generated context.

## Items

```
GET    /api/work/items
POST   /api/work/items
GET    /api/work/items/{id}
PATCH  /api/work/items/{id}
GET    /api/work/items/{id}/relationships
POST   /api/work/items/{id}/relationships
DELETE /api/work/items/{id}/relationships
GET    /api/work/items/{id}/reconciliation
POST   /api/work/items/{id}/session
POST   /api/work/reconcile
```

List filters:

- `type`
- `status`
- `area_id`
- `parent_item_id`
- `includeClosed=true`
- `limit`

## Relationships and Reconciliation

Use relationships when one Work item gates another instead of encoding that dependency only in
title/body text:

- `depends_on`: `from_item_id` waits for `to_item_id`
- `blocks`: `from_item_id` blocks `to_item_id`
- `relates_to`: contextual relationship
- `derived_from`: provenance relationship

Falcon Dash runs Work integrity after Work mutations. The agent is the Work steward; deterministic
code only handles explicit mechanical consequences. Closed dependencies/blockers can clear
downstream `blocked` or `waiting` state when that state is proven by `depends_on` or `blocks`
relationships. Semantic cleanup belongs to the agent: decisions, evidence interpretation,
project `next_action`, and narrative summaries.

When stale-risk remains, Falcon Dash opens or reuses a contextual agent session with an AXI-style
packet: root project, touched item, related Work, relationships, evidence refs, recent activity,
mechanical changes, stale-risk candidates, and concrete `/api/work/*` templates.

Agent role:

- You are the Work steward for the project. Keep Work coherent, current, and operator-useful.
- Use deterministic mechanical facts as hints, not as a substitute for judgment.
- If Work state needs to change, call `/api/work/*`; do not reply with prose only.
- Close or update stale blockers, decisions, and next actions only when context and evidence support it.
- Include a concise `result` or `next_action` when changing Work.
- When uncertain, leave the item open, record what is missing, and set the appropriate waiting state.
- Prefer structured relationships over prose.
- Keep operator-facing output short: what changed, what is blocked, and the next real move.

Create example:

```bash
curl -X POST http://localhost:3000/api/work/items \
  -H "Content-Type: application/json" \
  -d '{
    "type": "task",
    "title": "Validate migration fixture",
    "status": "ready",
    "owner": "agent",
    "priority": "normal",
    "next_action": "Run Work migration tests"
  }'
```

## Migration

```
GET  /api/work/migration/preview
POST /api/work/migration/apply
```

Migration reads the archived PM database in read-only mode and writes to the separate Work database.
The archived PM database remains untouched on disk as fallback source material.

## Context

```
GET /api/work/context
```

Generated context files become Work-first once migration apply marks Work as source of truth:

- `WORK.md` — compact Work home view with counts, definitive `0 results` empty states, capped queue rows, detail-file links, and next-command templates
- `Work/W-{id}.md` — full active Work item detail with type-plus-ID heading and item-specific update templates
- `WORK-API.md` — Work API reference, filters, and mutation examples
- `FALCON-DASH.md` — Falcon Dash context directory and module guidance

Read `WORK.md` first for current state. Open `Work/W-{id}.md` or call `GET /items/{id}` only when
the compact row is insufficient.
