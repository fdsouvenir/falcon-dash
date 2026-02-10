# falcon-dash — Consolidated Architecture

**Version:** 0.2  
**Date:** 2026-02-07  
**Status:** All critical gaps resolved. Ready for WS client design + implementation.

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      falcon-dash (SvelteKit)                  │
│                                                              │
│  Gateway-backed modules:          Server Route modules:      │
│  ┌──────┐ ┌────┐ ┌─────────┐ ┌────────┐  ┌─────┐ ┌───────┐ │
│  │ Chat │ │ PM │ │Agent Jobs│ │Settings│  │Docs │ │Passwords │
│  └──┬───┘ └─┬──┘ └────┬────┘ └───┬────┘  └──┬──┘ └───┬────┘ │
│     └───────┴────┬────┴──────────┘           └───┬────┘      │
│                  │                               │           │
│  ┌───────────────▼────────────────────┐  ┌───────▼────────┐  │
│  │        WS Client Layer             │  │  Server Routes  │  │
│  │  (connect, auth, events,           │  │  (documents FS, │  │
│  │   req/res correlation)             │  │   password vault │  │
│  └───────────────┬────────────────────┘  │   via keepassxc) │  │
│                  │                       └────────────────┘  │
│                  │                                           │
│  ┌───────────────────────────────────────────────────────┐   │
│  │          Svelte Stores  (reactive state)               │   │
│  │    Cross-cutting — all modules publish/subscribe       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────┐  ┌─────────────┐                       │
│  │ A2UI Component   │  │ Canvas      │                       │
│  │ (Lit, inline)    │  │ Iframe      │                       │
│  └──────────────────┘  └─────────────┘                       │
└───────────────────┬──────────────────────────────────────────┘
                    │ WebSocket (port 18789, default)
                    │
┌───────────────────▼──────────────────────────────────────────┐
│                OpenClaw Gateway                               │
│                                                              │
│  Core Methods: chat.*, sessions.*, channels.*, health,       │
│  status, config.*, skills.*, cron.*, node.*, models.*,       │
│  exec.approvals.*, logs.tail, agents.list                    │
│                                                              │
│  PM Skill (registered): pm.*                                 │
│                                                              │
│  Events: agent, chat, presence, tick, shutdown,              │
│  exec.approval.requested, pm                                 │
└───────────────────┬──────────────────────────────────────────┘
                    │
          ┌─────────┴──────────┐
          │                    │
     ┌────▼─────┐    ┌────────▼────────┐
     │ SQLite   │    │ Canvas Host     │
     │ PM DB    │    │ (port 18793)    │
     └──────────┘    └─────────────────┘
                     ┌─────────────────┐
                     │ Discord         │
                     │ (user's bot     │
                     │  token)         │
                     └─────────────────┘
```

> **Note:** The canvas host port (18793 per Mac docs, vs `canvas.port: 3000` per gateway config)
> needs verification. The dashboard should derive the canvas URL from config rather than hardcoding.

---

## 2. Resolved Decisions

### 2.1 Tech Stack
- **SvelteKit** + **Tailwind** + **TypeScript**
- **State:** Svelte writable stores + custom WS event store
- **Markdown:** unified/remark/rehype pipeline (KaTeX, Mermaid, Shiki)
- **PWA:** vite-plugin-pwa

### 2.2 PM API (from pm-api-design.md)
**Decision: Skill with WS method registration**

The PM system is an OpenClaw skill (pm-skill) that:
- Owns the SQLite database (default `~/.openclaw/data/pm.db`, configurable via `pm.database.path`) via better-sqlite3
- Registers `pm.*` WS methods that the Gateway routes through
- Shares the same data layer with the CLI (agent uses `pm` CLI tool)
- Broadcasts `pm` events on mutations for real-time UI updates
- Provides `pm.context.*` methods for AI-optimized summaries

**Method surface:** ~45 methods across 13 method groups:
- `pm.domain.*` (list, get, create, update, delete, reorder)
- `pm.focus.*` (list, get, create, update, move, delete, reorder)
- `pm.milestone.*` (list, get, create, update, delete)
- `pm.project.*` (list, get, create, update, delete)
- `pm.task.*` (list, get, create, update, move, reorder, delete)
- `pm.comment.*` (list, create, update, delete)
- `pm.block.*` (list, create, delete)
- `pm.attachment.*` (list, create, delete)
- `pm.activity.*` (list)
- `pm.context.*` (dashboard, domain, project)
- `pm.search` (FTS5 full-text search)
- `pm.bulk.*` (update, move)
- `pm.stats` (dashboard aggregates)

**Schema additions needed:** `sort_order` columns on domains/focuses/tasks + FTS5 virtual table.

### 2.3 File Operations (from file-operations.md)
**Decision: Direct filesystem access via SvelteKit server routes**

The Gateway has **no file read/write RPC methods**. The agent has full filesystem access and doesn't need API routes. But the dashboard is a browser app — browsers can't access the local filesystem directly. SvelteKit server routes run server-side (Node.js) and use `fs` to read/write files on behalf of the browser UI.

falcon-dash uses a **single generic file API** with a `root` parameter that serves both the Documents app and Settings > Workspace:

```
GET  /api/files?root=documents              → { files: [{name, type, size, mtime}] }
GET  /api/files/*path?root=documents        → { content, hash, mtime } (file) or { files: [...] } (dir)
PUT  /api/files/*path?root=documents        → { content, baseHash } → { hash, ok }
POST /api/files/*path?root=documents        → create new file or folder
DELETE /api/files/*path?root=documents       → delete file or folder
```

**Root mappings** (server-side, not exposed to browser):

| Root key | Resolved path | Used by |
|----------|--------------|---------|
| `documents` | `dashboard.documentsPath` (default `~/Documents`) | Documents app |
| `workspace` | `agents.defaults.workspace` (default `~/.openclaw/workspace`) | Settings > Workspace |

- SHA-256 hash-based optimistic concurrency on writes (same pattern as `config.set`)
- `.secrets/` directory never exposed regardless of root

**Known workspace files** (for the `workspace` root only):
- `SOUL.md`, `AGENTS.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`
- `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`
- `memory/` subdirectory (daily memory files)

**Password server routes** (separate from file API):
```
GET  /api/passwords                    → { entries: [{title, username, url, group}] } (no secrets)
POST /api/passwords/unlock             → { masterPassword } → { sessionToken }
GET  /api/passwords/:path              → { ...entry, password } (requires session token)
PUT  /api/passwords/:path              → { title, username, password, url, notes } (requires session token)
DELETE /api/passwords/:path            → (requires session token)
POST /api/passwords/lock               → clear session
POST /api/passwords/init               → { masterPassword } → create new vault (first-run only)
POST /api/passwords/import-secrets     → migrate .secrets/ files into vault (one-time)
```

### 2.4 Canvas / A2UI (from canvas-a2ui.md)
**Decision: Hybrid — A2UI web component inline + iframe for HTML canvas**

Two rendering modes:

**A2UI (declarative, safe):** Import `<openclaw-a2ui-host>` Lit web component directly into falcon-dash. Call `.applyMessages(messages)` to render. Wire action bridge to send user actions back via gateway WS. Render inline in chat messages and in custom app panels.

**HTML Canvas (arbitrary, sandboxed):** Iframe to `http://<host>:18793/__openclaw__/canvas/...` with `sandbox="allow-scripts"` (no `allow-same-origin`). Only used for pinned custom apps, not inline in chat.

**Open delivery question:** A2UI payloads currently flow through `node.invoke` to native nodes. falcon-dash isn't a node. Options being considered:
1. Dashboard registers as a virtual node with canvas capability
2. New WS event type for dashboard-targeted canvas updates  
3. Agent's canvas tool gains `target: "web"` parameter

This is a Phase 5 concern — not blocking anything in Phases 1-4.

---

## 3. Data Flow Patterns

### 3.1 Chat (real-time streaming)

```
User types → chat.send → ack {runId, "started"}
                        → event:agent (thinking) ×N
                        → event:agent (tool_start)
                        → event:agent (tool_result)
                        → event:agent (text_delta) ×N
                        → event:agent (text_end)
                        → res {runId, "ok", summary}
```

**Store model:** Per-session writable store. Messages accumulate. Active run tracked by `runId`. Streaming deltas append to current message buffer. Final response commits message.

### 3.2 PM (CRUD + real-time events)

```
User action → pm.task.update → res {updatedTask}
                              → event:pm {action:"updated", entityType:"task", ...}
```

**Store model:** Cached entity stores (projects, tasks, etc.) hydrated on module mount. Mutations applied optimistically. `pm` events update cache from server (stateVersion gap → refetch). Kanban/list/tree views are derived stores.

### 3.3 Documents (server-side filesystem)

```
Dashboard load → GET /api/files?root=documents → root listing
Folder click   → GET /api/files/subfolder?root=documents → folder listing
File click     → GET /api/files/subfolder/file.md?root=documents → content + hash
User edits     → PUT /api/files/subfolder/file.md?root=documents + baseHash → ok + new hash
```

**Store model:** Documents folder listing store + active file content store. Hash tracked for concurrency. Supports nested directory navigation. CodeMirror or similar editor for markdown files.

### 3.4 Agent Jobs (cron + heartbeat)

```
Module mount → cron.list → job listing
             → config.get → heartbeat config
Job actions  → cron.add / cron.edit / cron.run / cron.enable / cron.disable
Config edit  → config.patch (agents.defaults.heartbeat)
Events       → event:cron → job status updates
```

### 3.5 Passwords (KeePassXC vault)

```
Module mount  → GET /api/passwords → list entries (titles + usernames only, no secrets)
Unlock vault  → POST /api/passwords/unlock + master password → session token
View password → GET /api/passwords/:id + session token → decrypted value
Add/Edit      → PUT /api/passwords/:id + session token + entry data → ok
Delete        → DELETE /api/passwords/:id + session token → ok
Lock vault    → POST /api/passwords/lock → clear session
```

**Backend: KeePassXC**
- **Storage:** `~/.openclaw/passwords.kdbx` (KDBX4 format, AES-256 + Argon2)
- **Server routes** shell out to `keepassxc-cli` for all operations
- **Agent access:** `keepassxc-cli show ~/.openclaw/passwords.kdbx /secret-name`
- **Free and open source** (GPLv2+), no cost, no cloud dependency
- Users can also open the same vault file in the KeePassXC desktop app or browser extension

**Security model:**
- Master password required to unlock vault — server caches unlock session in memory
- Session auto-locks after configurable idle timeout
- Browser receives masked values by default; explicit reveal requires active session
- All encryption/decryption happens server-side via `keepassxc-cli`
- `.kdbx` file is encrypted at rest — no plaintext secrets on disk

**Migration:** Existing `.secrets/` files can be imported into the vault on first setup

### 3.6 Workspace Files (Settings > Workspace)

```
Tab mount  → GET /api/files?root=workspace → file listing (discover all files)
File click → GET /api/files/SOUL.md?root=workspace → content + hash
User edits → PUT /api/files/SOUL.md?root=workspace + baseHash → ok + new hash
```

Store model: Workspace file listing store with known-file annotations.
Files that exist on disk are loaded; known files that don't exist yet show
a "create" affordance. Hash tracked for concurrency.

---

## 4. WS Client Layer Design

The WS client is the foundation. Every module uses it.

### 4.1 Public API (TypeScript)

> **Dynamic values:** The dashboard must not hardcode gateway defaults.
> Port, tick interval, session defaults, model, thinking level, and feature
> availability all come from `hello-ok` or `config.get` at runtime.

```typescript
interface GatewayClient {
  // Lifecycle
  connect(config: ConnectionConfig): Promise<HelloOk>;
  disconnect(): void;
  readonly state: Readable<ConnectionState>;  // Svelte store
  
  // Request/Response
  call<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  
  // Events
  on(event: string, handler: (payload: unknown) => void): Unsubscribe;
  once(event: string): Promise<unknown>;
  
  // Convenience (typed wrappers around call)
  // ChatSendParams: { session, content, ..., replyToMessageId?: string }
  // When replyToMessageId is set, the message is an inline reply.
  // Syncs as Discord message_reference.
  chat: {
    send(params: ChatSendParams): Promise<ChatSendAck>;
    history(params: ChatHistoryParams): Promise<ChatHistory>;
    abort(params: ChatAbortParams): Promise<void>;
    inject(params: ChatInjectParams): Promise<void>;
  };
  // ThreadCreateParams: { parentSessionId, originMessageId, name }
  // Creates a thread sub-session anchored to a specific message.
  // Syncs as a new Discord thread started from that message.
  sessions: {
    // IMPORTANT: Chat sidebar must always call list() with a `kinds` filter
    // to exclude internal sessions (cron, webhook, node, sub-agent).
    // See §11.3 for visibility rules.
    list(params?: SessionListParams): Promise<SessionList>;
    patch(params: SessionPatchParams): Promise<void>;
    threads: {
      list(params: ThreadListParams): Promise<ThreadList>;       // list threads for a session
      create(params: ThreadCreateParams): Promise<ThreadSession>; // start thread from message
      archive(params: ThreadArchiveParams): Promise<void>;
      unarchive(params: ThreadUnarchiveParams): Promise<void>;
    };
  };
  health(): Promise<HealthSnapshot>;
  status(): Promise<StatusSummary>;
  presence(): Promise<PresenceList>;
  config: {
    get(): Promise<ConfigSnapshot>;
    patch(params: ConfigPatchParams): Promise<void>;
    apply(params: ConfigApplyParams): Promise<void>;
    schema(): Promise<ConfigSchema>;
  };
  pm: {
    // All pm.* methods — typed wrappers
    stats(): Promise<PmStats>;
    search(params: PmSearchParams): Promise<PmSearchResult>;
    domain: { list, get, create, update, delete, reorder };
    focus:  { list, get, create, update, move, delete, reorder };
    milestone: { list, get, create, update, delete };
    project: { list, get, create, update, delete };
    task: { list, get, create, update, move, reorder, delete };
    comment: { list, create, update, delete };
    block: { list, create, delete };
    attachment: { list, create, delete };
    activity: { list };
    context: { dashboard, domain, project };
    bulk: { update, move };
  };
  cron: {
    list, add, edit, rm, enable, disable, run, runs
  };
  channels: {
    // Discord integration status — used by Settings > Integrations.
    status(): Promise<ChannelsStatus>;
    logout(params: ChannelsLogoutParams): Promise<void>;
  };
  skills: { status, install, update };
  models: { list };
  nodes: { list, describe, invoke };
  logs: { tail };
}
```

### 4.2 Connection State Machine

```
                    ┌──────────────┐
                    │  DISCONNECTED │◄───── initial / after close
                    └──────┬───────┘
                           │ connect()
                    ┌──────▼───────┐
                    │  CONNECTING   │──── WS opening
                    └──────┬───────┘
                           │ challenge received
                    ┌──────▼───────┐
                    │ AUTHENTICATING│──── sending connect frame
                    └──────┬───────┘
                           │
                 ┌─────────┼──────────┐
                 │         │          │
          ┌──────▼───┐ ┌───▼────┐ ┌──▼──────────┐
          │ CONNECTED│ │PAIRING │ │AUTH_FAILED   │
          │          │ │REQUIRED│ │              │
          └──────┬───┘ └───┬────┘ └──────────────┘
                 │         │
                 │         │ user approves device
                 │         │ (external: CLI)
                 │         │
                 │    ┌────▼─────┐
                 │    │RECONNECT │──── auto-retry
                 │    └──────────┘
                 │
          ┌──────▼──────┐
          │   READY      │──── hello-ok received, snapshot hydrated
          └──────┬───────┘
                 │
          ┌──────▼──────┐
          │ RECONNECTING │──── connection lost, backoff retry
          └─────────────┘
```

### 4.3 Internal Architecture

```typescript
// Core pieces:
class GatewayConnection {
  // Low-level WS management, frame send/receive
  // client.id = "openclaw-control-ui", client.mode = "webchat" (required by gateway)
  // Reconnection with exponential backoff (800ms base, 1.7× multiplier, 15s cap)
  // These are dashboard-chosen parameters, not gateway protocol requirements
  // Keepalive monitoring: timeout = 2 × policy.tickIntervalMs from hello-ok
  // (default ~30s, but read dynamically — do not hardcode)
  // Parse features.methods from hello-ok for runtime feature detection
  // Dashboard must check this list before enabling UI for optional methods
  // (e.g., pm.* methods only available when pm-skill is installed)
}

class RequestCorrelator {
  // Maps req.id → pending Promise
  // Timeout handling per request
  // Idempotency key generation for mutations
}

class EventBus {
  // Event name → handler set
  // Wildcard support (e.g., "pm.*")
  // Auto-cleanup on disconnect
}

class SnapshotStore {
  // Hydrated from hello-ok snapshot
  // Updated incrementally from events
  // Svelte-compatible: exports readable stores
  // presence, health, stateVersion
  // sessionDefaults from hello-ok: default model, contextTokens, thinking level
  // Chat settings panel should display these as the baseline defaults
}

class AgentStreamManager {
  // Tracks active agent runs by runId
  // Delta events contain FULL accumulated text (not incremental diffs)
  // Handles two-stage response pattern (ack → stream → final)
  // Emits higher-level events: messageStart, delta, toolCall, toolResult, messageEnd
}
```

**Reactive state constraint:** Gateway state flows one direction — gateway → stores → UI.
Svelte `$effect` blocks must never write back to the same state they read. Connection
and snapshot stores export `Readable` stores; only the gateway internals may write to them.
Components derive display state with `$derived`, never with read-write `$effect` loops.

### 4.4 Reconnection Protocol

> **Note:** These are dashboard-chosen parameters, not gateway protocol requirements.

```
1. Connection drops (WS close or tick timeout)
2. State → RECONNECTING
3. Exponential backoff: wait(min(800 * 1.7^attempt, 15000))
4. Open new WS → send connect frame (with persisted device token)
5. Receive hello-ok → hydrate snapshot
6. State → READY
7. For each active module:
   - Chat: call chat.history to fill message gaps
   - PM: check stateVersion, refetch if gap
   - Other: refresh as needed
8. If shutdown event received: use restartExpectedMs as initial delay
```

### 4.5 Device Identity & Auth

```
First run:
1. Generate Ed25519 keypair in browser (WebCrypto)
2. Derive device.id from public key fingerprint
3. Store keypair + device ID in IndexedDB (persistent)
4. Connect → sign challenge nonce with private key
5. Gateway rejects: "pairing required"
6. Show onboarding UI: "Approve this device on your server"
7. User runs: openclaw devices approve <requestId>
8. Reconnect → hello-ok includes deviceToken
9. Persist deviceToken in IndexedDB

Subsequent runs:
1. Load keypair + deviceToken from IndexedDB
2. Connect with device identity + token
3. Sign challenge nonce
4. hello-ok → ready

Development mode:
- Set `gateway.controlUi.allowInsecureAuth: true` to skip device identity
- Token-only auth works with this flag
- 127.0.0.1 connections are auto-approved for pairing

Production:
- Implement full Ed25519 device identity via WebCrypto
- Requires HTTPS (secure context) for WebCrypto API
- WebCrypto available on localhost (secure context)
```

---

## 5. Module Dependency Map

```
                        WS Client Layer
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         ┌────▼────┐    ┌────▼────┐    ┌─────▼─────┐
         │  Chat   │    │Settings │    │  Layout   │
         │         │    │         │    │ (shell,   │
         │ Phase 2 │    │ Phase 5 │    │  nav)     │
         └────┬────┘    └────┬────┘    │ Phase 1   │
              │              │         └───────────┘
              │              │
         ┌────▼────┐    ┌────▼────┐
         │  Docs   │    │  Cron/  │
         │         │    │Heartbeat│
         │ Phase 3 │    │ Phase 3 │
         └─────────┘    └─────────┘

         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │   PM    │    │Passwords│    │ Canvas/ │
         │         │    │         │    │ A2UI    │
         │ Phase 4 │    │ Phase 3 │    │ Phase 5 │
         └─────────┘    └─────────┘    └─────────┘
```

**Dependency chain:**
1. WS Client Layer → blocks everything
2. Chat Module → validates streaming, reconnection, rich rendering
3. Files + Agent Jobs + Passwords → simpler CRUD, proves the stack
4. PM Module → blocked on pm-skill backend
5. Settings + Canvas → polish phase

---

## 6. Updated Build Plan

### Phase 0: Foundation (current — almost done)
- [x] V1 spec written
- [x] Tech stack decided
- [x] Gateway WS protocol mapped
- [x] PM API designed
- [x] File operations researched
- [x] Canvas/A2UI researched
- [ ] WS client layer typed interface (this document, §4)
- [ ] Rough wireframes for chat module

### Phase 1: Core Infrastructure
**Goal:** SvelteKit app shell + WS client + connection working

1. **SvelteKit scaffold** — project init, Tailwind, TypeScript, folder structure
2. **WS client library** — GatewayConnection, RequestCorrelator, EventBus, SnapshotStore
3. **Connection lifecycle** — connect, auth, pairing flow, reconnection
4. **App shell** — sidebar nav, connection status indicator, module router
5. **PWA manifest** — basic installability

**Deliverable:** App connects to gateway, shows connection status, presence list renders from snapshot.

### Phase 2: Chat Module
**Goal:** Full chat experience — the hardest module, validates everything

1. **AgentStreamManager** — two-stage response handling, delta accumulation
2. **Chat store** — per-session message list, active run tracking, optimistic sends
3. **Message renderer** — Markdown pipeline (remark/rehype + KaTeX + Mermaid + Shiki)
4. **Thinking blocks** — collapsible, streaming, elapsed timer
5. **Tool call cards** — name, args, result, expandable
6. **Message composer** — SHIFT+ENTER, paste images, file upload stub, slash commands
7. **Chat list** — filtered session list (§11.3), General persistence, create/rename/delete, Discord sync
8. **Connection resilience** — reconnect gap fill (chat.history diff), streaming recovery
9. **Message replies** — replyToMessageId in chat.send, compact reply preview in renderer
10. **Thread panel** — Discord-style side panel, thread sub-sessions, thread lifecycle (active/archived/locked)
11. **Thread sync** — bidirectional Discord thread ↔ thread sub-session sync

**Deliverable:** Can chat with agent, see streaming responses with thinking + tool calls, switch between chats, reply to messages, open threaded conversations in side panel, survive reconnections, Discord channel + thread sync.

### Phase 3: Documents + Agent Jobs + Passwords
**Goal:** Three simpler modules that prove server routes, cron CRUD, and encrypted storage

**Documents:**
1. **Server routes** — `/api/files` read/write with hash concurrency, nested directory support
2. **Document browser** — list and navigate user's documents folder (default ~/Documents)
3. **Document editor** — CodeMirror for markdown/text, hash-based save
4. **Create/upload** — create new files/folders, drag-and-drop upload

**Agent Jobs:**
1. **Cron panel** — list, create, edit, delete, enable/disable, run now
2. **Run history** — `cron.runs` with status + output
3. **Heartbeat config** — read/edit heartbeat settings + HEARTBEAT.md
4. **Event integration** — `event:cron` for live status updates

**Passwords:**
1. **Server routes** — `/api/passwords` wrapping `keepassxc-cli` against `~/.openclaw/passwords.kdbx`
2. **First-run** — vault creation (`keepassxc-cli db-create`) + optional `.secrets/` migration
3. **Vault UI** — list entries (title, username, URL visible; password masked)
4. **CRUD** — add, edit, delete entries; copy-to-clipboard with auto-clear
5. **Unlock flow** — master password → server-side session → auto-lock on idle timeout

**Deliverable:** Can browse/edit documents, manage cron jobs, configure heartbeat, manage encrypted credentials.

### Phase 4: PM Module (blocked on pm-skill)
**Goal:** Full project management UI

**Prerequisite:** pm-skill backend (Phases 1-3 of PM implementation plan) must be done.

1. **PM store layer** — entity caches, optimistic updates, stateVersion tracking
2. **Dashboard view** — `pm.stats` header, recent activity feed
3. **Domain/Focus sidebar** — tree navigation
4. **Project list** — filterable, sortable, paginated
5. **Kanban board** — drag-and-drop status columns, `pm.task.reorder`
6. **Project detail** — task tree, comments, attachments, activity, blocks
7. **Task detail** — edit panel, subtask management, dependency graph
8. **AI Context panel** — `pm.context.*` rendered markdown (see what the agent sees)
9. **Bulk operations** — multi-select + status change
10. **Search** — `pm.search` with result navigation

**Deliverable:** Full PM experience — browse, create, edit, drag, search across all PM entities.

### Phase 5: Settings + Canvas
**Goal:** Complete the feature set

**Settings:**
1. **Config editor** — form-based (from `config.schema`) + raw JSON
2. **Skills panel** — status, enable/disable, API key management
3. **Integrations** — Discord setup (client_id + bot_token entry), OAuth "Add to Server" flow, connection health
4. **Node list** — paired nodes, capabilities
5. **Exec approvals** — allowlist editor
6. **Logs viewer** — `logs.tail` with filtering
7. **Model list** — available models + failover config
8. **Device management** — paired devices, token rotation

**Canvas / A2UI:**
1. **A2UI web component** — import bundle, wire action bridge
2. **Inline A2UI in chat** — render A2UI payloads from agent event stream
3. **Custom app panel** — pinned canvases in sidebar
4. **HTML canvas iframe** — sandboxed iframe for arbitrary HTML
5. **Canvas delivery pipeline** — solve the node.invoke delivery question

### Phase 6: Mobile & Polish
**Goal:** Dedicated mobile pass + overall polish

**Design approach note:** The spec states "mobile-first." The honest build order is **responsive-first, desktop-primary** — all layouts use Tailwind responsive breakpoints and flex/grid from day one so nothing is structurally broken on mobile, but the primary development and testing target through Phases 1-5 is desktop. Phase 6 is the dedicated mobile pass where we refine the experience for small screens. This is different from "bolt mobile on later" — it's acknowledging that the desktop views carry more complexity (sidebar + main + detail panels, drag-and-drop kanban, multi-pane file editor) and validating those first is the faster path to a working product.

1. **Mobile layout** — bottom tab bar, single-pane navigation, touch-optimized tap targets
2. **Touch gestures** — swipe to navigate, pull-to-refresh, long-press context menus
3. **PWA** — service worker, offline read-only mode, push notifications, install prompts
4. **Accessibility** — keyboard navigation, screen reader support, ARIA labels, focus management
5. **Performance** — virtual scrolling for long chat/task lists, lazy module loading, image optimization
6. **Themes** — dark/light mode toggle, accent color customization
7. **Onboarding** — first-run wizard with pairing flow, gateway URL entry, token paste

---

## 7. File Structure (Planned)

```
falcon-dash/
├── src/
│   ├── lib/
│   │   ├── gateway/              # WS client layer
│   │   │   ├── client.ts         # GatewayClient (public API)
│   │   │   ├── connection.ts     # GatewayConnection (WS lifecycle)
│   │   │   ├── correlator.ts     # RequestCorrelator
│   │   │   ├── events.ts         # EventBus
│   │   │   ├── snapshot.ts       # SnapshotStore
│   │   │   ├── stream.ts         # AgentStreamManager
│   │   │   ├── auth.ts           # Device identity + token management
│   │   │   └── types.ts          # All protocol types
│   │   │
│   │   ├── stores/               # Svelte stores
│   │   │   ├── connection.ts     # Connection state store
│   │   │   ├── chat.ts           # Chat/session stores
│   │   │   ├── pm.ts             # PM entity caches
│   │   │   ├── files.ts          # Documents folder stores
│   │   │   ├── passwords.ts      # Credential vault store
│   │   │   ├── cron.ts           # Cron job stores
│   │   │   └── settings.ts       # Config/health/presence stores
│   │   │
│   │   ├── components/           # Shared UI components
│   │   │   ├── chat/             # Message renderer, composer, thinking blocks
│   │   │   ├── pm/               # Task card, kanban column, project detail
│   │   │   ├── files/            # Document browser, editor
│   │   │   ├── passwords/        # Vault list, credential form, master password
│   │   │   ├── canvas/           # A2UI host, iframe wrapper
│   │   │   └── ui/               # Design system (buttons, inputs, badges, etc.)
│   │   │
│   │   └── utils/                # Markdown pipeline, date formatting, etc.
│   │
│   ├── routes/
│   │   ├── +layout.svelte        # App shell (sidebar + main)
│   │   ├── +page.svelte          # Dashboard / default view
│   │   ├── chat/                 # Chat module routes
│   │   ├── projects/             # PM module routes
│   │   ├── files/                # Documents module routes
│   │   ├── passwords/            # Credential vault routes
│   │   ├── jobs/                 # Agent jobs routes
│   │   ├── settings/             # Settings routes
│   │   ├── apps/                 # Canvas/custom apps routes
│   │   └── api/
│   │       ├── files/            # Unified file API (Documents app + Settings > Workspace)
│   │       │   ├── +server.ts            # Root listing
│   │       │   └── [...path]/+server.ts  # Nested path operations
│   │       └── passwords/        # Server-side credential API
│   │           └── +server.ts    # Encrypted vault operations
│   │
│   └── app.html
│
├── static/
│   ├── a2ui.bundle.js            # A2UI web component (copied from OpenClaw)
│   └── manifest.json             # PWA manifest
│
├── svelte.config.js
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 8. Installation & Agent Awareness

When falcon-dash is installed, the following workspace files must be updated so the agent knows the dashboard and its associated tools exist.

### TOOLS.md Additions

```markdown
## Project Management (PM)

Local SQLite-backed project management. The `pm` CLI is the primary interface.

### Quick Reference
\`\`\`bash
pm domain list                    # List all domains
pm focus list --domain=personal   # List focuses in a domain
pm project list                   # List all projects
pm project create --focus=personal:finance --title="Tax Filing"
pm task list --project=P-3        # List tasks in a project
pm task create --project=P-3 --title="Gather documents"
pm task update T-42 --status=done
pm comment add T-42 "Completed the review"
pm search "deployment"            # Full-text search
pm context dashboard              # AI-optimized summary (all work)
pm context project P-3            # AI-optimized summary (single project)
\`\`\`

### ID Format
- Domains/Focuses: slugs (e.g., `personal`, `personal:finance`)
- Projects: `P-<number>` (e.g., `P-3`)
- Tasks: `T-<number>` (e.g., `T-42`)
- Milestones: `M-<number>` (e.g., `M-1`)

### Status Values
todo, in_progress, review, done, cancelled, archived

### Priority Values
low, normal, high, urgent

## Passwords (KeePassXC)

Secrets are stored in an encrypted KeePassXC vault.

\`\`\`bash
keepassxc-cli show ~/.openclaw/passwords.kdbx /secret-name
keepassxc-cli ls ~/.openclaw/passwords.kdbx
keepassxc-cli add ~/.openclaw/passwords.kdbx /new-secret
\`\`\`

## Documents

The user's documents folder is accessible to both you and the human.

- **Path:** ~/Documents (configurable via `dashboard.documentsPath`)
- **Dashboard:** The Documents app in falcon-dash provides a visual browser
- You can read/write files directly via the filesystem
- Use this folder for reports, notes, exports, and any files the human should see
- Do NOT store secrets or credentials here — use the password vault instead

## falcon-dash (Dashboard)

Web dashboard for managing chat, projects, documents, agent jobs, and passwords.

- **URL:** http://localhost:5173 (dev) / configured production URL
- **Connects via:** OpenClaw Gateway WebSocket (port 18789, default)
- The dashboard is the human's primary interface for oversight
- All PM mutations you make via CLI are reflected in the dashboard in real-time
```

### AGENTS.md Additions

```markdown
## Project Management

All work is tracked in the local PM system (SQLite). Use the `pm` CLI for all task operations.

- Create issues for new work, assign Domain and Focus
- Break down complex projects into tasks (sub-issues)
- Set blocking relationships when tasks have dependencies
- Update status as work progresses
- Use comments for updates — preserves audit trail
- Run `pm context dashboard` to see the full picture

The human views and manages projects through the falcon-dash web dashboard.
Do not use GitHub Issues for task tracking — the local PM system is the source of truth.

## Documents

The user's documents folder at ~/Documents is shared between you and the human.

- Save reports, summaries, and exports here so the human can find them
- The human browses this folder through the falcon-dash Documents app
- Check `dashboard.documentsPath` in config if the path has been customized

## Passwords

Secrets are stored in a KeePassXC vault at `~/.openclaw/passwords.kdbx`.
Use `keepassxc-cli show` to retrieve secrets. Never store secrets in workspace files.
```

### Installation Script Responsibilities

The falcon-dash installer should:

1. **Check** if `keepassxc-cli` is available, install if missing
2. **Check** if `pm` CLI is available, install if missing
3. **Create** the PM database (`~/.openclaw/data/pm.db`) with schema applied
4. **Create** the KeePassXC vault (`~/.openclaw/passwords.kdbx`) — prompt for master password
5. **Migrate** existing `.secrets/` files into the vault (optional, with confirmation)
6. **Ensure** `dashboard.documentsPath` config key exists (default `~/Documents`)
7. **Create** `~/Documents` directory if it doesn't exist
8. **Append** PM, Documents, and Passwords sections to `TOOLS.md` (if not already present)
9. **Append** PM, Documents, and Passwords sections to `AGENTS.md` (if not already present)
10. **Update** `HEARTBEAT.md` if applicable (e.g., add PM health checks)

These additions are **append-only** — the installer must not overwrite existing workspace file content.

---

## 9. Remaining Open Items

| # | Item | Blocking? | Status |
|---|------|-----------|--------|
| 1 | Wireframes for chat module | Phase 2 | Not started |
| 2 | pm-skill backend implementation | Phase 4 | Not started (all phases unchecked) |
| 3 | A2UI delivery to web dashboard | Phase 5 | Three options identified, not decided |
| 4 | TypeBox schema import feasibility | Nice-to-have | Untested |
| 5 | Visual design system | Phase 2+ | "Linear meets Discord" direction, no specs |
| 6 | Mobile layout | Phase 6 | Responsive-first throughout, dedicated mobile pass in Phase 6 (see §6 Phase 6 note) |
| 7 | ~~Passwords encryption scheme~~ | ~~Phase 3~~ | **Resolved:** KeePassXC (KDBX4, AES-256 + Argon2). Shell out to `keepassxc-cli`. |

None of these block Phase 1 (core infrastructure). Items 1 and 5 should be tackled before Phase 2 coding starts.

---

## 10. Overview & Goals

A unified web dashboard for interacting with an OpenClaw AI agent. The dashboard is the primary interface; Discord integration provides a secondary surface for messaging on the go. Other platform integrations (Slack, WhatsApp, etc.) may be added in the future.

### Goals

- **Dashboard + Discord** — the dashboard is the primary interface; Discord provides a familiar chat surface that stays in sync
- **Discord sync** — create a chat in the dashboard, it appears as a Discord channel and vice versa
- **Rich experience** — the dashboard offers capabilities beyond what Discord supports (canvas, widgets, project management)
- **AI-first** — the agent is the primary operator for many features; the UI is the human's window into the agent's work
- **Mobile-first** — every module, view, and interaction must work on phones and tablets; the Discord mobile app provides a complementary mobile chat surface

---

## 11. Session & Navigation Model

### 11.1 Core Concepts

Three distinct concepts that must not be conflated:

#### Sessions (Gateway-level)

**OpenClaw sessions** are the source of truth for all conversation state, owned by the gateway. Not all sessions are user-facing — the dashboard must filter.

Session kinds are determined by key prefix:

| Kind | Key Pattern | Description |
|------|-------------|-------------|
| **Group** | `agent:<agentId>:<channel>:group:<id>` | User-facing chats |
| **Thread** | `agent:<agentId>:<channel>:group:<parentId>:thread:<threadId>` | Child of a group session (synced from Discord thread) |
| **Main** | `agent:<agentId>:main` | Reserved for future single-threaded integrations (WhatsApp, Telegram, Signal) |
| **Cron** | `cron:<jobId>` | Internal, not user-facing |
| **Webhook** | `hook:<uuid>` | Internal, not user-facing |
| **Node** | `node-<nodeId>` | Internal, not user-facing |
| **Sub-agent** | kind `sub-agent` | Internal, not user-facing |

Reset policies are gateway-configured: `session.reset.mode` (`daily` or `idle`), `session.reset.atHour` (hour 0-23), `session.reset.idleMinutes`. Per-channel overrides via `resetByChannel`. The dashboard does not control reset policy — it observes session state from the gateway. Session origin metadata includes label, provider, routing hints, and accountId.

#### Chats (Dashboard UI concept)

A **filtered subset** of sessions displayed in the sidebar. Group sessions and their thread sub-sessions appear. Thread sessions are not listed in the sidebar — they open in a side panel from the parent chat. Cron, webhook, node, and sub-agent sessions never appear. The main session is reserved for future single-threaded integrations.

- Use `sessions.list` with appropriate `kinds` filter
- Each chat maps 1:1 to a group session; threads map 1:1 to thread sub-sessions
- Bidirectional sync: create a chat in the dashboard → appears as a Discord channel and vice versa

#### Integrations

Discord is the primary platform integration. Connection status queried via `channels.status`.
Managed in Settings > Integrations tab via OAuth connect flow.
Other platforms (Slack, WhatsApp, etc.) may be supported in the future via the same
`channels.status` abstraction.

### 11.2 Chat Model

**The "General" chat:**
- Persistent group session, always present, cannot be deleted
- Default landing chat when the user opens the dashboard
- Dashboard creates it on first connect if no matching group session exists — this is a dashboard UI convention, not a gateway concept
- The gateway just sees a normal group session; "General" semantics are enforced entirely by the dashboard

> **Future:** Single-threaded integration chats (WhatsApp, Telegram, Signal) would use
> the main session (`agent:<agentId>:main`). Not implemented in current Discord-first model.

**Regular chats:**
- Group sessions created by user or synced from Discord
- Can be created, renamed, deleted
- Unread badges, reorderable

**Threads:**
- Thread sub-sessions created by user in dashboard or synced from Discord
- Each thread has a `parentSessionId` and an `originMessageId` (the message the thread was started from)
- Threads have their own message history, independent of the parent session
- Thread lifecycle mirrors Discord: active, archived (read-only), locked (only owner can unarchive)
- Auto-archive after configurable inactivity (default: 24h, matching Discord)

**Message replies:**
- Messages can reference a parent message via `replyToMessageId`
- Replies are inline within the same session — they do NOT create a new session
- The referenced message is displayed as a compact preview above the reply
- Syncs bidirectionally with Discord's `message_reference`

**Platform sync (Discord):**
- Private Discord server with the user and their agent
- Each Discord channel = one group session = one chat in the dashboard
- Creating a chat in the dashboard syncs as a new Discord channel
- Creating a channel in Discord syncs as a new chat in the dashboard
- Other multi-channel platforms (Slack) may use the same model in the future
- Each Discord thread = one thread sub-session = one thread in the dashboard
- Creating a thread in the dashboard syncs as a new Discord thread
- Creating a thread in Discord syncs as a new thread sub-session
- Thread archive/unarchive syncs bidirectionally
- Message replies sync as Discord `message_reference` and vice versa

### 11.3 Session Visibility Rules

| Session Kind | Key Pattern | User-Facing? | Shows in Sidebar |
|---|---|---|---|
| Group | `agent:*:*:group:*` | Yes | Always |
| Thread | `agent:*:*:group:*:thread:*` | Yes | In thread panel (not sidebar) |
| Main (future DM integrations) | `agent:*:main` | Conditional | Reserved for future single-threaded platforms |
| Cron | `cron:*` | No | Never |
| Webhook | `hook:*` | No | Never |
| Node | `node-*` | No | Never |
| Sub-agent | kind `sub-agent` | No | Never (shown in Settings > Information) |

### 11.4 Navigation Model

The sidebar has two sections: **Chats** (filtered sessions) and **Apps** (built-in modules + agent-created custom apps).

```
┌──────────────────┐
│  falcon-dash     │
│                  │
│  Chats           │
│  ───────────     │
│  General         │  ← persistent, can't be deleted
│  #project-x  💬3 │  ← group session, 3 active threads
│  #support        │  ← group session
│  + New Chat      │
│                  │
│  Apps            │
│  ───────────     │
│  Projects        │
│  Documents       │
│  Agent Jobs      │
│  [custom apps]   │
│                  │
│  ──────────────  │
│  Settings        │
│  Passwords       │
└──────────────────┘
```

### Chats

Filtered chat sessions displayed in the sidebar.

| Feature | Description |
|---------|-------------|
| List | All user-facing sessions with unread indicators |
| Create | New chat — syncs as a Discord channel (when connected) |
| Rename | Rename — syncs to Discord |
| Delete | Remove — syncs to Discord (General cannot be deleted) |
| Reorder | Drag & drop, pin favorites to top |
| Unread badges | Per-chat unread count |

### Apps

Built-in modules and agent-created custom apps in a single list. Built-in apps are always present; custom apps can be added/removed.

| Item | Type | Description |
|------|------|-------------|
| **Projects** | Built-in | Task/project management |
| **Documents** | Built-in | User documents folder (~/Documents) |
| **Agent Jobs** | Built-in | Heartbeat config and cron job management |
| *Agent-created* | Custom | Pinned canvas views (trackers, dashboards, etc.) |

Custom apps can be reordered via drag & drop. Built-in apps remain at the top.

Additionally, a **Settings** icon/link is available in the sidebar (bottom or header) — not listed as an app, but always accessible.

Future built-in apps (out of scope):
- Calendar integration
- Email triage
- Analytics / usage

---

## 12. Canvas UX Specification

> _Technical implementation details are in §2.4. This section covers the UX-level behavior._

### Canvas Lifecycle

```
Agent creates canvas     →  Appears inline (in chat, PM, etc.)
        │
User pins as custom app  →  Appears in sidebar as persistent view
        │
Agent can update it      →  Live updates in place
        │
User removes app         →  Removed from sidebar (still in original context)
```

### Canvas Behaviors

| Behavior | Description |
|----------|-------------|
| **Inline rendering** | Canvas renders within any module (chat message, PM view, etc.) |
| **Pin as custom app** | User pins a canvas → becomes a persistent nav item under Custom Apps |
| **Named** | Custom apps have a name (agent-provided or user-editable) |
| **Live updates** | Agent can push updates to any canvas (inline or custom app) |
| **Reorderable** | Custom apps can be reordered via drag & drop |
| **Agent-initiated** | Agent can create canvases and suggest pinning as custom app |
| **Remove** | User removes from sidebar; canvas still exists in original context |

### Canvas in Each Context

| Context | Canvas Use |
|---------|------------|
| **Chat** | Agent responds with interactive UI inline in conversation |
| **Project Management** | Agent generates custom views (Gantt, resource allocation, etc.) |
| **Custom App** | Persistent standalone view, always one click away in sidebar |

---

## 13. Module Functional Specifications: Chat

### Layout

```
┌──────────┬──────────────────────────────────┬──────────────────┐
│          │                              │                  │
│  Chat    │        Message Area          │  Thread Panel    │
│  List    │                              │  (optional)      │
│          │                              │                  │
│ ──────── │                              │  Thread name     │
│ search   │                              │  ────────────    │
│ ──────── │                              │  [messages]      │
│ General  │                              │                  │
│ #project │                              │                  │
│ #support │──────────────────────────────│──────────────────│
│ + New    │     Message Composer          │  Thread Composer │
│          │     [                   📎]   │  [         Send] │
│          │     [         Send ↵    ]    │                  │
└──────────┴──────────────────────────────┴──────────────────┘
```

> Thread panel opens when user clicks a thread indicator on a message or selects a thread from the thread list. Panel can be closed to return to single-pane chat view.

> See §11 for the full session & navigation model. The chat list is a filtered view of gateway sessions — only group sessions appear. The "General" chat is always present.

### Rich Content Rendering

Messages must render the following content types:

| Feature | Description |
|---------|-------------|
| **Markdown** | Full CommonMark + GFM (tables, strikethrough, task lists) |
| **Mermaid.js** | Flowcharts, sequence diagrams, pie charts, Gantt, state diagrams |
| **KaTeX** | Inline math `$...$`, block equations `$$...$$`, matrices |
| **Syntax Highlighting** | Code blocks with language-specific highlighting |
| **Admonitions** | Callout boxes: NOTE, TIP, WARNING, CAUTION, IMPORTANT |
| **Collapsible** | `<details>/<summary>` for nested/long content |
| **Canvas** | Agent-generated interactive UIs (see §12) |
| **Link Previews** | Unfurl URLs inline |

### Chat Header & Settings

Per-chat controls displayed in the message area header bar.

```
┌──────────────────────────────────────────────────────┐
│  General                     🤖 claude-opus-4  ⚙️    │
└──────────────────────────────────────────────────────┘
```

| Control | Description |
|---------|-------------|
| **Model indicator** | Shows current model, click to override for this chat |
| **Settings gear** | Opens chat settings panel |

#### Chat Settings Panel

| Setting | Description |
|---------|-------------|
| **Model override** | Select a different model for this chat |
| **Thinking level** | off / minimal / low / medium / high / xhigh |
| **Verbose mode** | Toggle detailed responses |
| **Reset session** | Start fresh (equivalent to `/new`) |
| **Compact** | Summarize old context to free window space |

### Message Composer

| Feature | Behavior |
|---------|----------|
| SHIFT+ENTER | Insert newline (multi-line input) |
| ENTER | Send message |
| File upload | Button + drag-drop to attach files |
| Paste images | Clipboard paste support for screenshots |
| Slash commands | `/` prefix — opens autocomplete menu |

### Slash Commands

Typing `/` in the composer opens an autocomplete dropdown (Discord-style) showing available commands with descriptions. Fuzzy-filters as the user types.

```
┌──────────────────────────────────────────┐
│  /new          Reset session             │
│  /status       Session status & usage    │
│  /stop         Abort current run         │
│  /compact      Compress context window   │
│  /usage        Token usage details       │
│  /reasoning    Toggle thinking level     │
│  /verbose      Toggle verbose mode       │
│  /context      View system prompt        │
│  /subagents    Manage sub-agent runs     │
│  /send         Toggle send policy        │
└──────────────────────────────────────────┘
```

| Command | Description |
|---------|-------------|
| `/new [model]` | Reset session, optionally set model |
| `/status` | Session status card (tokens, cost, model, thinking) |
| `/stop` | Abort current run and clear queued followups |
| `/compact [instructions]` | Summarize older context to free window space |
| `/usage [off\|tokens\|full\|cost]` | Toggle per-response usage footer |
| `/reasoning [level]` | Set thinking level (off/minimal/low/medium/high/xhigh) |
| `/verbose` | Toggle verbose responses |
| `/context [list\|detail]` | View system prompt and context contents |
| `/subagents [list\|stop\|log\|info]` | Inspect/control sub-agent runs |
| `/send [on\|off\|inherit]` | Toggle send policy for this session |

### Thinking Display

When thinking is enabled (`/reasoning on` or via chat settings), the agent's thinking process streams into a collapsible section above the response.

```
┌──────────────────────────────────────────────────────┐
│  🤖 Agent                                            │
│                                                      │
│  ▶ Thinking...                          (collapsed)  │
│                                                      │
│  The answer to your question is...      (streaming)  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

| Behavior | Description |
|----------|-------------|
| **Default collapsed** | Thinking section is closed by default while streaming |
| **Live streaming** | Thinking text streams in real-time inside the collapsible |
| **Expand to peek** | User can click to expand and watch thinking in progress |
| **Collapse persists** | If user collapses it, stays collapsed |
| **Sequential** | Thinking streams first, then response streams below it |
| **Final state** | After completion, thinking remains as a collapsible — click to review |
| **Label** | Shows "Thinking..." while streaming, "Thought for Xs" when complete |

### Message Actions

| Action | Behavior |
|--------|----------|
| Copy response | One-click copy entire response as raw markdown |
| Reactions | Quick emoji responses |
| Reply | Reply to a specific message — shows compact preview of referenced message above the reply. Syncs as Discord `message_reference`. |
| Start Thread | Start a threaded conversation from this message. Opens thread panel. Syncs as a new Discord thread. |
| Bookmark/Star | Mark important messages for later |

### Real-time Features

| Feature | Description |
|---------|-------------|
| Live message streaming | Messages appear in real-time |
| Typing indicator | Visual feedback when agent is responding |
| Presence / connection status | Online/offline indicator |
| Message status | Sent/delivered/error indicators |

### Connection Resilience

The WebSocket connection must handle all interruption scenarios gracefully — the user should never lose messages or need to manually refresh.

| Scenario | Behavior |
|----------|----------|
| **Browser loses focus** | Connection stays alive; if dropped, auto-reconnects on regain |
| **Tab backgrounded** | Reconnects when tab returns to foreground |
| **Network drops** | Reconnect with exponential backoff (see §4.4 for parameters) |
| **Mid-stream disconnect** | On reconnect, fetches full message history to fill gaps |
| **Phone screen locks** | Reconnects on unlock, loads missed messages |
| **Gateway restarts** | Auto-reconnects, reloads session state |

#### Reconnection Flow

```
Disconnect detected
    │
    ▼
Show "Reconnecting..." indicator
    │
    ▼
Attempt reconnect (exponential backoff)
    │
    ▼
On success:
    ├── Fetch message history since last known message
    ├── Reconcile: insert any missed messages
    ├── Resume streaming if agent is mid-response
    └── Clear "Reconnecting..." indicator
```

#### Key Requirements

| Requirement | Description |
|-------------|-------------|
| **Last message tracking** | Client tracks the ID/timestamp of the last received message |
| **Gap fill on reconnect** | After reconnect, request messages since last known — server returns all missed |
| **Partial response recovery** | If agent was mid-stream, fetch the complete response on reconnect |
| **No duplicate messages** | Dedup by message ID when reconciling |
| **Offline indicator** | Clear visual indicator when connection is lost |
| **Silent reconnect** | If reconnect is fast (<2s), no visible indicator — just seamless |
| **Queue outbound** | Messages typed while disconnected are queued and sent on reconnect |

### Chat List Behavior

The chat list is the left panel showing available chats. It is a filtered view of gateway sessions (see §11.3 for visibility rules).

| Behavior | Description |
|----------|-------------|
| **Load** | On mount, call `sessions.list` with `kinds` filter |
| **General** | Always first in list, cannot be deleted or renamed |
| **DM entry** | **Future:** Will appear when single-threaded integrations are added |
| **Regular chats** | Group sessions — can be created, renamed, deleted, reordered |
| **Create** | "+ New Chat" creates a group session via gateway, syncs as a new Discord channel (when Discord is connected) |
| **Delete** | Remove chat — syncs to Discord. General cannot be deleted. |
| **Live updates** | `sessions.*` events update the list in real-time (new channel from Discord appears automatically) |

### Thread Panel

Discord-style side panel for threaded conversations. Opens to the right of the message area.

| Behavior | Description |
|----------|-------------|
| **Open** | Click thread indicator on a message, or "Start Thread" from message actions |
| **Header** | Thread name (editable), parent chat name, close button |
| **Messages** | Independent message history for the thread sub-session |
| **Composer** | Thread-scoped composer (sends to thread session, not parent) |
| **Close** | Close button returns to single-pane chat view |
| **Indicator** | Messages that have threads show a 💬 indicator with reply count |
| **Thread list** | Button in chat header to see all threads for the current chat |

#### Thread Lifecycle

| State | Description |
|-------|-------------|
| **Active** | Thread is open, messages can be sent |
| **Archived** | Read-only after inactivity timeout. Sending a message auto-unarchives. |
| **Locked** | Only thread creator or admin can unarchive |

#### Thread List Popover

| Column | Description |
|--------|-------------|
| Thread name | Name of the thread |
| Last activity | When the last message was sent |
| Message count | Number of messages |
| State | Active / Archived |

### Message Replies

Inline reply-to-message within the same chat or thread. Not a new session — just a reference.

| Behavior | Description |
|----------|-------------|
| **Start reply** | Click "Reply" on a message action menu |
| **Composer indicator** | Shows compact preview of referenced message above the composer input |
| **Cancel** | Click X on the reply preview to cancel |
| **Display** | Reply messages show a compact preview of the referenced message above the reply content |
| **Click to jump** | Clicking the reply preview scrolls to and highlights the referenced message |
| **Deleted reference** | If referenced message is deleted, show "Original message was deleted" |

### Navigation & UX

| Feature | Description |
|---------|-------------|
| Global search | Search across all chats |
| Search within chat | Search within a single chat's messages |
| Unread indicators | Badge counts on chats, visual markers for new messages |
| Jump to message | Deep link to specific messages, scroll + highlight |
| Infinite scroll | Load history on scroll up |
| Jump to bottom | Button when scrolled up + "new messages" banner |
| Timestamps | Relative display (hover for absolute) |

### Notifications

| Feature | Description |
|---------|-------------|
| In-browser | Tab title changes, notification sound |
| Push notifications | Native notifications when tab is closed (PWA) |

---

## 14. Module Functional Specifications: Project Management

An integrated project/task management interface backed by a local SQLite database. The AI agent is the primary operator (creating, updating, commenting); the UI is the human's window into that work.

> _Data model: `Domain → Focus → Project → Task → Task (subtask, recursive)`_
> _Full data model, schema, and CLI specification: see `local-project-management.md`_
> _PM API and WS method surface: see §2.2_
> _Data flow pattern: see §3.2_

### Views

| View | Description |
|------|-------------|
| **Dashboard** | Due soon, blocked, in progress, recent activity — default landing |
| **Kanban** | Columns by status, drag to change status |
| **List** | Sortable, filterable table view |
| **Tree** | Domain → Focus → Project hierarchy, collapsible |
| **Dependency Graph** | Visual representation of blocking relationships |

### Domain Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View all domains | |
| Create | Add new domain | |
| Edit | Change name, description | |
| Delete | Remove domain | Blocked if has focuses |
| Reorder | Change display order | Drag & drop |

### Focus Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View focuses by domain or all | |
| Create | Add new focus under domain | |
| Edit | Change name, description | |
| Move | Move to different domain | Drag & drop |
| Delete | Remove focus | Blocked if has projects |
| Reorder | Change display order within domain | Drag & drop |

### Milestone Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View all milestones | |
| Create | Add new milestone | |
| Edit | Change name, due date, description | |
| Delete | Remove milestone | Linked items remain unchanged |
| View items | See all projects/tasks in milestone | |

### Project Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View projects with filters | Status, domain, focus, priority, due date |
| View | Single project detail page | Tasks, comments, activity, attachments |
| Create | New project under focus | |
| Edit | Update all fields | |
| Move | Change focus | Drag & drop |
| Archive | Set status to archived | Hidden from active views |
| Delete | Remove project | Confirmation required |
| Add comment | Comment on project | |
| Add attachment | Attach file reference | |
| View activity | Project activity feed | |
| Print/Share | Shareable project view | |

### Task Management

| Action | Description | Behavior |
|--------|-------------|----------|
| List | View tasks with filters | By project, status, priority, due |
| View | Single task detail | Subtasks, comments, attachments, blocks |
| Create | New task under project | |
| Create subtask | New task under task | |
| Edit | Update all fields | |
| Move | Change parent project or task | Drag & drop |
| Reorder | Change position within parent | Drag & drop |
| Delete | Remove task | Option: delete subtasks OR move up to parent |
| Add comment | Comment on task | |
| Add attachment | Attach file reference | |

### Comment Management

| Action | Description |
|--------|-------------|
| List | View comments on project/task |
| Create | Add comment |
| Edit | Edit own comment |
| Delete | Delete comment |

### Block/Dependency Management

| Action | Description |
|--------|-------------|
| View | See what blocks / is blocked by (on task detail) |
| Add | Create dependency (T-X blocks T-Y) |
| Remove | Remove dependency |
| Visualize | Dependency graph |

### Activity Feed

| Action | Description |
|--------|-------------|
| View global | All recent activity |
| View by project | Project-scoped activity |
| View by task | Task-scoped activity |
| Filter | By actor, action type, date range |

### Attachment Management

| Action | Description |
|--------|-------------|
| List | View attachments on project/task |
| Add | Add file reference (path + name + description) |
| Remove | Remove attachment |
| Open | Open/download file |

### Search & Filter

| Feature | Description |
|---------|-------------|
| Global search | Search across all projects/tasks |
| Filter by status | todo, in_progress, review, done, cancelled, archived |
| Filter by priority | low, normal, high, urgent |
| Filter by domain | Scope to domain |
| Filter by focus | Scope to focus |
| Filter by due date | Due within N days, overdue |
| Filter by milestone | Scope to milestone |

### Bulk Operations

| Action | Description |
|--------|-------------|
| Multi-select | Select multiple tasks |
| Bulk status change | Change status on selection |
| Bulk move | Move selection to different project |
| Bulk milestone | Assign milestone to selection |

---

## 15. Module Functional Specifications: Documents

A file browser for the user's documents folder. Default root is `~/Documents` (configurable via `dashboard.documentsPath`). The agent can also read and write files here directly via the filesystem. For agent workspace files (SOUL.md, AGENTS.md, etc.), see Settings > Workspace (§17).

> _Server route design and data flow: see §2.3 and §3.3_

### Layout

```
┌──────────────────────────────────────────────────────┐
│  📁 Documents                        🔍 Search       │
│──────────────────────────────────────────────────────│
│  📁 ..                                               │
│  📁 Projects/                       Modified  Size   │
│  📁 Reports/                                         │
│  📄 meeting-notes.md                2h ago    4KB    │
│  📄 research-summary.pdf           1d ago    120KB   │
│  📄 todo.md                         3d ago    1KB    │
│──────────────────────────────────────────────────────│
│  📄 meeting-notes.md  ·  Preview          [Edit]     │
│  ─────────────────────────────────────────────────── │
│  # Team Sync — Feb 9                                 │
│  Discussed the new API design...                     │
│  ...                                                 │
└──────────────────────────────────────────────────────┘
```

### Navigation

| Action | Description |
|--------|-------------|
| Browse | Navigate folder hierarchy |
| Breadcrumb | Path breadcrumb for quick navigation |
| Search | Search files by name across documents folder |
| Sort | Sort by name, modified date, size |

### File Actions

| Action | Description | Behavior |
|--------|-------------|----------|
| View/Preview | Preview file contents | Markdown rendered, code highlighted |
| Edit | Edit file contents | In-browser editor |
| Rename | Rename file or folder | |
| Delete | Delete file or folder | Confirmation required |
| Download | Download file to local machine | |
| Upload | Upload file from local machine | Drag & drop or file picker |
| Copy path | Copy file path to clipboard | |

### Folder Actions

| Action | Description | Behavior |
|--------|-------------|----------|
| Create folder | New folder in current directory | |
| Create file | New empty file in current directory | |
| Rename | Rename folder | |
| Delete | Delete folder | Confirmation, option for recursive |

### Bulk Operations

| Action | Description |
|--------|-------------|
| Multi-select | Select multiple files/folders |
| Bulk delete | Delete selection |
| Bulk move | Move selection to different folder |
| Bulk download | Download selection as zip |

### File Preview Types

| File Type | Preview |
|-----------|---------|
| Markdown (.md) | Rendered markdown |
| Code (.js, .ts, .py, .sh, etc.) | Syntax highlighted |
| JSON / YAML | Formatted + syntax highlighted |
| Images (.png, .jpg, .gif) | Image preview |
| Text (.txt, .log) | Plain text |
| Other | File info (size, modified, type) |

### Agent Access

The agent has direct filesystem access to the documents folder and can read/write files without going through the dashboard. Files created by the agent appear automatically when the user navigates to that directory. The documents path is documented in TOOLS.md so the agent knows where to save files.

---

## 16. Module Functional Specifications: Agent Jobs

Manage the agent's automated work — heartbeat configuration and scheduled cron jobs.

> _Data flow pattern: see §3.4_

### Layout

```
┌──────────────────────────────────────────────────────┐
│  🤖 Agent Jobs                                       │
│──────────────────────────────────────────────────────│
│                                                      │
│  ┌────────────┐                                      │
│  │ Heartbeat  │  Cron Jobs  │                        │
│  └────────────┘                                      │
│                                                      │
│  Heartbeat Configuration                             │
│  ─────────────────────────────────────────────────── │
│  Status: ● Active (every 30 min)                     │  ← interval from config
│  Last run: 2 minutes ago                             │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │ # HEARTBEAT.md                        [Edit]│     │
│  │                                             │     │
│  │ ## Periodic Checks                          │     │
│  │ - [ ] Gmail — anything urgent?              │     │
│  │ - [ ] Calendar — events in next 2 hours?    │     │
│  │ ...                                         │     │
│  └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

> Heartbeat interval comes from `agents.defaults.heartbeat.every` (default `30m`).
> Active hours from `heartbeat.activeHours` (start/end/timezone).
> Target channel from `heartbeat.target` (default `last`).
> All values read via `config.get` — do not hardcode.

### Tab: Heartbeat

The heartbeat is the agent's periodic check-in. HEARTBEAT.md defines what the agent checks each time it wakes up.

| Action | Description | Behavior |
|--------|-------------|----------|
| View | Preview rendered HEARTBEAT.md | Default view |
| Edit | Edit HEARTBEAT.md contents | In-browser markdown editor |
| Save | Save changes | Writes to workspace |
| View status | See heartbeat health | Active/paused, interval, last run time |
| View active hours | Start/end times for heartbeat window | From config |
| Edit active hours | Set quiet hours (start, end, timezone) | config.patch |
| View target | Which channel receives heartbeat alerts | From config |
| Edit target | Change delivery target (last, none, channel name) | config.patch |
| View history | See recent heartbeat results | What was checked, what was surfaced |

### Tab: Cron Jobs

Cron jobs are scheduled tasks the agent runs on a defined schedule. Each job runs in an isolated session.

#### Job List Columns

| Column | Description |
|--------|-------------|
| Name | Job name / description |
| Schedule | When it runs (cron expression, interval, or one-shot) |
| Next run | When it will run next |
| Last run | When it last ran |
| Status | Enabled / Disabled |

#### Job Actions

| Action | Description | Behavior |
|--------|-------------|----------|
| View | See job details | Schedule, payload, run history |
| Create | Add new cron job | Form with schedule + task definition |
| Edit | Modify existing job | Update schedule, payload, name |
| Delete | Remove job | Confirmation required |
| Enable/Disable | Toggle job on/off | Without deleting |
| Run now | Trigger job immediately | Manual execution |
| View runs | See execution history | Results, timestamps, status |

#### Job Schedule Types

| Type | Description | Example |
|------|-------------|---------|
| **Cron expression** | Standard cron schedule | `0 9 * * MON` (9am every Monday) |
| **Interval** | Recurring every N milliseconds | Every 10 minutes |
| **One-shot** | Run once at specific time | At 2026-02-10 15:00 |

#### Job Payload Types

| Type | Description | Use Case |
|------|-------------|----------|
| **System event** | Inject text into main session | Reminders, periodic checks |
| **Agent turn** | Run agent with prompt in isolated session | Background tasks, reports |

#### Job Detail View

| Section | Description |
|---------|-------------|
| **Configuration** | Name, schedule, payload, session target |
| **Run history** | Table of recent executions with timestamp, status, output |
| **Output** | Expandable view of each run's result |

---

## 17. Module Functional Specifications: Settings

Settings is accessible from the sidebar (gear icon). Provides configuration, monitoring, security, and diagnostics.

### Tabs

| Tab | Purpose |
|-----|---------|
| **Workspace** | Edit agent workspace files (SOUL.md, AGENTS.md, etc.) |
| **Information** | Gateway status, usage/costs, nodes, sub-agents, live logs |
| **Skills** | Manage agent skills and capabilities |
| **Security** | Device pairing, Discord integration (app setup, OAuth "Add to Server", connection health) |
| **Dashboard** | Theme, notifications, UI preferences |
| **Advanced** | Exec approvals, raw gateway configuration |
| **About** | Version info, uptime |

### Tab: Workspace

Edit the OpenClaw workspace files that define the agent's behavior, identity, and knowledge.

**Loading behavior:**
- On tab mount, call `GET /api/files?root=workspace` to discover all files in the workspace directory
- Known files (see §2.3) are pinned at the top with descriptions, whether they exist yet or not
- If a known file doesn't exist, show it as a placeholder with a "Create" button
- Any additional files/folders in the workspace (memory/, scripts/, etc.) appear below the known files
- The workspace path is resolved from `agents.defaults.workspace` via `config.get`

| File | Purpose | Description |
|------|---------|-------------|
| **SOUL.md** | Agent personality | Who the agent is, tone, boundaries, formatting preferences |
| **AGENTS.md** | Agent instructions | Operating procedures, rules, conventions |
| **TOOLS.md** | Tool notes | Local tool configuration, device info, API notes |
| **USER.md** | User profile | About the user — name, preferences, context |
| **IDENTITY.md** | Agent identity | Name, avatar, emoji, social accounts |
| **HEARTBEAT.md** | Heartbeat instructions | What the agent checks on each heartbeat (also editable in Agent Jobs tab) |
| **BOOTSTRAP.md** | Bootstrap script | Runs on agent startup |
| **MEMORY.md** | Agent memory | Persistent knowledge the agent maintains |

> The `memory/` subdirectory contains daily memory files managed by the agent. These are browsable but typically not edited by the user.

| Action | Description | Behavior |
|--------|-------------|----------|
| View | Preview rendered markdown | Default view |
| Edit | Edit file contents | In-browser markdown editor |
| Save | Save changes | Writes to workspace |
| Reset | Revert unsaved changes | Confirmation required |
| History | View recent changes | Diff view of recent edits |

> _Data flow: see §3.6. Server route: unified `/api/files?root=workspace` (see §2.3)._

### Tab: Information

System information, monitoring, and diagnostics.

#### Gateway Status

| Info | Description |
|------|-------------|
| **Connection status** | Connected/disconnected |
| **Gateway URL** | Current gateway endpoint |
| **Uptime** | How long the gateway has been running |
| **Current model** | Active model (display, override) |
| **Session count** | Active sessions |
| **Restart** | Restart the gateway |

#### Usage & Costs

| Info | Description |
|------|-------------|
| **Token usage** | Per-provider token consumption (input/output/total) |
| **Estimated costs** | Cost estimates when model pricing is configured |
| **Quota status** | Provider-reported usage windows and limits |
| **Usage by session** | Breakdown by session |

#### Nodes

| Info | Description |
|------|-------------|
| **Node list** | All paired nodes with status (online/offline) |
| **Capabilities** | What each node can do (camera, canvas, exec, etc.) |
| **Node details** | Name, IP, device type, last seen |

#### Sub-agents

| Info | Description |
|------|-------------|
| **Active runs** | Currently running sub-agent tasks |
| **Run history** | Recent completed sub-agent runs with status |
| **Run details** | Task, model, runtime, token usage, cost, output |
| **Stop** | Abort a running sub-agent |
| **View log** | See sub-agent transcript |

#### Live Logs

| Feature | Description |
|---------|-------------|
| **Log tail** | Real-time gateway log stream |
| **Filter** | Filter by level, keyword |
| **Pause/Resume** | Pause live tail for inspection |
| **Export** | Download log output |

### Tab: Skills

Manage agent skills (capabilities).

| Action | Description |
|--------|-------------|
| **List** | All installed skills with enabled/disabled status |
| **Enable/Disable** | Toggle a skill on or off |
| **Install** | Install a new skill from ClawHub or URL |
| **Configure** | Update skill-specific settings (API keys, preferences) |
| **View details** | Skill description, version, documentation |

### Tab: Security

Authentication, authorization, and platform integration connectivity.

#### Device Pairing

| Action | Description |
|--------|-------------|
| **Pending requests** | New devices waiting for approval |
| **Approve/Reject** | Accept or deny a pairing request |
| **Paired devices** | List of approved devices with roles |
| **Revoke** | Remove a paired device |

#### Discord Integration

Each user creates their own Discord Application at discord.com/developers.
Discord allows exactly one bot token per Application — sharing a single Application
across installations is not viable, so each self-hosted deployment uses its own.

**Setup flow (one-time):**

| Step | Action |
|------|--------|
| 1 | User creates a Discord Application at discord.com/developers (guided instructions in Settings) |
| 2 | User enables the Bot feature and copies the bot token |
| 3 | User enables the **Message Content** privileged intent in the Developer Portal |
| 4 | User enters `client_id` and `bot_token` in Settings > Integrations |
| 5 | Gateway stores the bot token in its configuration |

**Connect flow (add bot to server):**

| Step | Action |
|------|--------|
| 1 | User clicks "Add to Discord Server" in Settings > Integrations |
| 2 | falcon-dash generates an OAuth2 URL using the user's `client_id` (`scope=bot`, required permissions) |
| 3 | User signs into Discord (if not already), selects a server |
| 4 | Discord authorizes — bot joins the selected server |
| 5 | Redirect back to falcon-dash confirmation page |
| 6 | Gateway connects to Discord using the stored bot token |
| 7 | `channels.status` shows Discord as connected; channels sync to dashboard |

**Discord permissions required:**
- Read Messages / View Channels
- Send Messages
- Manage Channels (for bidirectional channel sync)
- Read Message History
- Add Reactions
- Use Slash Commands
- Send Messages in Threads
- Create Public Threads
- Create Private Threads
- Manage Threads (for archive/lock sync)

**Privileged intents required:**
- **Message Content** — needed to read message text in channels (self-enable in Developer Portal; no verification needed for bots in <100 servers)
- **Guilds** (non-privileged) — needed for THREAD_CREATE, THREAD_UPDATE, THREAD_DELETE events

**Discord platform limits (self-hosted context):**

| Limit | Value | Impact |
|-------|-------|--------|
| Bot token per Application | 1 | Each installation must use its own Application |
| Unverified bot server cap | 100 servers | Not an issue for single-user (typically 1 server) |
| Privileged intents (<100 servers) | Self-enable in Portal | No approval needed |
| Global rate limit | 50 req/sec per token | Fine for single-user |
| Channel message rate | 5 msg / 5 sec per channel | Fine for single-user |

**Status display:**

| Info | Description |
|------|-------------|
| **Setup status** | Not configured / configured / connected / error |
| **Connection status** | Connected / disconnected / error |
| **Server name** | Discord server the bot is connected to |
| **Channel count** | Number of synced channels |
| **Disconnect** | Remove bot from server (`channels.logout`) |

**Server route:** `GET /api/discord/callback` handles the OAuth2 redirect,
confirms authorization, and notifies the gateway.

#### Future Integrations

Other platforms (Slack, WhatsApp, Telegram, Signal) may be added in the future.
The gateway's `channels.status` abstraction and `web.login.*` QR flow methods
support this extensibility, but no other integrations are planned for the initial release.

### Tab: Dashboard

Dashboard-specific preferences.

| Setting | Description |
|---------|-------------|
| **Theme** | Dark mode / light mode / system |
| **Notifications** | Enable/disable browser notifications |
| **Notification sound** | Enable/disable sound |
| **Compact mode** | Denser UI layout |
| **Default view (PM)** | Default project management view (dashboard/kanban/list/tree) |

### Tab: Advanced

Low-level configuration for power users.

#### Exec Approvals

| Action | Description |
|--------|-------------|
| **View allowlist** | Commands the agent is allowed to execute |
| **Add to allowlist** | Approve a new command pattern |
| **Remove from allowlist** | Revoke a command approval |
| **Ask policy** | Configure ask behavior (off, on-miss, always) |
| **Per-node approvals** | Manage allowlists for specific node hosts |

#### Gateway Configuration

| Action | Description |
|--------|-------------|
| **View config** | Current gateway configuration |
| **Edit config** | Raw JSON editor with schema validation |
| **Apply + Restart** | Validate, write, and restart gateway |

### Tab: About

| Info | Description |
|------|-------------|
| **Agent name** | From IDENTITY.md |
| **OpenClaw version** | Current version |
| **Dashboard version** | Current falcon-dash version |
| **Gateway uptime** | How long the gateway has been running |
| **Session count** | Active sessions |

---

## 18. Passwords UI Specification

> _Backend implementation (KeePassXC, server routes, security model): see §2.3 and §3.5_

Passwords is accessible from the sidebar (key icon, below Settings). Provides a secure interface for managing secrets the agent can use.

| Action | Description | Behavior |
|--------|-------------|----------|
| **List** | View all stored secrets | Titles, usernames, URLs visible; passwords masked |
| **Add** | Add a new secret | Title + username + password + URL + notes; password masked during input |
| **View** | Reveal secret value | Click to reveal, auto-hide after timeout |
| **Edit** | Update secret entry | All fields editable; password masked during input |
| **Delete** | Remove a secret | Confirmation required |
| **Copy** | Copy secret value to clipboard | Auto-clear clipboard after timeout |

### UI Security

- Secret values are **never** sent to the AI model or included in system prompts
- The agent references secrets by path, never by value
- Values are masked in the UI by default (click to reveal)
- Clipboard auto-clears after copy
- Master password unlock required before any secret values are accessible
- Session auto-locks after configurable idle timeout

---

## 19. Global Features

Features that apply across all modules.

### Interaction Patterns

| Pattern | Scope |
|---------|-------|
| **Drag & Drop** | Reorder items, move between parents, change status (kanban) |
| **Dark Mode** | System-aware with manual toggle |
| **Responsive** | Mobile-friendly, works on phones/tablets |

### Platform Requirements

| Requirement | Description |
|-------------|-------------|
| **Mobile-friendly** | Responsive design for all screen sizes |
| **PWA** | Installable, offline viewing, push notifications |
| **Dark mode** | System-aware with manual toggle |

### PWA Features

| Feature | Description |
|---------|-------------|
| Web app manifest | Installable with app icon |
| Service worker | Offline caching strategy |
| Background sync | Queue actions when offline |
| Push notifications | Native notifications when tab is closed |
| Install prompt | Banner/button prompting installation |

### Mobile Layout

On mobile, the sidebar collapses and navigation moves to a bottom tab bar for thumb-friendly access.

#### Desktop vs Mobile

```
Desktop:                          Mobile:
┌────────┬───────────────┐        ┌───────────────────┐
│ Chats  │               │        │  General       ⚙️ │
│ ────── │               │        │─────────────────  │
│ Gen    │   Content     │        │                   │
│ #proj  │               │        │   Content         │
│        │               │        │                   │
│ Apps   │               │        │                   │
│ ────── │               │        │                   │
│ 📋 Proj│               │        ├───────────────────┤
│ 📁 Docs│               │        │ 💬  📋  📁  🤖  ⚙️│
│ 🤖 Jobs│               │        └───────────────────┘
│        │               │
│ ────── │               │
│ ⚙️ Set │               │
│ 🔑 Pass│               │
└────────┴───────────────┘
```

#### Bottom Tab Bar

| Tab | Label | Destination |
|-----|-------|-------------|
| 💬 | Chat | Chat list → tap chat → conversation |
| 📋 | Projects | Project management module |
| 📁 | Docs | Document browser |
| 🤖 | Jobs | Agent jobs (heartbeat + cron) |
| ⚙️ | More | Settings, Passwords, Custom Apps |

**Behaviors:**
- **Chat tab** opens chat list; tap a chat to view messages; back button returns to list
- **More tab** shows overflow items (Settings, Passwords, Custom Apps) that don't fit in the tab bar
- Active tab is visually highlighted
- Unread badge on Chat tab when new messages exist
- Tab bar is always visible (except when keyboard is open)

#### Mobile Touch Targets

| Requirement | Description |
|-------------|-------------|
| **Minimum tap target** | 44×44px for all interactive elements |
| **Swipe gestures** | Swipe back to return to previous view |
| **Pull to refresh** | Refresh chat list, project views |
| **Long press** | Context menus for chats, tasks, messages |
| **Bottom sheet** | Modal actions (create task, add comment) slide up from bottom |

#### Mobile-Specific Adaptations

| Feature | Desktop | Mobile |
|---------|---------|--------|
| **Navigation** | Sidebar | Bottom tab bar |
| **Chat list** | Always visible in sidebar | Full-screen list view |
| **Settings panel** | Inline in header | Full-screen overlay |
| **Modals/dialogs** | Centered dialog | Bottom sheet |
| **Drag & drop** | Mouse drag | Long press + drag |
| **Project views** | Kanban side-scroll, full table | Kanban vertical scroll, card list |
| **Document browser** | Split pane (list + preview) | Full-screen list, tap to preview |
| **Slash commands** | Dropdown above composer | Full-screen command palette |

### Accessibility

| Requirement | Description |
|-------------|-------------|
| ARIA labels | All interactive elements properly labeled |
| Keyboard navigation | Full app navigable without mouse |
| Screen reader support | Tested with common screen readers |
| Focus management | Logical focus flow, visible focus indicators |

### Performance

| Requirement | Description |
|-------------|-------------|
| Bundle optimization | Code splitting, tree shaking |
| Lazy loading | Routes and heavy components loaded on demand |
| Image optimization | Proper sizing and formats |
| Core Web Vitals | Meet "Good" thresholds for LCP, FID, CLS |

### Error Handling

| Requirement | Description |
|-------------|-------------|
| Global error boundary | Graceful fallback for uncaught errors |
| Friendly error messages | User-facing messages for common failures |
| Error reporting | Log errors for debugging |

---

## 20. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Discord-first integration** | Discord is the primary platform integration. Each user creates their own Discord Application (one bot token per app — Discord constraint). The gateway's platform-agnostic session model supports future integrations, but the dashboard is designed Discord-first |
| **Minimal session metadata** | Keep core simple; dashboard filters sessions by kind (see §11.3 visibility rules) |
| **Timestamp-based conflict resolution** | Newest action wins — keeps it intuitive across surfaces |
| **Dashboard as premium surface** | Discord has rendering limitations; dashboard offers the full experience |
| **AI agent as primary PM operator** | Most CRUD operations happen through the agent; UI is human oversight |
| **Group + thread sessions for dashboard chats** | Group sessions are top-level chats (1:1 with Discord channels). Thread sub-sessions are child conversations (1:1 with Discord threads). Main session reserved for future single-threaded integrations. |
| **Threads as gateway sub-sessions** | Discord threads are child channels with their own IDs and message history. Mapping them to sub-sessions (rather than dashboard-only grouping) keeps the gateway as source of truth and enables proper bidirectional sync. |
| **Main session for future single-threaded integrations** | WhatsApp, Telegram, Signal would share the `agent:<agentId>:main` session — reserved for future DM-style platforms |
| **Local SQLite for project management** | Fast, no external dependencies, optimized for AI context generation |
| **Dynamic configuration** | Dashboard reads all defaults from `hello-ok` and `config.get` — never hardcodes gateway values (ports, tick intervals, session defaults, thinking levels) |
| **Documents folder for Files app** | The Files app browses the user's documents folder (~/Documents) rather than the agent workspace. This makes cloud sync (Google Drive, Dropbox) natural since those services typically watch ~/Documents. Agent workspace files (SOUL.md, AGENTS.md, etc.) are managed separately in Settings > Workspace. |

---

## 21. Explicitly Excluded

| Feature | Reason |
|---------|--------|
| Mobile native app | PWA covers mobile needs |
| Voice/video channels | Out of scope |
| Edit/delete own chat messages | Not needed |
| Calendar view (PM) | Not needed for v1 |
| Keyboard shortcuts | Conflicts with slash commands |
| Export conversations | Copy button on individual messages is sufficient |
| End-to-end encryption | Out of scope |
| Voice input | Deferred — use OS/keyboard voice typing |
