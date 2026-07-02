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

- `project` — bounded outcome with a finish line, health, timeline, and attached work
- `milestone` — progress marker or checkpoint
- `next_step` — concrete action, usually starting with a verb
- `open_question` — unresolved knowledge with answerer, impact, and optional blocker
- `decision` — unresolved commitment with options, recommendation, and no-decision consequence
- `change_request` — controlled mutation of code, config, systems, data, auth, deployment, or automation
- `finding` — captured fact, discovery, source-backed note, or evidence summary
- `automation` — recurring or triggered work backed by cron, heartbeat, webhook, or manual runs

Evidence is attached through evidence refs/provenance. It is not standalone work.

Blocker relationships are explicit Work links. They show what item is stuck, whether the blocker is
another Work item or an external person/system/source, why it is blocked, and the next unblock
move. Links clarify status; they do not replace the item's `blocked` or `waiting` status.

Categories and subcategories are setup records, not Work item types. Use `/categories` to list or
maintain them and `category_id`/`subcategory_id` item filters to group operational work.
Deleting a category or subcategory removes that directory entry and unassigns linked Work items.

## ID References

Use object-type references in human/operator conversation: `Change Request 176`, `Project 4`,
`Automation 12`, `Decision 9`, etc. Use raw `id` values in API/debug contexts. Do not prefix
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
- `failedAutomations`
- `scheduledAutomations`
- `staleCleanup`
- `blockedRisky`

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
- `category_id`
- `subcategory_id`
- `area_id` (legacy/internal alias)
- `parent_item_id`
- `includeClosed=true`
- `limit`

## Categories

```
GET    /api/work/categories
POST   /api/work/categories
GET    /api/work/categories/{id}
PATCH  /api/work/categories/{id}
DELETE /api/work/categories/{id}
GET    /api/work/blockers
POST   /api/work/blockers
GET    /api/work/blockers/{id}
PATCH  /api/work/blockers/{id}
DELETE /api/work/blockers/{id}
GET    /api/work/change-log
```

Public fields are `id`, `title`, `description`, `kind`, and `parent_category_id`.

## Blockers

```
GET    /api/work/blockers
POST   /api/work/blockers
GET    /api/work/blockers/{id}
PATCH  /api/work/blockers/{id}
DELETE /api/work/blockers/{id}
```

List filters:

- `project_id`
- `blocked_item_id`
- `blocker_item_id`
- `state=active|resolved|all`
- `limit`

Create fields:

- `blocked_item_id`
- `blocker_source`: `work_item`, `person`, `system`, or `external`
- `blocker_item_id` for Work-item blockers
- `external_label` for person/system/external blockers
- `reason`
- `unblock_action`

## Change Log

```
GET /api/work/change-log
```

Filters:

- `project_id`
- `entity_type`
- `entity_id`
- `area_id`
- `limit`

Rows include the changed entity, project/category/parent scope at the time of the event, a human
summary, and structured `changes` entries with field labels plus before/after values.

Create example:

```bash
curl -X POST http://localhost:3000/api/work/items \
  -H "Content-Type: application/json" \
  -d '{
    "type": "next_step",
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
- `Work/W-{id}.md` — Work item details for active Work items
- `WORK-API.md` — Work API reference
