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

Base URL: `/api/work`, or `{public-origin}/api/work` when generated `FALCON-DASH.md` lists a
public dashboard URL.

Work is the agent-facing source of truth for Falcon Dash. Old PM data may exist on disk only as
archived migration input; there is no active PM API.

## Object Types

- `project` — bounded outcome with a finish line, health, timeline, and attached work
- `milestone` — short project-local checkpoint shown inside a project, not a standalone browse surface
- `task` — concrete action, usually starting with a verb
- Needs Resolution — operator-facing queue for unresolved knowledge and unresolved commitments
  - `open_question` — API/storage variant for missing knowledge, answerer, impact, and optional blocker
  - `decision` — API/storage variant for a commitment, options, recommendation, and no-decision consequence
- `change_request` — controlled mutation of code, config, systems, data, auth, deployment, or automation
- `finding` — captured fact, discovery, source-backed note, or evidence summary
- `automation` — recurring or triggered work backed by cron, heartbeat, webhook, or manual runs

Evidence is attached through evidence refs/provenance. It is not standalone work.

In user-facing Work UI and operator conversation, use "Needs Resolution." Use the specific API
variant only when creating or filtering records: `open_question` for missing knowledge and
`decision` for a commitment, approval, or choice with options.

Blocker relationships are explicit Work links. They show what item is stuck, whether the blocker is
another Work item or an external person/system/source, why it is blocked, and the next unblock
move. Links clarify status; they do not replace the item's `blocked` or `waiting` status.

Projects use `current_next_item_id` for the visible "Next up" item. It points at an active task,
Needs Resolution variant, or change request in the project. A project is blocked only when that
pointed item is blocked/waiting or actively blocked; later blocked tasks are shown in the project
plan without making the whole project blocked. Tasks do not have child tasks or child next steps.

Categories and subcategories are setup records, not Work item types. Use `/categories` to list or
maintain them and `category_id`/`subcategory_id` item filters to group operational work.
Deleting a category or subcategory removes that directory entry and unassigns linked Work items.

## ID References

Use inline Markdown links for specific Work objects in human/operator conversation when generated
`FALCON-DASH.md` lists a public dashboard URL. Use the object reference as link text and the public
route as the URL: `Project 4` points to `{public-origin}/work/projects/4`, `Task 12` points to
`{public-origin}/work/tasks/12`, `Needs Resolution 9` points to
`{public-origin}/work/needs-resolution/9`, and `Change Request 176` points to
`{public-origin}/work/change-requests/176`.

Never use `localhost`, `127.0.0.1`, or relative paths for operator-facing object links. If no
public origin is available, use plain object-type references: `Change Request 176`, `Project 4`,
`Automation 12`, `Needs Resolution 9`, etc.

Use raw `id` values in API/debug contexts. Do not prefix all Work items as `W-{id}`. The `W-`
prefix is reserved for generated context filenames where collision-proof file names are useful.

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
- `category_id`
- `subcategory_id`
- `area_id` (legacy/internal alias)
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

Project pointer field:

- `current_next_item_id`

## Categories

```
GET    /api/work/categories
POST   /api/work/categories
GET    /api/work/categories/{id}
PATCH  /api/work/categories/{id}
DELETE /api/work/categories/{id}
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
curl -X POST "{public-origin}/api/work/items" \
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
