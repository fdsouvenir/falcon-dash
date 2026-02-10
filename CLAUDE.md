# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Falcon Dash — web dashboard for the OpenClaw AI platform. Connects to the OpenClaw Gateway via WebSocket for real-time chat, project management, file browsing, password vault, cron jobs, and heartbeat monitoring.

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

## Tech Stack

- **Framework:** SvelteKit with Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin, imported as `@import 'tailwindcss'` in `app.css`)
- **Language:** TypeScript (strict mode, bundler moduleResolution)
- **Server DB:** better-sqlite3 (WAL mode) at `~/.openclaw/data/pm.db`
- **Markdown:** unified pipeline (remark-parse → remark-gfm → remark-math → rehype → rehype-katex → rehype-sanitize → rehype-stringify) with Shiki syntax highlighting and Mermaid diagrams

## Code Conventions

- **Prettier:** tabs, single quotes, no trailing commas, 100 char print width
- **Svelte 5 syntax:** use `onevent` handlers (NOT Svelte 4 `on:event`). Use `$props()`, `$state()`, `$derived()`, `$effect()`.
- **Event handlers:** use wrapper functions instead of `as EventListener` casts (triggers ESLint no-undef)
- **Gateway values:** never hardcode — read from hello-ok payload and config. Tick interval comes from `policy.tickIntervalMs`.
- Always run `npm run format` after writing code

## Architecture

### Gateway Layer (`src/lib/gateway/`)

WebSocket client for the OpenClaw Gateway protocol v3. Five classes, wired together as singletons in `src/lib/stores/gateway.ts`:

- **`GatewayConnection`** — WebSocket lifecycle, frame send/receive, challenge→connect→hello-ok handshake
- **`RequestCorrelator`** — maps request IDs to Promises for req/res correlation
- **`EventBus`** — pub/sub for gateway event frames (e.g. `chat.message`, `presence.update`)
- **`SnapshotStore`** — hydrates from hello-ok snapshot (presence, health, session defaults), subscribes to EventBus for incremental updates
- **`Reconnector`** — exponential backoff (800ms base, 1.7x multiplier, 15s cap), tick-based health monitoring (2x tick = timeout)
- **`AgentStreamManager`** (`stream.ts`) — reassembles streaming agent responses (delta, toolCall, toolResult, messageEnd events)

The `call<T>(method, params)` function in `stores/gateway.ts` is the primary way to make gateway RPC calls from anywhere in the app.

### Store Layer (`src/lib/stores/`)

Svelte writable/readable stores that provide reactive state to components. Key stores:

- `gateway.ts` — singleton gateway instances + `connectToGateway()`, `call()`
- `chat.ts` — `createChatSession(sessionKey)` factory returning a session store with send/abort/reconcile/streaming
- `threads.ts`, `bookmarks.ts`, `chat-search.ts`, `chat-resilience.ts` — chat feature stores
- `sessions.ts` — session lifecycle (general session, event subscriptions)
- `files.ts`, `editor.ts` — document browser state
- `passwords.ts` — password vault state
- `pm-store.ts`, `pm-domains.ts`, `pm-projects.ts`, `pm-operations.ts`, `pm-events.ts` — project management stores
- `heartbeat.ts`, `cron.ts`, `toast.ts`, `notifications.ts`, `discord.ts` — utility stores
- `token.ts` — gateway token + URL persistence

### Server-Side (`src/lib/server/`)

SvelteKit server code using better-sqlite3:

- **`pm/`** — Project management CRUD, search, validation, events, stats, bulk operations, context. Schema: domains → focuses → projects → tasks (with subtasks), plus milestones, comments, blocks, activities, attachments, sync_mappings.
- **`files-config.ts`** — File system configuration for document browsing
- **`keepassxc.ts`**, **`password-security.ts`**, **`passwords-config.ts`** — KeePassXC vault integration

### API Routes (`src/routes/api/`)

- `files/[...path]` — file CRUD operations
- `files-bulk` — bulk file operations
- `passwords/` — vault management
- `passwords/[...path]` — individual password operations
- `passwords/import-secrets` — secret migration

### Pages (`src/routes/`)

Root layout (`+layout.svelte`) handles auth gating: shows `TokenEntry` if no token, otherwise `AppShell` with sidebar navigation. Pages:

- `/` — welcome + presence list
- `/documents` — file browser + editor
- `/jobs` — cron job management
- `/heartbeat` — system health monitoring
- `/passwords` — password vault (KeePassXC)
- `/projects` — project management (kanban, nav tree, detail panels)

### Specialized Modules

- **`src/lib/chat/`** — markdown rendering pipeline, syntax highlighting (Shiki), slash commands, clipboard, reply utils, time formatting
- **`src/lib/canvas/`** — A2UI bridge, HTML canvas frame, custom app panels, delivery system
- **`src/lib/pwa/`** — service worker registration
- **`src/lib/theme/`** — theme manager
- **`src/lib/performance/`** — virtual scroll implementation

## Gateway Protocol Quick Reference

- **URL:** `ws://127.0.0.1:18789` (proxied via Vite `/ws` in dev)
- **client.id:** `"openclaw-control-ui"` (gateway validates this exact string)
- **client.mode:** `"webchat"`
- **Protocol version:** 3
- **Frame types:** `req` (request), `res` (response), `event`
- **Auth flow:** gateway sends `connect.challenge` event → client replies with `connect` request → gateway responds with `hello-ok`
- **Thinking levels:** off/minimal/low/medium/high/xhigh (NOT off/on/stream)
- **Dev auth:** set `gateway.controlUi.allowInsecureAuth: true` for token-only

## Reference Docs

Architecture specs and prior research in `builddocs/`:
- `falcon-dash-architecture-v02.md` — full architecture spec
- `ws-protocol.md` — WebSocket protocol reference
- `pm-spec.md` — PM specification
- `research/` — canvas, control-ui features, file ops, PM API, webchat client, ws-protocol test

Consult these before making architectural decisions.
