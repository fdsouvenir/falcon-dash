# Issue #250 — Mobile-First PWA: Implementation Team Plan

> **Date:** 2026-02-17
> **Status:** Phases 0–3 complete. Phase 4 next (BLOCKED on Fred's design decisions).
> **Inputs:** Scope Analyst report, Architecture Reviewer report, codebase exploration, mockup review
> **Output location:** `builddocs/issue-250-team-plan.md`

---

## 1. Team Composition

### Guiding Principles

- **Short-lived agents per phase**, not marathon sessions. Each agent spawns, completes its phase tasks, and terminates.
- **Maximum 3-4 concurrent agents** per phase. The codebase has ~95 components and significant shared-file contention — more agents means more coordination overhead.
- **File ownership is strict.** No two agents edit the same file in the same phase. Shared files are edited by a single designated agent per phase.

### Agent Roster (per-phase, not permanent)

| Agent Name | Type | Specialization | Lifespan |
|---|---|---|---|
| `infra-agent` | general-purpose | CSP, PWA, service worker, app.html, hooks.server.ts | Phase 0 only |
| `shell-agent` | general-purpose | MobileShell, BottomTabBar, layout, navigation, shared mobile components | Phase 1 only |
| `chat-agent` | general-purpose | Chat view, message composer, markdown pipeline, chat header | Phase 1 only |
| `pm-server-agent` | general-purpose | PM server extraction, REST API routes, context generator | Phase 1-2 |
| `pages-agent` | general-purpose | Jobs, Settings, Connection pages (mockup-backed pages) | Phase 2 only |
| `pm-cli-agent` | general-purpose | `ocpm` CLI tool | Phase 2 only |
| `cleanup-agent` | general-purpose | PM frontend simplification, dead code removal, touch audit | Phase 3 only |
| `generic-pages-agent` | general-purpose | Documents, Passwords, Heartbeat mobile (after Fred provides design direction) | Phase 4 only |

**Total across all phases:** 8 agent roles, never more than 4 concurrent.

---

## 2. File Ownership Map

### Shared Files — Single-Writer Rule

These files are touched by multiple workstreams. Only ONE agent may edit each file per phase.

| File | Phase 0 Owner | Phase 1 Owner | Phase 2 Owner | Phase 3 Owner |
|---|---|---|---|---|
| `src/hooks.server.ts` | `infra-agent` | — | — | — |
| `src/app.html` | `infra-agent` | — | — | — |
| `src/app.css` | `infra-agent` | `shell-agent` | — | `cleanup-agent` |
| `src/routes/+layout.svelte` | — | `shell-agent` | — | — |
| `src/lib/components/AppShell.svelte` | — | `shell-agent` | — | — |
| `src/lib/components/Sidebar.svelte` | — | `shell-agent` | — | — |
| `static/manifest.json` | `infra-agent` | — | — | — |

### Per-Agent File Ownership

**`infra-agent` (Phase 0):**
- `src/hooks.server.ts` — CSP fix (add `worker-src 'self'`)
- `src/app.html` — Apple PWA meta tags
- `static/manifest.json` — enhance with screenshots, categories
- `src/lib/pwa/service-worker-registration.ts` — enhance registration
- `static/sw.js` — create basic service worker (app shell caching)
- `src/app.css` — add CSS custom properties for responsive typography scale

**`shell-agent` (Phase 1):**
- `src/lib/components/MobileShell.svelte` — NEW: bottom tab bar, per-route header, mobile navigation
- `src/lib/components/BottomTabBar.svelte` — NEW: extracted tab bar component
- `src/lib/components/MobileHeader.svelte` — NEW: per-route header with back button
- `src/lib/components/BottomSheet.svelte` — NEW: shared bottom sheet component
- `src/lib/components/MobileCard.svelte` — NEW: reusable card component
- `src/routes/+layout.svelte` — add `isMobile` detection, `MobileShell` vs `AppShell` branch
- `src/lib/components/AppShell.svelte` — minor: ensure it only renders on desktop
- `src/lib/components/Sidebar.svelte` — minor: hide completely on mobile (MobileShell handles nav)
- `src/lib/components/MobileLayout.svelte` — DELETE (replaced by MobileShell)
- `src/lib/components/MobileAdaptations.svelte` — DELETE (dead code)
- `src/app.css` — add mobile utility classes, bottom-safe-area padding

**`chat-agent` (Phase 1):**
- `src/lib/components/ChatView.svelte` — mobile-first redesign matching chat-home.png mockup
- `src/lib/components/MessageComposer.svelte` — sticky bottom, mobile keyboard handling
- `src/lib/components/ChatHeader.svelte` — mobile header with agent name/avatar/settings icon
- `src/lib/components/MarkdownRenderer.svelte` — remove KaTeX CDN link, add lazy-load
- `src/lib/chat/markdown.ts` — lazy-load KaTeX and rehype-katex on first math detection
- `src/lib/components/ThinkingBlock.svelte` — mobile-friendly collapsible
- `src/lib/components/ToolCallCard.svelte` — mobile-friendly card layout
- `src/lib/components/ReplyPreview.svelte` — compact mobile variant
- `src/lib/components/SlashCommandMenu.svelte` — full-width bottom sheet on mobile
- `src/routes/+page.svelte` — welcome screen with quick-action chips (per mockup)
- `src/lib/components/TokenEntry.svelte` — mobile connection setup (per connection-setup.png)

**`pm-server-agent` (Phase 1-2):**
- `src/lib/server/pm/` — NEW directory: `database.ts`, `crud.ts`, `search.ts`, `stats.ts`, `context.ts`, `validation.ts`, `bulk.ts`, `index.ts`
- `src/routes/api/pm/` — NEW: 15 route files (domains, focuses, projects, tasks, comments, blocks, search, stats, context)
- Does NOT touch any frontend files or stores

**`pages-agent` (Phase 2):**
- `src/lib/components/CronJobList.svelte` — mobile redesign per cron-jobs-list.png
- `src/lib/components/CronJobForm.svelte` — mobile redesign per cron-jobs-edit mockups
- `src/lib/components/CronRunHistory.svelte` — mobile card layout
- `src/routes/jobs/+page.svelte` — mobile layout
- `src/lib/components/settings/SettingsPage.svelte` — complete redesign: grouped list nav per settings-top.png
- `src/lib/components/settings/*.svelte` — each settings sub-page gets mobile treatment
- `src/routes/settings/+page.svelte` — route-level layout
- `src/lib/components/ConnectionErrorBanner.svelte` — mobile-friendly

**`pm-cli-agent` (Phase 2):**
- `cli/` — NEW directory: `ocpm` CLI tool
- `cli/src/index.ts`, `cli/src/commands/*.ts`, `cli/package.json`, `cli/tsconfig.json`
- Does NOT touch any Falcon Dash source files

**`cleanup-agent` (Phase 3):**
- `src/lib/stores/pm-store.ts` — rewrite: remove gateway `call()`, use HTTP fetch to `/api/pm/*`
- `src/lib/stores/pm-domains.ts` — rewrite for HTTP
- `src/lib/stores/pm-operations.ts` — rewrite for HTTP
- `src/lib/stores/pm-projects.ts` — rewrite for HTTP
- `src/lib/stores/pm-events.ts` — rewrite or remove
- `src/lib/components/pm/` — delete `KanbanBoard.svelte`, `DependencyGraph.svelte`, `BulkActions.svelte`, `PMSearch.svelte`, `AIContextPanel.svelte`; simplify remaining to read-only
- `src/routes/projects/+page.svelte` — simplified read-only view
- Touch target audit across all components (44px minimum)
- `src/app.css` — final responsive typography scale

**`generic-pages-agent` (Phase 4, BLOCKED on Fred's design decisions):**
- `src/lib/components/DocumentBrowser.svelte` — mobile list+viewer
- `src/lib/components/DocumentEditor.svelte` — mobile viewer (read-only on mobile)
- `src/routes/documents/+page.svelte`
- `src/lib/components/PasswordList.svelte` — mobile list
- `src/lib/components/PasswordDetail.svelte` — mobile detail view
- `src/routes/passwords/+page.svelte`
- `src/lib/components/HeartbeatPanel.svelte` — mobile dashboard cards
- `src/lib/components/HeartbeatHistory.svelte` — mobile history
- `src/routes/heartbeat/+page.svelte`

---

## 3. Phased Execution Plan

### Phase 0: Immediate Blockers (1 day, 1 agent) — COMPLETE

**Agent:** `infra-agent`
**Goal:** Remove all blockers for PWA and mobile work.

| Task | File(s) | Est. | Status |
|---|---|---|---|
| Fix CSP: add `worker-src 'self'`, `script-src 'self'` for SW | `src/hooks.server.ts` | 15 min | Done |
| Add Apple PWA meta tags to app.html | `src/app.html` | 30 min | Done |
| Enhance manifest.json (screenshots, categories, orientation) | `static/manifest.json` | 30 min | Done |
| Create basic service worker (app shell cache, offline fallback) | `static/sw.js` | 2-3 hrs | Done |
| Add CSS custom properties for responsive type scale | `src/app.css` | 1 hr | Done |
| Verify: `npm run build` succeeds, SW registers, PWA installable | — | 1 hr | Done |

**Quality Gate:** PWA scores 80+ on Lighthouse. Service worker registers and caches app shell. `npm run check && npm run lint` pass.

### Phase 1: Core Mobile Shell + Chat + PM Server (5-7 days, 3 agents in parallel) — COMPLETE

Three agents worked simultaneously with zero file overlap. Committed as `c90fe8d` (64 files changed, 4139 insertions, 414 deletions).

**Agent 1: `shell-agent`** — Mobile navigation infrastructure

| Task | Est. |
|---|---|
| Create `MobileShell.svelte` with bottom tab bar (Chat, Jobs, Settings, More) | 1 day |
| Create `BottomTabBar.svelte`, `MobileHeader.svelte` (per-route back button + title) | 0.5 day |
| Create `BottomSheet.svelte` shared component (for modals/menus on mobile) | 0.5 day |
| Modify `+layout.svelte`: `isMobile` media query, branch to MobileShell vs AppShell | 0.5 day |
| Delete dead code: `MobileLayout.svelte`, `MobileAdaptations.svelte` | 0.5 day |
| Wire SvelteKit routing to bottom tabs (Chat=`/`, Jobs=`/jobs`, Settings=`/settings`, More=overlay) | 1 day |
| Mobile-safe CSS utilities in `app.css` (safe-area insets, touch-action) | 0.5 day |

**Acceptance criteria:**
- On viewport < 768px: bottom tab bar visible, sidebar hidden, per-route header renders
- On viewport >= 768px: existing AppShell + Sidebar unchanged
- Tab navigation works with SvelteKit client-side routing (no full page reloads)
- `npm run check && npm run lint && npm run format:check` pass

**Agent 2: `chat-agent`** — Chat view mobile-first

| Task | Est. |
|---|---|
| Redesign `ChatView.svelte` to match chat-home.png: centered welcome, quick-action chips, full-width messages | 2 days |
| Make `MessageComposer.svelte` sticky-bottom with mobile keyboard handling (`visualViewport` API) | 1 day |
| Redesign `ChatHeader.svelte`: agent avatar + name center, hamburger left, settings gear right | 0.5 day |
| Lazy-load KaTeX: remove CDN link from `MarkdownRenderer.svelte`, detect `$$` or `$` in content before importing rehype-katex | 1 day |
| Mobile-friendly `ThinkingBlock`, `ToolCallCard`, `ReplyPreview` | 1 day |
| Redesign `TokenEntry.svelte` to match connection-setup.png mockup | 0.5 day |
| Redesign `SlashCommandMenu.svelte` as bottom sheet on mobile | 0.5 day |

**Acceptance criteria:**
- Chat home matches mockup: centered "How can I help you today?", quick-action chips, sticky composer at bottom
- Connection setup matches mockup: token field, "Ask your agent" card, troubleshooting card
- KaTeX CSS only loads when message contains math notation
- Messages render full-width on mobile, max-width on desktop
- `npm run check && npm run lint && npm run format:check` pass

**Agent 3: `pm-server-agent`** — PM backend extraction

| Task | Est. |
|---|---|
| Create `src/lib/server/pm/` by extracting from `openclaw-pm/src/` (database, crud, search, stats, context, validation, bulk) | 2 days |
| Adapt `database.ts`: use env var for DB path, remove gateway plugin deps | 0.5 day |
| Create 15 REST API route files at `src/routes/api/pm/` following existing `files/` pattern | 2 days |
| Add pagination (`?page=1&limit=20`), standard error format `{error: string, code: string}` | 0.5 day |
| Adapt `context.ts` to write `PROJECTS.md` and `Projects/*.md` files on mutation | 1 day |

**Acceptance criteria:**
- All PM CRUD operations work via HTTP (test with curl)
- `GET /api/pm/projects?page=1&limit=20` returns paginated results
- Context files generated at `~/.openclaw/workspace/PROJECTS.md` on project create/update
- Existing frontend (still using gateway calls) is NOT broken — old path still works
- `npm run check && npm run lint && npm run format:check` pass

**Quality Gate (end of Phase 1):** All passed.
- Mobile shell renders correctly on iPhone SE (375px), iPhone 14 (390px), Pixel 7 (412px) viewports
- Chat view matches mockup on mobile, unchanged on desktop
- PM API responds correctly to HTTP requests
- Full build succeeds: `npm run build`
- `npm run check` — 0 errors (107 pre-existing warnings)
- `npm run lint` — clean
- `npm run format` — all files formatted

#### Phase 1 Lessons Learned

1. **ESLint `svelte/no-navigation-without-resolve` rule:** New Svelte components with `<a href>` links trigger this lint rule. The existing `Sidebar.svelte` already uses an eslint-disable comment for it. Mobile navigation components (BottomTabBar, MobileHeader, MoreSheet) needed the same treatment. Future agents creating nav components should add `<!-- eslint-disable svelte/no-navigation-without-resolve -- static local routes -->` upfront.

2. **File organization for mobile components:** Placing all mobile shell components under `src/lib/components/mobile/` worked well for file ownership isolation. The flat `src/lib/components/` directory has ~50 files — the subdirectory kept the new components clearly scoped and avoided naming collisions.

3. **Viewport store pattern:** Using a Svelte readable store wrapping `matchMedia('(max-width: 767px)')` in `src/lib/stores/viewport.ts` provides a clean single source of truth for `isMobile`. The `chat-agent` independently used local `matchMedia` checks inside components — both approaches work, but the store is preferable for consistency. Future phases should prefer the `isMobile` store.

4. **KaTeX lazy loading works well:** Splitting the unified markdown pipeline into base (no KaTeX) and math-enhanced (with KaTeX) pipelines avoids loading ~300KB of KaTeX CSS/JS on every page. The two-pipeline approach in `markdown.ts` is clean — first math render may briefly flash unstyled, but subsequent renders pick up the cached processor.

5. **PM server extraction was straightforward:** The `openclaw-pm/` plugin code was well-structured enough to copy with minimal adaptation. Key change: `database.ts` needed `$env/dynamic/private` for DB path instead of hardcoded paths. FTS5 triggers were inlined into the schema to avoid circular imports between `database.ts` and `search.ts`. The 27 REST API routes all follow the same template pattern.

6. **3-agent parallel execution had zero conflicts:** The strict file ownership model (shell owns layout/css/mobile, chat owns chat components, pm-server owns server/api) resulted in no merge conflicts or contention. This validates the team plan's single-writer rule.

7. **Dead code deletion confirmed safe:** `MobileLayout.svelte`, `MobileAdaptations.svelte`, and `TouchGestures.svelte` had zero imports — grep confirmed no references. Deleting them reduced confusion since the new `mobile/` directory replaces their intent entirely.

### Phase 2: Secondary Pages + CLI (5-7 days, 3 agents in parallel) — COMPLETE

Three agents worked simultaneously with zero file overlap. All three completed successfully.

**Agent 1: `pages-agent`** — Jobs + Settings mobile redesign

| Task | File(s) | Status |
|---|---|---|
| Mobile cron job list (card layout, toggles, search, actions) | `MobileCronJobList.svelte` (NEW) | Done |
| Mobile cron job form (full-page, preset grid, preview) | `MobileCronJobForm.svelte` (NEW) | Done |
| Mobile cron run history (card per run, tap-to-expand) | `MobileCronRunHistory.svelte` (NEW) | Done |
| Settings nav data structure (4 groups, 12 items) | `settings/settings-nav-items.ts` (NEW) | Done |
| Settings drill-down manager | `MobileSettingsPage.svelte` (NEW) | Done |
| Settings grouped home nav | `MobileSettingsHome.svelte` (NEW) | Done |
| 11 settings sub-pages (wired + stubs) | `settings/*.svelte` (11 NEW) | Done |
| Jobs route `isMobile` branch | `src/routes/jobs/+page.svelte` | Done |
| Settings route `isMobile` branch | `src/routes/settings/+page.svelte` | Done |
| ConnectionErrorBanner mobile fix | `ConnectionErrorBanner.svelte` | Done |

**Agent 2: `pm-cli-agent`** — `ocpm` CLI

| Task | File(s) | Status |
|---|---|---|
| Scaffold `cli/` directory (package.json, tsconfig, .gitignore) | `cli/` (NEW) | Done |
| PMClient class wrapping all API endpoints | `cli/src/client.ts` (NEW) | Done |
| Hand-rolled table/JSON/markdown formatter | `cli/src/format.ts` (NEW) | Done |
| Commander entry point with `--url` and `--format` globals | `cli/src/index.ts` (NEW) | Done |
| 9 command groups (domain, focus, project, task, comment, block, search, stats, context) | `cli/src/commands/*.ts` (9 NEW) | Done |

**Agent 3: `pm-server-agent`** — Context generator + event emissions

| Task | File(s) | Status |
|---|---|---|
| Context file writer (PROJECTS.md + Projects/*.md) | `context-generator.ts` (NEW) | Done |
| Dirty flag + debounce scheduler | `context-scheduler.ts` (NEW) | Done |
| Scheduler startup in server hooks | `src/hooks.server.ts` | Done |
| POST handler for manual trigger | `context/+server.ts` | Done |
| Re-exports in barrel file | `src/lib/server/pm/index.ts` | Done |
| Event emissions in 19 mutation route files (~25 insertion points) | `src/routes/api/pm/**` (19 files) | Done |

**Quality Gate (end of Phase 2):** All passed.
- Mobile jobs page shows card layout with toggles, search, Run Now/Delete actions
- Mobile settings shows iOS-style grouped navigation with drill-down to 11 sub-pages
- Desktop layout completely unchanged for both pages
- `ocpm` CLI builds cleanly, all 9 command groups implemented
- Context files generated at `~/.openclaw/workspace/PROJECTS.md` on server startup
- PM mutations trigger event emissions → debounced context regeneration
- `npm run check` — 0 errors (131 warnings, all pre-existing)
- `npm run lint` — clean
- `npm run format` — all files formatted
- `npm run build` — success (7.89s)
- `cd cli && npm run build` — success

#### Phase 2 Lessons Learned

1. **New mobile components go in subdirectories, not alongside desktop components.** The plan originally specified modifying desktop components (CronJobList, SettingsPage) for mobile. The better pattern (adopted during execution) was creating NEW mobile-specific components in `src/lib/components/mobile/` and branching at the route level with `$isMobile`. This means zero risk of desktop regression and clean separation of concerns. The settings drill-down pages further organized into `mobile/settings/` subdirectory — 11 pages is too many to dump flat in `mobile/`.

2. **`$isMobile` store bridging is boilerplate-heavy but reliable.** Every component using `isMobile` from `src/lib/stores/viewport.ts` needs the same `$effect(() => { const unsub = isMobile.subscribe(v => { mobile = v }); return unsub; })` pattern since it's a Svelte 4 store used in Svelte 5 rune components. This is consistent with the Phase 1 pattern from `CronJobList.svelte` and other existing components. If the project ever moves to Svelte 5 stores, this boilerplate disappears.

3. **Settings page complexity justified the nav-items data file.** Extracting the settings navigation structure into `settings-nav-items.ts` (groups, items, icons, subtitles) was critical. It made `MobileSettingsHome.svelte` purely presentational (just iterates the data) and `MobileSettingsPage.svelte` a simple switch on item ID. Adding a new settings page is now just: add an entry to the data file + create the page component.

4. **"Wired" vs "stub" settings pages are a clean pattern.** Pages like LogsPage and ChannelsPage just import and render the existing desktop component (`LiveLogs`, `DiscordSetup`) inside the mobile page shell. Stub pages (Skills, Hooks, Language, Subscription) show "Coming Soon" with an icon. This let us ship all 11 pages without blocking on unimplemented features.

5. **CLI tool was the fastest agent — entirely greenfield.** The `pm-cli-agent` finished first because it created all-new files with zero codebase dependencies. The hand-rolled table formatter (measure column widths, pad with spaces) was simpler than pulling in a dependency. Commander's `optsWithGlobals()` cleanly passes the `--format` flag from the root program to subcommands.

6. **Event emissions in 19 route files is tedious but mechanical.** Each file needed: read existing code, add `import { emitPMEvent }`, add `emitPMEvent()` call after each mutation. The pattern is identical across all files. For DELETE handlers on tasks, the agent correctly read the entity BEFORE deleting to capture `parent_project_id` for the event. This was the most time-consuming agent task due to sheer file count.

7. **Context scheduler design: dirty flag + debounce is the right approach.** Rather than regenerating on every single mutation (which could be dozens per second during bulk operations), the 5-second debounce with 60-second max staleness interval ensures files are fresh without excessive I/O. The initial generation is delayed 1 second after server startup to let the DB initialize.

8. **Three parallel agents with strict file ownership had zero conflicts again.** Same result as Phase 1. The file ownership matrix (pages-agent owns `mobile/**` + route pages, pm-cli-agent owns `cli/**`, pm-server-agent owns `server/pm/` + `api/pm/` routes) had zero overlap. This pattern continues to validate well.

### Phase 3: PM Frontend + Polish (4-5 days, 1 agent) — COMPLETE

Single `cleanup-agent` with strict file ownership over PM stores, PM components, projects page, and `app.css`.

**Agent: `cleanup-agent`**

| Task | File(s) | Status |
|---|---|---|
| Delete 7 unused PM components (~2,377 lines) | `KanbanBoard`, `DependencyGraph`, `BulkActions`, `PMSearch`, `AIContextPanel`, `CreateEntityDialog`, `PMNavTree` | Done |
| Create `pm-api.ts` fetch wrapper | `src/lib/stores/pm-api.ts` (NEW) | Done |
| Rewrite `pm-store.ts`: HTTP, remove optimistic updates + event handler | `pm-store.ts` (264→120 lines) | Done |
| Rewrite `pm-domains.ts`: 18 `call()` → `fetch()`, remove event subscriptions | `pm-domains.ts` (319→210 lines) | Done |
| Rewrite `pm-projects.ts`: 12 `call()` → `fetch()`, remove event subscriptions | `pm-projects.ts` (237→155 lines) | Done |
| Rewrite `pm-operations.ts`: 20 `call()` → `fetch()` | `pm-operations.ts` (228→195 lines) | Done |
| Delete `pm-events.ts` (gateway event subscriptions) | `pm-events.ts` (58 lines) | Done |
| Remove stale `checkPMAvailability` import from `gateway.ts` | `src/lib/stores/gateway.ts` | Done |
| Simplify `ProjectList.svelte` to read-only card grid | `ProjectList.svelte` (544→98 lines) | Done |
| Simplify `ProjectDetail.svelte` to read-only modal | `ProjectDetail.svelte` (778→200 lines) | Done |
| Simplify `TaskDetailPanel.svelte` to read-only panel | `TaskDetailPanel.svelte` (695→185 lines) | Done |
| Verify `PMDashboard.svelte` works with migrated stores | `PMDashboard.svelte` (no changes) | Done |
| Rewrite `projects/+page.svelte` (flat layout, no nav tree) | `+page.svelte` (147→65 lines) | Done |
| Touch target audit (44px minimums baked into rewrites) | All PM components | Done |
| Remove dead CSS custom properties from `app.css` | `src/app.css` (~20 lines removed) | Done |

**Quality Gate (end of Phase 3):** All passed.
- Zero `call('pm.*')` references in `src/lib/stores/` and `src/lib/components/pm/`
- Projects page shows read-only card grid, click opens detail modal, click task opens detail panel
- Full-screen modals on mobile, slide-in panels on desktop
- All interactive elements in PM components have ≥ 44px touch targets
- Gateway PM plugin (`openclaw-pm/`) can now be safely removed
- `npm run check` — 0 errors (71 warnings, all pre-existing)
- `npm run lint` — clean
- `npm run format` — all files formatted
- `npm run build` — success

#### Phase 3 Lessons Learned

1. **REST API response format matters for migration.** The PM REST API returns `{ items: [...], total, page, limit, hasMore }` for list endpoints — NOT the `{ domains: [...] }` or `{ projects: [...] }` format the gateway RPC used. The `pm-api.ts` helper abstracts this, but every store function needed to destructure `.items` instead of the entity-specific key. Read the actual API route handlers before migrating, don't assume the response shape matches the gateway.

2. **REST API uses PATCH, not PUT, for updates.** The API routes define `PATCH` handlers (not `PUT`), which is correct REST semantics for partial updates. The `pm-api.ts` helper needed a `pmPatch` function alongside `pmPost`. The plan originally specified `pmPut` — always check the actual route handlers.

3. **`checkPMAvailability` changed from sync subscription to async HTTP.** The old version returned an unsubscribe function from `snapshot.features.subscribe()` and was called at module init time in `gateway.ts`. The new HTTP version is async and needs to be called on page mount. This required removing the stale import and call from `gateway.ts` — a dependency not listed in the plan. Grep for imports of any function whose signature changes.

4. **Deleting more components than planned was necessary.** The plan listed 5 components to delete. During execution, `CreateEntityDialog.svelte` (566 lines, pure write forms) and `PMNavTree.svelte` (283 lines, nav sidebar) were also deletable since the read-only page doesn't create entities and uses a flat card grid instead of domain/focus navigation. Total: 7 components, ~2,377 lines deleted. Always verify actual imports before committing to a deletion list.

5. **`TaskDetailPanel` had a hidden gateway dependency.** The original `loadSubtasks()` function directly imported `call` from `gateway.ts` inside an async dynamic import (line 117-119: `const response = await import('$lib/stores/gateway.js'); const result = await response.call(...)`) to work around the store's void return type. This was not caught by a simple grep for `call('pm.` at the top-level import. The rewrite replaced this with a direct `pmGet` call.

6. **Single-agent execution for cleanup phases is the right call.** Unlike Phases 1-2 where parallel agents had clear file ownership boundaries, Phase 3's changes were deeply interconnected: store interfaces had to match component expectations, deleted components had to be removed from the page simultaneously, and the page rewrite depended on all store + component changes being complete. A single agent completing tasks sequentially avoided any coordination overhead.

7. **Dead CSS custom properties confirmed by grep.** The responsive type scale vars (`--text-xs` through `--text-2xl`) defined in Phase 0 were never referenced by any component. A quick grep confirmed zero usage. Removing them (~20 lines including the media query) cleaned up `app.css` without risk. Always verify "unused" CSS with a project-wide grep before deleting.

8. **Touch targets baked into rewrites are more efficient than a separate audit pass.** Rather than rewriting components first and then auditing touch targets as a separate task, the rewrites incorporated `min-h-[44px]` and adequate padding from the start. This avoided a second editing pass and ensured consistency.

### Phase 4: Design-Gap Pages (8-10 days, 1-2 agents, BLOCKED)

**BLOCKED on Fred's design decisions.** See Section 5 below.

**Agent 7: `generic-pages-agent`** (spawned after Fred approves designs)

| Task | Est. |
|---|---|
| Documents: mobile list + full-screen viewer | 3 days |
| Passwords: mobile list + detail + vault unlock | 2 days |
| Heartbeat: dashboard cards with status indicators | 2 days |
| Canvas: desktop-only feature gate (show "Open on desktop" message on mobile) | 0.5 day |

### Phase 5: Push Notifications + Final Polish (5-7 days, future)

Not part of the initial implementation team. Requires:
- Gateway protocol extension for push subscription management
- VAPID key generation and server-side push sending
- iOS 16.4+ PWA testing on real devices

---

## 4. Agent Task Descriptions (Spawn Prompts)

### `infra-agent` — Phase 0

```
You are implementing PWA infrastructure fixes for Falcon Dash (Issue #250, Phase 0).

SCOPE: CSP fix, Apple PWA meta tags, service worker, responsive CSS foundations.

FILES YOU OWN (only you edit these):
- src/hooks.server.ts
- src/app.html
- static/manifest.json
- static/sw.js (CREATE)
- src/app.css

READ FIRST:
- CLAUDE.md (project conventions)
- builddocs/issue-250-team-plan.md (this plan)
- src/hooks.server.ts (current CSP — line 13 is missing worker-src)
- src/app.html (missing Apple meta tags)
- static/manifest.json (needs screenshots, categories)
- src/lib/pwa/service-worker-registration.ts (registers /sw.js)

TASKS:
1. Fix CSP in hooks.server.ts: add `worker-src 'self'` and ensure `script-src` allows service worker
2. Add Apple PWA meta tags to app.html: apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, apple-touch-icon
3. Enhance manifest.json: add orientation: "any", categories: ["productivity"], prefer_related_applications: false
4. Create static/sw.js: basic service worker that caches app shell (HTML, CSS, JS bundles), serves cache-first for assets, network-first for API calls, offline fallback page
5. Add CSS custom properties to app.css for responsive type scale: --text-base (16px mobile, 15px desktop), --text-sm, --text-lg, etc.

ACCEPTANCE CRITERIA:
- `npm run build` succeeds
- `npm run check` passes
- `npm run format` has been run
- Service worker registers successfully (check in browser DevTools)
- Lighthouse PWA score >= 80
```

### `shell-agent` — Phase 1

```
You are building the mobile navigation shell for Falcon Dash (Issue #250, Phase 1).

SCOPE: MobileShell component with bottom tab bar, per-route header, shared mobile components. This replaces the existing dead-code MobileLayout.svelte and MobileAdaptations.svelte.

FILES YOU OWN:
- src/lib/components/MobileShell.svelte (CREATE)
- src/lib/components/BottomTabBar.svelte (CREATE)
- src/lib/components/MobileHeader.svelte (CREATE)
- src/lib/components/BottomSheet.svelte (CREATE)
- src/lib/components/MobileCard.svelte (CREATE)
- src/routes/+layout.svelte (MODIFY — you are the sole editor this phase)
- src/lib/components/AppShell.svelte (MINOR MODIFY)
- src/lib/components/Sidebar.svelte (MINOR MODIFY)
- src/lib/components/MobileLayout.svelte (DELETE)
- src/lib/components/MobileAdaptations.svelte (DELETE)
- src/app.css (MODIFY — add mobile utilities only)

DO NOT TOUCH: Any chat components, store files, PM files, or route page files.

READ FIRST:
- CLAUDE.md (Svelte 5 runes, Tailwind v4, conventions)
- src/routes/+layout.svelte (current auth gating + AppShell render)
- src/lib/components/AppShell.svelte (current desktop shell)
- src/lib/components/MobileLayout.svelte (existing dead code — reference for tab structure)
- src/lib/components/MobileAdaptations.svelte (existing dead code — reference)
- mockups/chat-home.png (note: hamburger top-left, agent name center, settings top-right)
- mockups/settings-top.png (note: back arrow top-left, "Settings" center)
- mockups/cron-jobs-list.png (note: back arrow top-left, "Cron Jobs" center, + top-right)

DESIGN SPEC:
- Layout detection: use `window.matchMedia('(max-width: 767px)')` with $effect for reactivity. Store in a shared reactive variable.
- In +layout.svelte: `{#if isMobile} <MobileShell> {:else} <AppShell>` wrapping {@render children()}
- MobileShell structure:
  - MobileHeader at top (back button | page title | action button) — props: title, showBack, actionIcon, onAction
  - Content area (flex-1, overflow-y-auto, pb-safe for bottom bar)
  - BottomTabBar fixed at bottom
- BottomTabBar tabs: Chat (/), Jobs (/jobs), Settings (/settings), More (overlay)
  - Use SVG icons (not emoji). Match the existing Sidebar icon style.
  - Active tab: blue-400. Inactive: gray-400.
  - 44px minimum touch targets.
  - "More" opens BottomSheet with: Documents, Passwords, Heartbeat, Projects, Skills, Custom Apps
- BottomSheet: slides up from bottom, 90vh max-height, drag-to-dismiss, backdrop overlay
- Use proper SvelteKit `<a href>` navigation, not programmatic goto (enables prefetching)
- All new components use Svelte 5 runes ($state, $derived, $props, $effect)
- Dark theme only (bg-gray-950, text-white, border-gray-800) — match existing palette

ACCEPTANCE CRITERIA:
- Mobile (< 768px): bottom tab bar, no sidebar, per-route header
- Desktop (>= 768px): existing AppShell + Sidebar, no bottom bar, no mobile header
- Tab navigation uses SvelteKit routing (URL changes, back button works)
- "More" bottom sheet lists secondary pages
- `npm run check && npm run lint && npm run format:check` all pass
- No visual regression on desktop
```

### `chat-agent` — Phase 1

```
You are redesigning the chat experience for mobile (Issue #250, Phase 1).

SCOPE: ChatView, MessageComposer, ChatHeader, TokenEntry, markdown lazy-loading.

FILES YOU OWN:
- src/lib/components/ChatView.svelte
- src/lib/components/MessageComposer.svelte
- src/lib/components/ChatHeader.svelte
- src/lib/components/MarkdownRenderer.svelte
- src/lib/chat/markdown.ts
- src/lib/components/ThinkingBlock.svelte
- src/lib/components/ToolCallCard.svelte
- src/lib/components/ReplyPreview.svelte
- src/lib/components/SlashCommandMenu.svelte
- src/routes/+page.svelte
- src/lib/components/TokenEntry.svelte

DO NOT TOUCH: MobileShell, layout, sidebar, app.css, store files, PM files, settings, jobs.

READ FIRST:
- CLAUDE.md
- mockups/chat-home.png (THE target for empty state)
- mockups/connection-setup.png (THE target for TokenEntry)
- src/lib/components/ChatView.svelte (current implementation)
- src/lib/components/MessageComposer.svelte
- src/lib/components/ChatHeader.svelte
- src/lib/chat/markdown.ts (unified pipeline)
- src/lib/components/MarkdownRenderer.svelte (has KaTeX CDN link)
- src/routes/+page.svelte (current welcome/chat switch)

DESIGN SPEC (from mockups):
- Chat home empty state: centered agent avatar, "How can I help you today?", "Connected to [agent name]" subtitle, 4 quick-action chip buttons in 2x2 grid, message composer pinned to bottom
- Chat header: hamburger menu left (for MobileShell), agent name + avatar center, settings gear right
- IMPORTANT: On mobile, the MobileShell provides the header. ChatHeader should adapt: on mobile, it can be a thin bar with just the agent name, or hidden entirely if MobileHeader handles it. Accept an `isMobile` prop.
- Message composer: sticky to bottom, expands with content, safe-area-inset-bottom padding, use visualViewport API to handle mobile keyboard push
- Messages: full-width bubbles on mobile, max-width on desktop

KaTeX LAZY-LOADING:
- In markdown.ts: the unified pipeline currently always imports rehype-katex. Change to: build pipeline WITHOUT katex by default. Export a separate function that detects math in content and only then dynamically imports rehype-katex and rebuilds the pipeline.
- In MarkdownRenderer.svelte: remove the CDN <link> tag. Instead, when a message with math is detected, dynamically inject the CSS via a <svelte:head> block or inline import.

ACCEPTANCE CRITERIA:
- Empty chat state matches chat-home.png mockup
- Connection setup matches connection-setup.png mockup
- Messages scroll properly, composer stays pinned above keyboard on mobile
- KaTeX CSS is NOT loaded until a message with math notation appears
- Quick-action chips send their text as a chat message when tapped
- ThinkingBlock is collapsible with tap, ToolCallCard is compact card
- `npm run check && npm run lint && npm run format:check` pass
- No desktop regression
```

### `pm-server-agent` — Phase 1-2

```
You are extracting the PM module from the gateway plugin into Falcon Dash's server layer (Issue #250, Phase 1-2).

SCOPE: Server-side PM code extraction, REST API endpoints, context file generation.

FILES YOU OWN:
- src/lib/server/pm/ (CREATE entire directory)
- src/routes/api/pm/ (CREATE entire directory tree)

DO NOT TOUCH: Any frontend components, stores, app.css, layout files, or the openclaw-pm/ directory (keep it intact for now).

READ FIRST:
- CLAUDE.md
- builddocs/projects-module-redesign.md (FULL SPEC — follow this closely)
- openclaw-pm/src/database.ts (schema, types, DB singleton)
- openclaw-pm/src/crud.ts (all CRUD operations)
- openclaw-pm/src/search.ts (FTS5)
- openclaw-pm/src/stats.ts (dashboard stats)
- openclaw-pm/src/context.ts (context generation)
- openclaw-pm/src/validation.ts (input validation)
- openclaw-pm/src/bulk.ts (bulk operations)
- openclaw-pm/src/methods.ts (DO NOT COPY — gateway-specific)
- openclaw-pm/src/events.ts (DO NOT COPY — gateway-specific)
- src/routes/api/files/[...path]/+server.ts (PATTERN TO FOLLOW for API routes)
- src/lib/server/files-config.ts (PATTERN for server config)

TASKS:
1. Create src/lib/server/pm/ by copying database, crud, search, stats, context, validation, bulk from openclaw-pm/src/
2. Modify database.ts: DB path from env var PM_DB_PATH or default ~/.openclaw/data/pm.db. Remove any gateway imports.
3. Create src/lib/server/pm/index.ts re-exporting all modules
4. Create REST API routes following the table in builddocs/projects-module-redesign.md Phase 1b
5. Every route: standard error format { error: string, code: string }, proper HTTP status codes
6. Add pagination: ?page=1&limit=20&sort=createdAt&order=desc on list endpoints
7. Context generation: POST /api/pm/context/generate triggers PROJECTS.md + Projects/*.md write to ~/.openclaw/workspace/

API PATTERN (follow for all routes):
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listProjects, createProject } from '$lib/server/pm';

export const GET: RequestHandler = async ({ url }) => {
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');
    const result = listProjects({ page, limit });
    return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json();
    const project = createProject(body);
    return json(project, { status: 201 });
};

ACCEPTANCE CRITERIA:
- All endpoints respond correctly (test with curl)
- Pagination works on all list endpoints
- Validation errors return 400 with { error, code }
- Not-found returns 404 with { error, code }
- Context files generate at ~/.openclaw/workspace/
- `npm run check && npm run build` succeed
- Existing gateway-based PM frontend still works (nothing removed)
```

### `pages-agent` — Phase 2

```
You are redesigning the Jobs and Settings pages for mobile (Issue #250, Phase 2).

SCOPE: Cron jobs (list, form, history) and Settings page — all matching mockups.

FILES YOU OWN:
- src/lib/components/CronJobList.svelte
- src/lib/components/CronJobForm.svelte
- src/lib/components/CronRunHistory.svelte
- src/routes/jobs/+page.svelte
- src/lib/components/settings/SettingsPage.svelte
- src/lib/components/settings/PreferencesTab.svelte (and all other settings/*.svelte)
- src/routes/settings/+page.svelte
- src/lib/components/ConnectionErrorBanner.svelte

DO NOT TOUCH: Chat components, MobileShell, layout, stores, PM files.

READ FIRST:
- CLAUDE.md
- mockups/cron-jobs-list.png (card layout with toggles)
- mockups/cron-jobs-edit-top.png, cron-jobs-edit-bottom.png (full-screen form)
- mockups/settings-top.png, settings-bottom.png (grouped navigation)
- mockups/settings-channels.png, settings-agents.png, settings-skills-installed.png, etc.
- src/lib/components/CronJobList.svelte (current)
- src/lib/components/settings/SettingsPage.svelte (current 11-tab horizontal layout)

CRON JOBS DESIGN (from mockups):
- List: cards with job name bold, description truncated, schedule in small text, toggle switch right-aligned, "Last: Xm ago -> Next: in Ym" line, "Run Now" and "Delete" action buttons
- Header: back arrow, "Cron Jobs" title, "+" create button
- Edit form: full-screen, scrollable sections

SETTINGS DESIGN (from mockups):
- Top level: grouped list navigation, NOT tabs
  - CONFIGURE section: Channels, Agents, Skills, Tools, Hooks, Cron Jobs — each with icon, title, subtitle, chevron
  - MONITOR section: Analytics, Subscription, Logs
  - ADVANCED section: per settings-bottom.png
- Each item navigates to a detail page (drill-down)
- On mobile: full-screen detail pages with MobileHeader (back button + section title)
- On desktop: keep existing tab layout (responsive fork in SettingsPage.svelte)

ACCEPTANCE CRITERIA:
- Cron jobs list matches mockup on mobile
- Settings is grouped navigation on mobile, tabbed on desktop
- All drill-down pages have proper back navigation
- `npm run check && npm run lint && npm run format:check` pass
```

### `pm-cli-agent` — Phase 2

```
You are building the `ocpm` CLI tool for agent-driven project management (Issue #250, Phase 2).

SCOPE: Standalone CLI that talks to Falcon Dash's REST API for PM operations.

FILES YOU OWN:
- cli/ (CREATE entire directory)

DO NOT TOUCH: Any src/ files.

READ FIRST:
- CLAUDE.md
- builddocs/projects-module-redesign.md (Phase 2 section on CLI)
- src/routes/api/pm/ (the API you're calling — read route files to understand endpoints)

DESIGN:
- Node.js CLI using commander.js or yargs
- Base URL configurable: --url flag or OCPM_URL env var (default http://localhost:5173/api/pm)
- Output formats: human-readable table (default) or --format json
- Commands mirror the REST API:
  - ocpm domain list|create|update|delete
  - ocpm focus list|create|update|delete
  - ocpm project list|create|update|delete
  - ocpm task list|create|update|delete|move
  - ocpm comment add|list
  - ocpm block add|remove
  - ocpm search <query>
  - ocpm stats
  - ocpm context generate
- Exit codes: 0 success, 1 error
- Errors: print to stderr, include HTTP status if API error

ACCEPTANCE CRITERIA:
- `npx ocpm project list` returns project table
- `npx ocpm project create --domain default --title "Test"` creates project
- `npx ocpm task create --project 1 --title "Do thing" --priority high` creates task
- `npx ocpm context generate` triggers context file regeneration
- `--format json` outputs parseable JSON on all commands
- `npm run build` in cli/ succeeds
- README.md in cli/ documents all commands
```

### `cleanup-agent` — Phase 3

```
You are simplifying the PM frontend and doing final mobile polish (Issue #250, Phase 3).

SCOPE: Rewrite PM stores from gateway RPC to HTTP, delete complex PM components, touch target audit.

FILES YOU OWN:
- src/lib/stores/pm-store.ts
- src/lib/stores/pm-domains.ts
- src/lib/stores/pm-operations.ts
- src/lib/stores/pm-projects.ts
- src/lib/stores/pm-events.ts
- src/lib/components/pm/ (all files)
- src/routes/projects/+page.svelte
- src/app.css (final typography pass)

DO NOT TOUCH: Chat, MobileShell, settings, jobs, layout, server PM files, API routes.

READ FIRST:
- CLAUDE.md
- builddocs/projects-module-redesign.md
- src/lib/stores/pm-store.ts (current — uses gateway call())
- src/lib/stores/pm-domains.ts, pm-operations.ts, pm-projects.ts, pm-events.ts
- src/lib/components/pm/ (several to delete)
- src/routes/api/pm/ (the REST API to call instead)

TASKS:
1. Rewrite pm-store.ts: replace all `call('pm.*')` with `fetch('/api/pm/...')`. Keep same store interface so components don't break.
2. Rewrite pm-domains.ts, pm-operations.ts, pm-projects.ts similarly.
3. Remove pm-events.ts (gateway event subscriptions no longer needed — use HTTP polling or invalidation).
4. DELETE these PM components: KanbanBoard.svelte, DependencyGraph.svelte, BulkActions.svelte, PMSearch.svelte, AIContextPanel.svelte
5. Simplify remaining: PMDashboard (read-only summary cards), ProjectList (simple card list), ProjectDetail (read-only detail), TaskDetailPanel (read-only, mobile-width)
6. Rewrite projects/+page.svelte: simple card grid of projects with status badges
7. Touch target audit: grep all components for py-1, py-1.5, px-2, px-3 on buttons/links. Ensure min-h-[44px] min-w-[44px] on all interactive elements.
8. Final responsive typography in app.css.

ACCEPTANCE CRITERIA:
- Zero references to gateway `call('pm.*')` in any store or component
- Projects page shows read-only project cards
- KanbanBoard, DependencyGraph, BulkActions, PMSearch, AIContextPanel are deleted
- All buttons/links have >= 44px touch targets
- `npm run check && npm run lint && npm run format:check` pass
- `npm run build` succeeds
```

---

## 5. Coordination Model

### Communication

- **Task list** is the primary coordination mechanism. Each phase has tasks created upfront. Agents check TaskList for available work.
- **Messages** for cross-agent questions (e.g., `chat-agent` asks `shell-agent` about MobileHeader API).
- **Fred reviews** at each quality gate before the next phase starts.

### Fred's Decision Points

Fred MUST make decisions at these points:

| Decision | When Needed | Impact |
|---|---|---|
| **Approve Phase 0 completion** | After infra-agent finishes | Gates all subsequent phases |
| **Approve Phase 1 completion** | After shell/chat/pm-server agents finish | Gates Phase 2 |
| **Design direction for Documents mobile** | Before Phase 4 | Generic list+viewer? Read-only? What actions? |
| **Design direction for Passwords mobile** | Before Phase 4 | List layout? How to handle vault unlock on mobile? |
| **Design direction for Heartbeat mobile** | Before Phase 4 | Dashboard cards? What metrics to show? |
| **Design direction for Projects mobile** | Already decided: read-only cards | Confirmed in interview answers |
| **Canvas mobile strategy** | Before Phase 5+ | Desktop-only gate for MVP? Or attempt A2UI? |
| **Push notification priority** | Before Phase 5+ | Requires gateway protocol work — is this MVP? |
| **Remove openclaw-pm/ plugin?** | After Phase 3 | Safe to delete after stores migrated to HTTP |

### Design Gap Resolution Strategy

For the 6 pages without mockups, Fred has two options:

**Option A (recommended): Describe in words.** For each page, Fred writes 3-5 sentences describing what the mobile view should look like. Agents implement from description. Fast, good enough for v1.

**Option B: Create mockups.** Use the same tool/process that created the existing mockups. More precise but slower.

Suggested descriptions Fred could provide:

- **Documents:** "File list like iOS Files app. Tap file to open full-screen viewer. Breadcrumb path at top. No editing on mobile — read-only viewer with syntax highlighting for code, rendered markdown for .md files."
- **Passwords:** "List of password entries grouped by folder. Tap to reveal details. Vault unlock is full-screen PIN/password entry. Copy username/password buttons with toast confirmation."
- **Heartbeat:** "Stack of status cards: each heartbeat target shows name, status (green/red dot), last check time, response time. Tap card to expand history chart."

### Handling Shared-File Conflicts

If an agent discovers it needs to edit a file owned by another agent:

1. Create a task describing the needed change
2. Assign it to the owning agent
3. Do NOT edit the file yourself

Example: if `chat-agent` needs a CSS class in `app.css` (owned by `shell-agent` in Phase 1), chat-agent creates a task for shell-agent to add it.

---

## 6. Risk Mitigation

### Risk 1: Design Gaps Block Phase 4

**Mitigation:** Phase 4 is intentionally sequenced last. Phases 0-3 deliver a complete mobile experience for Chat, Jobs, Settings, and Projects without any design gaps. Fred has weeks to provide design direction for Documents, Passwords, and Heartbeat while Phases 1-3 execute.

**Fallback:** If Fred provides no direction, use the "generic mobile patterns" described by the architecture reviewer: simple list + detail view for all three pages. This is good enough for v1.

### Risk 2: KaTeX/Mermaid Bundle Bloat on Mobile

**Mitigation:** `chat-agent` implements lazy-loading for KaTeX in Phase 1. Mermaid is already lazy-loaded (dynamic import in MarkdownRenderer). The key fix is removing the KaTeX CDN stylesheet from the `<svelte:head>` that loads on every page.

**Monitoring:** After Phase 1, measure bundle size with `npm run build` output. If total JS > 500KB gzipped, create a follow-up task for bundle splitting.

### Risk 3: GenUI/Canvas Research is Negative

**Mitigation:** Canvas is feature-gated to desktop-only in MVP. On mobile, show a card: "This content is best viewed on desktop. [Open on Desktop]" with a link. This is zero risk and zero effort.

**Phase 5+:** If A2UI works on mobile viewports (test in Phase 5), enable it. If not, the desktop-only gate stays permanently. GenUI (Flutter) is out of scope for MVP.

### Risk 4: iOS WebSocket Background Termination

**Mitigation:** The existing `Reconnector` class already handles reconnection with exponential backoff. On iOS, when the app returns from background, the WebSocket will be dead. The reconnector will automatically reconnect. The UX improvement (brief spinner per Fred's interview answer) is handled by `ConnectionErrorBanner` redesign in Phase 2.

**No new code needed** — the reconnector is already well-implemented.

### Risk 5: Mobile Shell vs AppShell File Contention

**Mitigation:** Strict single-writer rule. `+layout.svelte` is edited ONLY by `shell-agent` in Phase 1. Once the `isMobile` branch is in place, other agents work inside their own components which render within either shell.

### Risk 6: PM Store Migration Breaks Frontend

**Mitigation:** Phase 3 (`cleanup-agent`) maintains the same store interface. Components call the same store functions — only the implementation changes from `call('pm.method')` to `fetch('/api/pm/...')`. This is a transparent backend swap.

**Safety net:** The gateway PM plugin remains installed until Phase 3 is fully verified. Only then does Fred remove `openclaw-pm/`.

---

## 7. Timeline Summary

| Phase | Duration | Agents | Deliverables |
|---|---|---|---|
| **Phase 0** | 1 day | 1 (`infra-agent`) | CSP fix, PWA foundation, service worker |
| **Phase 1** | 5-7 days | 3 parallel (`shell`, `chat`, `pm-server`) | Mobile shell, chat redesign, PM REST API |
| **Phase 2** | 5-7 days | 3 parallel (`pages`, `pm-cli`, `pm-server` continuing) | Jobs + Settings mobile, CLI tool, context gen |
| **Phase 3** | 4-5 days | 1-2 (`cleanup`) | PM frontend migration, touch audit, polish |
| **Phase 4** | 8-10 days | 1-2 (`generic-pages`) | Documents, Passwords, Heartbeat mobile |
| **Phase 5** | 5-7 days | future | Push notifications, Canvas mobile research |

**Total for MVP (Phases 0-3): 15-20 days of wall-clock time** with parallel execution.
**Total for full mobile coverage (Phases 0-4): 23-30 days.**

---

## 8. Definition of Done (Full Issue #250)

- [x] PWA installable on iOS and Android with proper icons and splash *(Phase 0)*
- [x] Service worker caches app shell for instant load *(Phase 0)*
- [x] Mobile shell with bottom tab navigation on viewports < 768px *(Phase 1)*
- [x] Desktop shell unchanged on viewports >= 768px *(Phase 1)*
- [x] Chat view matches chat-home.png mockup *(Phase 1)*
- [x] Connection setup matches connection-setup.png mockup *(Phase 1)*
- [x] Cron jobs mobile card layout with toggles, search, actions *(Phase 2)*
- [x] Settings is grouped navigation on mobile with drill-down to 11 sub-pages *(Phase 2)*
- [x] PM REST API fully functional *(Phase 1)*
- [x] `ocpm` CLI can manage all PM entities (9 command groups, 3 output formats) *(Phase 2)*
- [x] PM frontend is read-only, uses HTTP (not gateway RPC) *(Phase 3)*
- [x] Context files auto-generated on PM mutations (dirty flag + 5s debounce) *(Phase 2)*
- [x] KaTeX loaded lazily (not on every page) *(Phase 1)*
- [x] All touch targets >= 44px in PM components *(Phase 3)*
- [x] Body text >= 16px on mobile in PM components *(Phase 3)*
- [ ] Documents, Passwords, Heartbeat have mobile layouts
- [ ] Canvas feature-gated to desktop
- [x] Dead code deleted: MobileLayout, MobileAdaptations, TouchGestures *(Phase 1)*; KanbanBoard, DependencyGraph, BulkActions, PMSearch, AIContextPanel, CreateEntityDialog, PMNavTree, pm-events.ts *(Phase 3)*
- [x] `npm run build` succeeds *(Phase 3)*
- [x] `npm run check` passes — 0 errors, 71 warnings *(Phase 3)*
- [x] `npm run lint` passes *(Phase 3)*
- [x] `npm run format:check` passes *(Phase 3)*
- [x] No visual regression on desktop *(Phase 3)*
