# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Falcon Dash is a web dashboard for the OpenClaw AI Agent platform. Falcon Dash is a product that makes it easy for users of OpenClaw to manage and interact with their agent(s). Falcon Dash is being purpose built by Frederic Souvenir for his business deploying and maintaining AI Agents for customers. The deployment infrastructure repo fredbot-hosting/fredbot-back is availble locally at ~/repos/fredbot-backend/ and via gh.

OpenClaw is a new and rapidly evolving project. Rely on documentation from docs.openclaw.ai/llms.txt and the public repo at github.com/openclaw/openclaw for up to date information.

## Commands

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run check        # TypeScript checking (svelte-kit sync + svelte-check)
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
```

No test runner is configured. No single-test command exists.

## Development Environment

The dev server connects to the OpenClaw Gateway for live testing. Configuration:

- **`.env` file** — set these to connect to a gateway:
  - `GATEWAY_URL=ws://<host>:18789` — WebSocket URL of the gateway (default: `ws://127.0.0.1:18789`)
  - `GATEWAY_TOKEN=<token>` — gateway auth token (auto-read from `~/.openclaw/openclaw.json` if not set)
- **Gateway config fallback** — if env vars are not set, `/api/gateway-config` reads from `~/.openclaw/openclaw.json` (`gateway.auth.token`, `gateway.port`, `gateway.bind`)
- **Dev auth** — set `gateway.controlUi.allowInsecureAuth: true` in the gateway's `openclaw.json` for token-only auth (no device pairing)
- **Vite proxy** — dev server proxies `/ws` to `GATEWAY_URL` for WebSocket connections
- **Production** — set `ORIGIN=https://your-domain.com` to derive `wss://` URLs for reverse proxy

## Tech Stack

- **Framework:** SvelteKit with Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin, imported as `@import 'tailwindcss'` in `app.css`)
- **Language:** TypeScript (strict mode, bundler moduleResolution)
- **Server DB:** better-sqlite3 (WAL mode) at `~/.openclaw/data/pm.db` (persists via Docker volume mount at `~/.openclaw`)
- **Markdown:** unified pipeline (remark-parse → remark-gfm → remark-math → rehype → rehype-katex → rehype-sanitize → rehype-stringify) with Shiki syntax highlighting and Mermaid diagrams

## Code Conventions

- **Prettier:** tabs, single quotes, no trailing commas, 100 char print width
- **Svelte 5 syntax:** use `onevent` handlers (NOT Svelte 4 `on:event`). Use `$props()`, `$state()`, `$derived()`, `$effect()`.
- **Event handlers:** use wrapper functions instead of `as EventListener` casts (triggers ESLint no-undef)
- **Gateway values:** never hardcode — read from hello-ok payload and config. Tick interval comes from `policy.tickIntervalMs`.
- Always run `npm run format` after writing code

## Architecture

### Gateway Layer (`src/lib/gateway/`)

WebSocket client for the OpenClaw Gateway protocol v3. Six classes, wired together as singletons in `src/lib/stores/gateway.ts`:

- **`GatewayConnection`** — WebSocket lifecycle, frame send/receive, challenge→connect→hello-ok handshake
- **`RequestCorrelator`** — maps request IDs to Promises for req/res correlation
- **`EventBus`** — pub/sub for gateway event frames (e.g. `chat.message`, `presence.update`)
- **`SnapshotStore`** — hydrates from hello-ok snapshot (presence, health, session defaults), subscribes to EventBus for incremental updates
- **`Reconnector`** — exponential backoff (800ms base, 1.7x multiplier, 15s cap), tick-based health monitoring (2x tick = timeout)
- **`AgentStreamManager`** (`stream.ts`) — reassembles streaming agent responses (delta, toolCall, toolResult, messageEnd events)
- **`DiagnosticLog`** (`diagnostic-log.ts`) — ring-buffer logger for connection events, used by DiagnosticPanel
- **`DeviceIdentity`** (`device-identity.ts`) — Ed25519 keypair generation and challenge signing via WebCrypto
- **`CanvasStore`** (`stores/canvas.ts`) — manages canvas surface state, subscribes to EventBus for `node.invoke.request`, `canvas.deliver`, and `canvas.message` events; handles canvas commands (present, hide, navigate, pushJSONL, reset) and responds to invoke requests

The `call<T>(method, params)` function in `stores/gateway.ts` is the primary way to make gateway RPC calls from anywhere in the app.

### Store Layer (`src/lib/stores/`)

Svelte writable/readable stores that provide reactive state to components. Key stores:

- `gateway.ts` — singleton gateway instances + `connectToGateway()`, `call()`, `canvasStore`
- `chat.ts` — `createChatSession(sessionKey)` factory returning a session store with send/abort/reconcile/streaming
- `threads.ts`, `bookmarks.ts`, `chat-search.ts`, `chat-resilience.ts` — chat feature stores
- `sessions.ts` — session lifecycle (create, rename, delete, reorder, event subscriptions)
- `files.ts`, `editor.ts` — document browser state
- `passwords.ts` — password vault state
- `pm-store.ts`, `pm-domains.ts`, `pm-projects.ts`, `pm-operations.ts` — project management stores
- `heartbeat.ts`, `cron.ts`, `toast.ts`, `notifications.ts`, `discord.ts` — utility stores
- `diagnostics.ts` — connection health metrics (tick health tracking)
- `token.ts` — gateway token + URL persistence

### Server-Side (`src/lib/server/`)

SvelteKit server code using better-sqlite3:

- **`pm/`** — Project management CRUD, search, validation, events, stats, context. Schema: domains → focuses → projects (with markdown `body`), plus activities. Projects are markdown documents — agents write rich-formatted content to the `body` field via PATCH.
  - **`context-generator.ts`** — writes `PROJECTS.md`, per-project files, and `PM-API.md` to shared dir (`~/.openclaw/data/pm-context/`), then symlinks into all agent workspaces
  - **`context-scheduler.ts`** — debounced (5s) regeneration via PM events + 60s max staleness interval; `triggerContextGeneration()` for synchronous regen on individual mutations
  - **`workspace-discovery.ts`** — reads `~/.openclaw/openclaw.json` → `agents.list[]` to discover agent workspace paths for symlink targets
- **`agents/`** — Agent CRUD against `~/.openclaw/openclaw.json` → `agents.list[]`. `createAgent()` auto-generates `agent-NNN` IDs (zero-padded, auto-increment) when no ID is provided; identity (name/emoji/theme) is optional. `createWorkspace()` creates an empty workspace dir — agents self-onboard via AGENTS.md on first conversation. Config writes use optimistic concurrency (hash check). `triggerSyncPeers()` runs `~/.openclaw/sync-peers.sh` after mutations.
- **`files-config.ts`** — File system configuration for document browsing
- **`keepassxc.ts`**, **`password-security.ts`**, **`passwords-config.ts`** — KeePassXC vault integration

### API Routes (`src/routes/api/`)

- `agents/` — agent CRUD. GET lists agents + config hash. POST creates agent (only `hash` required; `id` and `identity` optional — server auto-generates `agent-NNN` ID). `agents/[id]` supports PATCH (update identity) and DELETE.
- `pm/**` — PM REST API (domains, focuses, projects, activities, search, stats, context). Mutations call `triggerContextGeneration()` synchronously. Auto-generated API reference at `~/.openclaw/data/pm-context/PM-API.md`.
- `files/[...path]` — file CRUD operations
- `files-bulk` — bulk file operations
- `gateway-config` — gateway configuration proxy
- `passwords/` — vault management
- `passwords/[...path]` — individual password operations
- `passwords/import-secrets` — secret migration

### Pages (`src/routes/`)

Root layout (`+layout.svelte`) handles auth gating: shows `TokenEntry` if no token, otherwise `AppShell` with sidebar navigation. Pages:

- `/` — chat view (when session active) or welcome + presence list
- `/documents` — file browser + editor
- `/jobs` — cron job management
- `/heartbeat` — system health monitoring
- `/passwords` — password vault (KeePassXC)
- `/projects` — project management dashboard (stat cards, category/sub-category grouped list, project detail modal). Uses `history.pushState` for browser back navigation between views.
- `/settings` — settings page (agents, config editor, devices, Discord, exec approvals, live logs, models, skills, workspace files)

### Agent UI (`src/lib/components/`)

- **`AgentRail.svelte`** — left sidebar agent switcher. Shows agent icons sourced from config API, overlays session counts from gateway. '+' button spawns a new agent with one-click confirm (auto-generated ID, no form). Tracks `configHash` for optimistic concurrency.
- **`settings/AgentsTab.svelte`** — agent management in settings. Lists agents as cards with edit/delete actions. "Spawn Agent" button for one-click creation. Edit modal allows setting name/emoji/theme after creation. Delete modal with confirmation (primary agent protected).

### Specialized Modules

- **`src/lib/chat/`** — markdown rendering pipeline, syntax highlighting (Shiki), slash commands, clipboard, reply utils, time formatting
- **`src/lib/canvas/`** — A2UI bridge (dynamic bundle loading from canvas host with placeholder fallback), HTML canvas frame, custom app panels, delivery system, canvas action bridge
- **`src/lib/passwords/`** — password utility helpers
- **`src/lib/pwa/`** — service worker registration
- **`src/lib/theme/`** — theme manager
- **`src/lib/performance/`** — virtual scroll implementation

### PM UI Components (`src/lib/components/pm/`)

- **`pm-utils.ts`** — shared formatting utilities: `STATUS_BORDER`/`STATUS_DOT`/`STATUS_BADGE` maps, `getPriorityIndicator()` (dot indicators), `getPriorityBadge()` (labeled badges), `formatRelativeTime()` (wraps chat time-utils for unix seconds), `formatStatusLabel()`
- **`ProjectList.svelte`** — dashboard view with stat cards (Total/Active/Due Soon/Overdue from `getPMStats`/`getDashboardContext`), filter pills (Active/All/Done/Archived), projects grouped by Category → Sub-Category with collapsible headers. Orphan projects (no known domain) render in a flat "Other" section.
- **`ProjectDetail.svelte`** — modal overlay for project detail. Compact single-row toolbar header (back arrow + breadcrumb + title + status/priority). Two tabs: Status (renders project `body` markdown via `MarkdownRenderer` with full Shiki/KaTeX/mermaid pipeline) and Activity (project feed).

**Navigation flow:** `+page.svelte` manages `selectedProjectId` state with `history.pushState`/`popstate` integration. Browser back navigates: project → list → exit.

### PM Context Pipeline

Auto-generated markdown files that give agents read access to PM data:

- **Shared dir:** `~/.openclaw/data/pm-context/` (override via `PM_CONTEXT_DIR` env var)
- **Files generated:** `PROJECTS.md` (active project summary table + dashboard), `Projects/{id}.md` (per-project detail), `PM-API.md` (REST API reference)
- **Symlinks:** created in each agent workspace discovered from `~/.openclaw/openclaw.json` → `agents.list[].workspace`
- **Regen triggers:** synchronous after individual mutations (via `triggerContextGeneration()`), debounced (5s) for PM events, 60s max staleness interval
- **Agent writes:** agents `curl` the REST API at `localhost:3000/api/pm/*` directly — documented in `PM-API.md`

### Gateway Plugin (`falcon-dash-plugin/`)

OpenClaw gateway plugin (ID: `falcon-dash`) with two registrations:

1. **Channel** (`channel.ts`) — registers `falcon-dash` channel so sessions use `falcon-dash:dm:` keys instead of generic `webchat` keys. Capabilities: direct chat + threads, gateway delivery mode.
2. **Canvas bridge** (`canvas-bridge.ts`) — bridges operators into the canvas pipeline. Registers operators as virtual canvas nodes so the agent's `node.list`/`node.invoke` flow can route canvas commands to the dashboard.
   - **`canvas.bridge.register`** — registers calling operator as virtual canvas node via `nodeRegistry.register()` with synthetic `role: "node"` client
   - **`canvas.bridge.invokeResult`** — proxies invoke results to `nodeRegistry.handleInvokeResult()`, bypassing `NODE_ROLE_METHODS` authorization
   - **`canvas.bridge.unregister`** — explicit cleanup via `nodeRegistry.unregister()`

Build: `cd falcon-dash-plugin && npm install && npm run build`
Install: `openclaw plugins install ./falcon-dash-plugin` (then restart gateway)

## Gateway Protocol Quick Reference

- **URL:** `ws://127.0.0.1:18789` (proxied via Vite `/ws` in dev)
- **client.id:** `"openclaw-control-ui"` (validated against hardcoded enum in gateway — custom IDs not supported)
- **client.mode:** `"ui"` (valid modes: webchat, cli, ui, backend, node, probe, test)
- **Protocol version:** 3
- **Frame types:** `req` (request), `res` (response), `event`
- **Auth flow:** gateway sends `connect.challenge` event → client replies with `connect` request (id `__connect`) → gateway responds with `hello-ok`
- **Connect frame ID:** uses `'__connect'` (non-numeric) to avoid collision with `RequestCorrelator`'s monotonic counter — do NOT change to a numeric ID
- **Capabilities:** connect frame declares `caps: ['canvas', 'canvas.a2ui', 'tool-events']` — `tool-events` required to receive tool stream events from gateway
- **Canvas commands:** `commands: ['canvas.present', 'canvas.hide', 'canvas.navigate', 'canvas.a2ui.pushJSONL', 'canvas.a2ui.reset']`
- **Canvas host:** A2UI bundle served at `http://<host>:<gatewayPort>/__openclaw__/a2ui/a2ui.bundle.js` (default port 18789)
- **Scopes:** `operator.read`, `operator.write`, `operator.admin`, `operator.approvals`, `operator.pairing`
- **Thinking levels:** off/minimal/low/medium/high/xhigh (NOT off/on/stream)
- **`sessions.patch` params:** `key` (required, NOT `sessionKey`), `label` (optional, NOT `displayName`)
- **`sessions.delete` params:** `key` (required, NOT `sessionKey`), `deleteTranscript` (optional boolean)
- **Dev auth:** set `gateway.controlUi.allowInsecureAuth: true` for token-only

## Reference Docs

Architecture specs and prior research in `builddocs/`:

- `falcon-dash-architecture-v02.md` — full architecture spec
- `ws-protocol.md` — WebSocket protocol reference
- `pm-spec.md` — PM specification
- `track-a-gateway-canvas-plan.md` — gateway plugin plan for canvas routing to operators
- `research/` — canvas, control-ui features, file ops, PM API, webchat client, ws-protocol test

Consult these before making architectural decisions.
