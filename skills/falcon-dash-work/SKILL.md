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
```

List filters:

- `type`
- `status`
- `area_id`
- `includeClosed=true`
- `limit`

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

- `WORK.md` — Work Queue
- `Work/W-{id}.md` — Work item details for project/change items
- `WORK-API.md` — Work API reference
