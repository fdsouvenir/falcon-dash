# Plan: PM Module Restructure — v0.17.0

## Summary

Restructure the project management module from Domain → Focus → Project to **Category → Project** with subcategory as a project attribute. Add Plans with auto-versioning.

---

## Phase 1: Database Schema Migration

### Rename & restructure tables

1. **Rename `domains` → `categories`**
   - Same columns: `id` (slug), `name`, `description`, `sort_order`, `created_at`
   - Add `color` column (TEXT, hex color string, default null — UI picks from a palette)
   - Seed defaults: `personal` (Personal, #60a5fa) and `work` (Work, #a78bfa)

2. **Rename `focuses` → `subcategories`**
   - Same columns: `id` (slug), `category_id` (FK → categories), `name`, `description`, `sort_order`, `created_at`
   - Scoped per category

3. **Alter `projects` table**
   - Replace `focus_id` with:
     - `category_id` TEXT NOT NULL (FK → categories)
     - `subcategory_id` TEXT (FK → subcategories, nullable/optional)
   - Keep all other columns

4. **New `plans` table**
   ```sql
   CREATE TABLE plans (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     description TEXT,        -- markdown
     result TEXT,             -- markdown
     status TEXT CHECK(status IN ('planning','assigned','in_progress','needs_review','complete','cancelled')) DEFAULT 'planning',
     sort_order INTEGER DEFAULT 0,
     created_by TEXT DEFAULT 'user',
     created_at INTEGER DEFAULT (unixepoch()),
     updated_at INTEGER DEFAULT (unixepoch())
   );
   ```

5. **New `plan_versions` table**
   ```sql
   CREATE TABLE plan_versions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
     version INTEGER NOT NULL,
     description TEXT,
     result TEXT,
     status TEXT,
     created_by TEXT DEFAULT 'system',
     created_at INTEGER DEFAULT (unixepoch())
   );
   ```
   - Auto-created on every plan edit (description, result, or status change)

6. **Update `activities` table**
   - Add `plan` to `target_type` CHECK constraint
   - Add `plan_created`, `plan_updated`, `plan_status_changed` to `action` CHECK constraint

7. **Update `v_active_projects` view** to join categories instead of focuses/domains

8. **Update FTS triggers** — index plan title + description too

9. **Migration strategy**: 
   - SQLite doesn't support ALTER TABLE RENAME COLUMN well for FKs
   - Use a migration script: create new tables, copy data, drop old tables
   - Map: focus.domain_id → project.category_id, focus.id → project.subcategory_id

---

## Phase 2: Server-side (API + CRUD)

### Rename throughout server code

1. **`database.ts`** — New schema SQL, new interfaces:
   - `Category` (was Domain), `Subcategory` (was Focus), updated `Project`, new `Plan`, `PlanVersion`

2. **`crud.ts`** — Rename all functions:
   - `listDomains` → `listCategories`, `createDomain` → `createCategory`, etc.
   - `listFocuses` → `listSubcategories`, etc.
   - Update project CRUD: `category_id` + `subcategory_id` instead of `focus_id`
   - New plan CRUD: `listPlans`, `getPlan`, `createPlan`, `updatePlan`, `deletePlan`
   - New version functions: `listPlanVersions`, `revertPlanVersion`

3. **`validation.ts`** — Update validators:
   - `validateDomainExists` → `validateCategoryExists`
   - `validateFocusExists` → `validateSubcategoryExists`
   - New `validatePlanStatus` with: `planning`, `assigned`, `in_progress`, `needs_review`, `complete`, `cancelled`
   - Keep project statuses as-is

4. **`events.ts`** — Add `category`, `subcategory`, `plan` to `PMEntityType`

5. **`search.ts`** — Update to include plans in FTS index

6. **`context.ts`** — Update all context generators:
   - Replace domain/focus references with category/subcategory
   - Add plans to project context output

7. **`context-generator.ts`** — Update PROJECTS.md generation:
   - Show Category/Subcategory columns instead of Domain/Focus
   - Include plan summary in per-project files
   - Update PM-API.md with new endpoints

8. **`stats.ts`** — Add plan stats (by status, assigned count)

9. **`index.ts`** — Update barrel exports

### API Routes

1. **Rename route directories:**
   - `routes/api/pm/domains/` → `routes/api/pm/categories/`
   - `routes/api/pm/focuses/` → `routes/api/pm/subcategories/`
   - Keep same CRUD pattern (GET list, POST create, GET/PATCH/DELETE by id, POST reorder)

2. **Update `routes/api/pm/projects/` handlers:**
   - Accept `category_id` + `subcategory_id` instead of `focus_id`
   - Filter by `category_id` and/or `subcategory_id`

3. **New `routes/api/pm/plans/` routes:**
   ```
   GET    /api/pm/plans?project_id=N          # List plans for project
   POST   /api/pm/plans                       # Create plan
   GET    /api/pm/plans/{id}                  # Get plan
   PATCH  /api/pm/plans/{id}                  # Update plan (auto-versions)
   DELETE /api/pm/plans/{id}                  # Delete plan
   POST   /api/pm/plans/reorder              # Reorder plans
   GET    /api/pm/plans/{id}/versions         # List versions
   POST   /api/pm/plans/{id}/revert          # Revert to version {version}
   ```

4. **Update context routes** — `/api/pm/context/domain/{id}` → `/api/pm/context/category/{id}`

5. **Backward compatibility**: Add redirect or alias from old domain/focus endpoints (optional, can skip if only agent uses the API)

---

## Phase 3: Client Stores

1. **Rename `pm-domains.ts` → `pm-categories.ts`**
   - `Domain` → `Category` (add `color` field)
   - `Focus` → `Subcategory`
   - All functions renamed accordingly

2. **Update `pm-projects.ts`**
   - `Project` interface: `category_id` + `subcategory_id` instead of `focus_id`
   - Update create/update function signatures

3. **New `pm-plans.ts` store**
   - `Plan`, `PlanVersion` interfaces
   - CRUD functions: `loadPlans`, `createPlan`, `updatePlan`, `deletePlan`
   - Version functions: `loadPlanVersions`, `revertPlanVersion`

4. **Update `pm-store.ts`** — Hydrate categories/subcategories instead of domains/focuses

5. **Update `pm-operations.ts`** — Rename context types

---

## Phase 4: UI Overhaul — Projects Page

### ProjectList.svelte (complete rewrite)

**Header area:**
- Stats bar (same concept, updated labels)
- Filter pills: Active | All | Done | Archived
- **+ New Project** button (opens create modal/drawer)
- Search input (inline, filters visible list)

**List layout:**
- Group by Category (collapsible sections)
- Each category header shows: name, color accent, project count, expand/collapse
- Category colors come from DB (user-defined), not hardcoded CSS vars
- Within each category, optionally group by subcategory (subtle sub-headers)
- Project rows: colored left accent (category color), title, subcategory badge, status pill, priority, due date, plan count indicator
- Click row → opens detail panel

**Create Project modal/drawer:**
- Title (required)
- Category (required, dropdown)
- Subcategory (optional, dropdown filtered by selected category)
- Status, Priority, Due date
- Description (text input)
- Body (markdown editor — can be simple textarea initially)

### ProjectDetail.svelte (major update)

**Header:**
- Back button, breadcrumb (Category / Subcategory)
- Editable title (click to edit)
- Status dropdown (click pill to change)
- Priority dropdown
- Due date picker
- Category / Subcategory dropdowns

**Tabs:**
- **Overview** — project body (markdown rendered, click to edit)
- **Plans** — list of plans with:
  - Each plan: title, status badge, description preview
  - Click plan to expand: full description (md), result (md), version history
  - Create plan button
  - Edit plan inline (markdown editors for description and result)
  - Status dropdown per plan
  - Version history sidebar/drawer: list versions, diff view, revert button
- **Activity** — same as current

### New: Settings > Projects tab

Add a **"Projects"** tab to the Settings page:

**Categories section:**
- List of categories with color swatch, name, edit/delete buttons
- Reorder via drag or arrows
- Add category: name + color picker
- Delete category (warn if projects exist)

**Subcategories section:**
- Dropdown to select category (filter)
- List of subcategories for selected category
- Add/edit/delete/reorder

---

## Phase 5: Design System Updates

1. **Remove hardcoded domain colors** from `design-tokens.ts` and `app.css`
   - Remove `DOMAIN_COLORS`, `DOMAIN_CLASSES`, `getDomainColor`, `getDomainClasses`
   - Remove `--domain-personal`, `--domain-work`, `--domain-condo`, `--domain-verl` CSS vars
   - Category colors now come from the DB `color` column

2. **Add plan status mappings** to design tokens:
   ```ts
   PLAN_STATUS_MAP = {
     planning: 'info',
     assigned: 'purple',
     in_progress: 'active',
     needs_review: 'warning',
     complete: 'active',
     cancelled: 'muted'
   }
   ```

3. **Update `pm-utils.ts`**:
   - Remove `DOMAIN_ACCENT_COLORS`, `getDomainAccentColor`
   - Add plan status formatting helpers
   - Category accent color comes from the category object itself

---

## Phase 6: Skill & Context Updates

1. **Update `SKILL.md`** in `~/.openclaw/skills/falcon-dash/`:
   - Replace all domain/focus references with category/subcategory
   - Document new plan endpoints
   - Document plan versioning
   - Update example curl commands

2. **Context generator** outputs updated PM-API.md automatically

3. **Update `TOOLS.md`** in workspace — rename Domains to Categories in Notion section header if relevant

---

## Migration Script

Run automatically on startup (in `getDb()` or via a migration version check):

1. Check if `domains` table exists and `categories` doesn't → run migration
2. Create new tables
3. Copy domains → categories (add default color based on name or null)
4. Copy focuses → subcategories  
5. For each project: look up focus → get domain_id as category_id, focus_id as subcategory_id
6. Rebuild projects table with new schema
7. Drop old tables (domains, focuses)
8. Rebuild FTS index
9. Store migration version in a `pm_meta` table

---

## Version: 0.17.0

Tag as `v0.17.0` — breaking change to PM data model.
