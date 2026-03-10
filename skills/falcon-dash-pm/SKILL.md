---
name: falcon-dash-pm
description: >-
  PM API for creating and managing projects, plans, categories, and subcategories in Falcon Dash
metadata:
  openclaw:
    emoji: '🦅'
---

# Falcon Dash PM API

Base URL: `http://localhost:3000/api/pm`

All list endpoints return: `{ items: [...], total, page, limit, hasMore }`

**IDs:** Projects — numeric. Categories and subcategories — string slugs. Plans — numeric.

**Project statuses:** `todo`, `in_progress`, `review`, `done`, `cancelled`, `archived`

**Plan statuses:** `planning`, `assigned`, `in_progress`, `needs_review`, `complete`, `cancelled`

**Priorities:** `low`, `normal`, `high`, `urgent`

**Dates:** ISO 8601 `YYYY-MM-DD`

---

## Categories

```
GET    /api/pm/categories                    # List (page, limit)
POST   /api/pm/categories                    # Create: {id, name, description?}
GET    /api/pm/categories/{id}               # Get
PATCH  /api/pm/categories/{id}               # Update: {name?, description?}
DELETE /api/pm/categories/{id}               # Delete
POST   /api/pm/categories/reorder            # Reorder: {ids: [...]}
```

## Subcategories

```
GET    /api/pm/subcategories                 # List (category_id, page, limit)
POST   /api/pm/subcategories                 # Create: {id, category_id, name, description?}
GET    /api/pm/subcategories/{id}            # Get
PATCH  /api/pm/subcategories/{id}            # Update: {name?, description?, category_id?}
DELETE /api/pm/subcategories/{id}            # Delete
POST   /api/pm/subcategories/{id}/move       # Move: {category_id}
POST   /api/pm/subcategories/reorder         # Reorder: {ids: [...]}
```

## Projects

```
GET    /api/pm/projects                      # List (subcategory_id?, category_id?, status?, priority?, page, limit)
POST   /api/pm/projects                      # Create (see fields below)
GET    /api/pm/projects/{id}                 # Get
PATCH  /api/pm/projects/{id}                 # Update
DELETE /api/pm/projects/{id}                 # Delete
```

**Create/update fields:** `subcategory_id`, `title`, `description?`, `body?`, `status?`, `priority?`, `due_date?`

## Plans

```
GET    /api/pm/plans                         # List (project_id required, status?, page, limit)
POST   /api/pm/plans                         # Create: {project_id, title, description?, status?, priority?, due_date?}
GET    /api/pm/plans/{id}                    # Get
PATCH  /api/pm/plans/{id}                    # Update: {title?, description?, status?, priority?, due_date?}
DELETE /api/pm/plans/{id}                    # Delete
POST   /api/pm/plans/reorder                 # Reorder: {ids: [...]}
```

### Plan Versions

```
GET    /api/pm/plans/{id}/versions           # List versions
GET    /api/pm/plans/{id}/versions/{version} # Get specific version
POST   /api/pm/plans/{id}/revert/{version}   # Revert to version
```

## Activities

```
GET    /api/pm/activities                    # List (project_id required, page, limit)
```

Read-only — auto-generated on every project/plan mutation.

## Search

```
GET    /api/pm/search                        # Full-text (q required, entity_type?, project_id?, limit?, offset?)
```

## Context

```
GET    /api/pm/context                       # Dashboard overview (markdown)
POST   /api/pm/context                       # Force context file regeneration
GET    /api/pm/context/project/{id}          # Project detail (markdown)
GET    /api/pm/context/category/{id}         # Category detail (markdown)
```

## Stats

```
GET    /api/pm/stats                         # PM statistics
```

---

## Examples

### Create a project with plans

```bash
# 1. Create the project
curl -X POST http://localhost:3000/api/pm/projects \
  -H "Content-Type: application/json" \
  -d '{
    "subcategory_id": "marketing",
    "title": "Q1 Campaign",
    "status": "in_progress",
    "priority": "high",
    "body": "## Goals\n- Launch by March\n- 10k impressions"
  }'

# 2. Create a plan for the project (replace 42 with the returned project id)
curl -X POST http://localhost:3000/api/pm/plans \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 42,
    "title": "Draft campaign copy",
    "description": "Write headline, body copy, and CTA for three ad variants targeting SMB segment.",
    "status": "planning",
    "priority": "high"
  }'
```

### Move a plan to assigned (operator approval)

```bash
curl -X PATCH http://localhost:3000/api/pm/plans/7 \
  -H "Content-Type: application/json" \
  -d '{"status": "assigned"}'
```
