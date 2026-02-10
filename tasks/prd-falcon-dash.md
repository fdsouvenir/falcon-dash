# Product Requirements Document: falcon-dash

**Version:** 1.0
**Date:** 2026-02-10
**Status:** Draft
**Source:** `builddocs/falcon-dash-architecture-v02.md`, `builddocs/ws-protocol.md`, `builddocs/pm-spec.md`, `builddocs/research/*`

---

## 1. Introduction / Overview

falcon-dash is a unified web dashboard for interacting with an OpenClaw AI agent. It connects to the OpenClaw Gateway via WebSocket and serves as the primary human interface for chat, project management, document browsing, agent job scheduling, credential management, and agent-generated interactive UI (Canvas/A2UI).

The dashboard replaces the existing built-in Control UI with a richer, feature-complete experience. Discord integration provides a secondary chat surface that stays bidirectionally synced with the dashboard.

**Key differentiators from the existing Control UI:**

- Multi-chat with Discord channel sync (the Control UI is single-session)
- Threaded conversations synced with Discord threads
- Full project management UI backed by a local SQLite database
- Document browser for the user's files (~/Documents)
- Encrypted credential vault (KeePassXC)
- Agent-generated interactive UI (Canvas/A2UI) rendered inline
- Mobile-first PWA with offline support

---

## 2. Goals

| #   | Goal                                               | Measure                                                                      |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| G1  | Provide a complete operator dashboard for OpenClaw | All 6 modules functional (Chat, PM, Docs, Jobs, Passwords, Settings)         |
| G2  | Achieve full bidirectional Discord sync            | Chats, threads, replies, and messages sync in both directions                |
| G3  | Deliver a responsive, mobile-friendly PWA          | Lighthouse PWA score >= 90; usable on 375px-wide screens                     |
| G4  | Enable real-time project management                | PM dashboard renders <200ms after data arrives; drag-and-drop status changes |
| G5  | Maintain reliable gateway connectivity             | Auto-reconnect within 15s; zero message loss across reconnections            |
| G6  | Support agent-generated interactive UI             | A2UI renders inline in chat; HTML canvas renders in sandboxed iframes        |
| G7  | Provide secure credential management               | KeePassXC vault with master password unlock; auto-lock on idle               |

---

## 3. User Stories

Stories are organized by implementation phase. Each story has an ID, title, description, and acceptance criteria.

---

### Phase 1: Core Infrastructure

> **Goal:** SvelteKit app shell + WS client library + connection lifecycle + navigation

#### P1-01: Scaffold SvelteKit Project

**As a** developer, **I want** a properly configured SvelteKit project **so that** I have a foundation to build all modules on.

- [ ] SvelteKit project initialized with TypeScript
- [ ] Tailwind CSS configured (tabs, single quotes, no trailing commas per Prettier config)
- [ ] ESLint + Prettier configured
- [ ] Folder structure matches architecture spec (`src/lib/gateway/`, `src/lib/stores/`, `src/lib/components/`, `src/routes/`)
- [ ] `vite.config.ts` configured for development proxy to gateway port
- [ ] `tsconfig.json` with strict mode enabled

#### P1-02: Implement GatewayConnection

**As a** developer, **I want** a low-level WebSocket connection manager **so that** all modules can communicate with the gateway.

- [ ] `GatewayConnection` class manages WS lifecycle (open, close, send, receive)
- [ ] Sends `client.id: "openclaw-control-ui"` and `client.mode: "webchat"` (gateway-required values)
- [ ] Handles `connect.challenge` event on WS open
- [ ] Sends `connect` request frame with protocol version 3
- [ ] Parses `hello-ok` response and exposes snapshot, features, policy
- [ ] Exposes connection state as a Svelte readable store

#### P1-03: Implement RequestCorrelator

**As a** developer, **I want** request/response correlation **so that** `call()` returns a typed Promise for any gateway method.

- [ ] Maps `req.id` to pending Promise
- [ ] Resolves Promise on matching `res` frame with `ok: true`
- [ ] Rejects Promise on matching `res` frame with `ok: false` (includes error code, message, details)
- [ ] Timeout handling per request (configurable, default 30s)
- [ ] Generates unique request IDs (monotonic counter or UUID)
- [ ] Generates idempotency keys for mutating methods

#### P1-04: Implement EventBus

**As a** developer, **I want** an event subscription system **so that** modules can react to server-push events.

- [ ] `on(event, handler)` registers handler, returns unsubscribe function
- [ ] `once(event)` returns a Promise that resolves on the next occurrence
- [ ] Supports wildcard patterns (e.g., `pm.*`)
- [ ] Auto-cleanup on disconnect (all handlers cleared)
- [ ] Dispatches `agent`, `chat`, `presence`, `tick`, `shutdown`, `exec-approval.*`, `pm`, `cron`, `health`, `heartbeat` events

#### P1-05: Implement SnapshotStore

**As a** developer, **I want** a reactive store hydrated from `hello-ok` **so that** the UI can render gateway state immediately on connect.

- [ ] Hydrated from `hello-ok.snapshot` (presence, health, stateVersion, sessionDefaults)
- [ ] Presence store updated incrementally from `presence` events
- [ ] Health store updated from `health` events
- [ ] `stateVersion` tracked per domain (`{ presence: N, health: N }`)
- [ ] Session defaults (model, contextTokens, thinking level) exposed as readable stores
- [ ] `features.methods` from `hello-ok` stored for runtime feature detection

#### P1-06: Implement Connection State Machine

**As a** developer, **I want** a well-defined connection state machine **so that** the UI shows accurate connection status.

- [ ] States: DISCONNECTED, CONNECTING, AUTHENTICATING, CONNECTED, PAIRING_REQUIRED, AUTH_FAILED, READY, RECONNECTING
- [ ] Transitions match architecture spec section 4.2
- [ ] State exposed as a Svelte readable store
- [ ] READY state set only after `hello-ok` received and snapshot hydrated

#### P1-07: Implement Reconnection with Exponential Backoff

**As a** user, **I want** the dashboard to automatically reconnect **so that** I never have to manually refresh.

- [ ] Exponential backoff: 800ms base, 1.7x multiplier, 15s cap
- [ ] Reconnection triggered on WS close or tick timeout (2x `policy.tickIntervalMs`)
- [ ] On `shutdown` event, uses `restartExpectedMs` as initial delay
- [ ] On successful reconnect, hydrates from new `hello-ok` snapshot
- [ ] Attempt counter resets on successful connection
- [ ] Tick interval read dynamically from `hello-ok` policy (not hardcoded)

#### P1-08: Implement Token-Only Auth (Dev Mode)

**As a** developer, **I want** token-only authentication **so that** I can connect during development without device identity.

- [ ] Sends `auth.token` from stored gateway token
- [ ] Works when `gateway.controlUi.allowInsecureAuth: true` is set
- [ ] Token stored in localStorage
- [ ] Gateway token entry UI (paste token on first connect)

#### P1-09: Implement App Shell Layout

**As a** user, **I want** a sidebar navigation layout **so that** I can switch between modules.

- [ ] Sidebar with two sections: Chats and Apps
- [ ] Chats section: placeholder list (populated in Phase 2)
- [ ] Apps section: Projects, Documents, Agent Jobs entries
- [ ] Settings and Passwords links at sidebar bottom
- [ ] Connection status indicator in sidebar header
- [ ] Responsive: sidebar collapses on mobile (bottom tab bar in Phase 6)

#### P1-10: Implement Connection Status Indicator

**As a** user, **I want** to see connection status at a glance **so that** I know if the dashboard is connected.

- [ ] Green dot: READY
- [ ] Yellow dot + "Reconnecting...": RECONNECTING
- [ ] Red dot + "Disconnected": DISCONNECTED
- [ ] Shows gateway host name from `hello-ok.server.host`
- [ ] Clicking shows connection details (connId, uptime, protocol version)

#### P1-11: Render Presence List from Snapshot

**As a** user, **I want** to see who/what is connected **so that** I know the system status.

- [ ] Presence list rendered from `hello-ok.snapshot.presence`
- [ ] Updated in real-time from `presence` events
- [ ] Shows device type, display name, connection duration
- [ ] Deduplicates by `instanceId`

#### P1-12: Implement PWA Manifest

**As a** user, **I want** a basic PWA manifest **so that** I can install the dashboard as an app.

- [ ] `manifest.json` with app name, icons, theme color, display: standalone
- [ ] Proper `<link rel="manifest">` in `app.html`
- [ ] App icon in multiple sizes (192px, 512px)
- [ ] `start_url` set to `/`
- [ ] `theme-color` and `background-color` set

---

### Phase 2: Chat Module

> **Goal:** Full chat experience with streaming, rich rendering, threads, replies, and Discord sync

#### P2-01: Implement AgentStreamManager

**As a** developer, **I want** a stream manager for agent responses **so that** the chat UI can render streaming content.

- [ ] Tracks active agent runs by `runId`
- [ ] Handles two-stage response: ack (`{ runId, status: "started" }`) → stream → final (`{ runId, status: "ok" }`)
- [ ] Accumulates `event:agent` deltas (text contains full accumulated text, not incremental diffs)
- [ ] Emits higher-level events: `messageStart`, `delta`, `toolCall`, `toolResult`, `messageEnd`
- [ ] Detects seq gaps in agent events
- [ ] Handles `chat.abort` for stopping active runs

#### P2-02: Implement Chat Store

**As a** developer, **I want** per-session reactive stores **so that** the chat UI stays in sync with gateway state.

- [ ] Per-session writable store with message list
- [ ] Active run tracking by `runId`
- [ ] Streaming deltas append to current message buffer
- [ ] Final response commits message to history
- [ ] Optimistic send: user message appears immediately, confirmed on ack
- [ ] Error state for failed sends
- [ ] Messages deduped by ID on reconnect reconciliation

#### P2-03: Implement Markdown Rendering Pipeline

**As a** user, **I want** rich message rendering **so that** agent responses display formatted content.

- [ ] unified/remark/rehype pipeline for CommonMark + GFM (tables, strikethrough, task lists)
- [ ] KaTeX for inline math (`$...$`) and block equations (`$$...$$`)
- [ ] Mermaid.js for diagrams (flowcharts, sequence, pie, Gantt, state)
- [ ] Shiki for syntax-highlighted code blocks with language detection
- [ ] Admonition/callout boxes (NOTE, TIP, WARNING, CAUTION, IMPORTANT)
- [ ] Collapsible `<details>/<summary>` sections
- [ ] Link previews (URL unfurling)
- [ ] Compaction divider (visual separator indicating where transcript compaction occurred)

#### P2-04: Implement Thinking Blocks

**As a** user, **I want** to see the agent's thinking process **so that** I can understand its reasoning.

- [ ] Collapsible section above the response, default collapsed while streaming
- [ ] Thinking text streams in real-time inside the collapsible
- [ ] User can expand to watch thinking in progress; collapse state persists
- [ ] Thinking streams first, then response streams below it
- [ ] Label: "Thinking..." while streaming, "Thought for Xs" when complete
- [ ] Supports all thinking levels: off, minimal, low, medium, high, xhigh

#### P2-05: Implement Tool Call Cards

**As a** user, **I want** to see agent tool calls **so that** I know what actions the agent performed.

- [ ] Cards display tool name, arguments (collapsed by default), and result
- [ ] Expandable to show full args and result JSON
- [ ] Shows runtime shell information when available (which shell executed a command)
- [ ] Visual distinction between running, completed, and failed tool calls
- [ ] Renders inline in the message flow at the point the tool was called

#### P2-06: Implement Message Composer

**As a** user, **I want** a rich message input **so that** I can communicate with the agent effectively.

- [ ] SHIFT+ENTER inserts newline (multi-line input)
- [ ] ENTER sends message
- [ ] File upload button + drag-and-drop to attach files
- [ ] Clipboard paste support for screenshots/images
- [ ] Typing indicator shows when composing
- [ ] Disabled state while agent is responding (with abort button)
- [ ] Auto-resize textarea to fit content

#### P2-07: Implement Slash Commands

**As a** user, **I want** slash commands in the composer **so that** I can quickly control the chat.

- [ ] Typing `/` opens autocomplete dropdown (Discord-style)
- [ ] Fuzzy-filter as user types
- [ ] Commands: `/new`, `/status`, `/stop`, `/compact`, `/usage`, `/reasoning`, `/verbose`, `/context`, `/subagents`, `/send`
- [ ] `/new [model]` calls `sessions.reset`, optionally sets model
- [ ] `/stop` calls `chat.abort`
- [ ] `/reasoning [level]` calls `sessions.patch` with thinking level
- [ ] `/compact [instructions]` calls `sessions.compact`

#### P2-08: Implement Chat List Sidebar

**As a** user, **I want** a list of my chats **so that** I can switch between conversations.

- [ ] Loads via `sessions.list` with `kinds` filter (only group sessions)
- [ ] "General" chat always first, cannot be deleted or renamed
- [ ] Regular chats can be created, renamed, deleted, reordered
- [ ] Unread badges per chat
- [ ] Search/filter chats
- [ ] Live updates from session events (new Discord channel appears automatically)

#### P2-09: Implement New Chat Creation

**As a** user, **I want** to create new chats **so that** I can start fresh conversations.

- [ ] "+ New Chat" button in chat list
- [ ] Generates key: `agent:<agentId>:webchat:group:<crypto.randomUUID()>`
- [ ] `agentId` from `hello-ok.snapshot.sessionDefaults.defaultAgentId`
- [ ] Creates via `sessions.patch` with label
- [ ] Navigates to new chat view
- [ ] Session appears in `sessions.list` immediately

#### P2-10: Implement General Chat Persistence

**As a** user, **I want** a "General" chat that always exists **so that** I have a default conversation.

- [ ] On first connect, checks `sessions.list` for group session with label "General" and channel "webchat"
- [ ] If not found, creates via `sessions.patch`
- [ ] Cannot be deleted or renamed
- [ ] Default landing chat when opening the dashboard

#### P2-11: Implement Chat Session Settings

**As a** user, **I want** per-chat settings **so that** I can configure individual conversations.

- [ ] Chat header shows current model and settings gear
- [ ] Settings panel: model override, thinking level (off/minimal/low/medium/high/xhigh), verbose mode
- [ ] Reset session (equivalent to `/new`)
- [ ] Compact transcript (equivalent to `/compact`)
- [ ] Settings applied via `sessions.patch`
- [ ] Defaults from `hello-ok.snapshot.sessionDefaults`

#### P2-12: Implement Connection Resilience for Chat

**As a** user, **I want** chat to survive reconnections **so that** I never lose messages.

- [ ] On reconnect, calls `chat.history` to fill message gaps since last known message
- [ ] Deduplicates messages by ID when reconciling
- [ ] Resumes streaming if agent was mid-response
- [ ] Messages typed while disconnected are queued and sent on reconnect
- [ ] Silent reconnect if <2s (no visible indicator)
- [ ] "Reconnecting..." indicator for longer disconnections

#### P2-13: Implement Message Replies

**As a** user, **I want** to reply to specific messages **so that** I can reference earlier context.

- [ ] "Reply" action on message hover/menu
- [ ] Composer shows compact preview of referenced message above input
- [ ] Cancel reply by clicking X on preview
- [ ] Reply messages display compact preview of referenced message above content
- [ ] Clicking reply preview scrolls to and highlights referenced message
- [ ] `replyToMessageId` sent in `chat.send` params
- [ ] Handles deleted references gracefully ("Original message was deleted")

#### P2-14: Implement Thread Panel

**As a** user, **I want** threaded conversations **so that** I can discuss topics without cluttering the main chat.

- [ ] "Start Thread" action on messages opens side panel
- [ ] Generates thread key: `agent:<agentId>:webchat:group:<parentId>:thread:<uuid>`
- [ ] Creates thread session via `sessions.patch` with `parentSessionId` and `originMessageId`
- [ ] Thread panel: header (name, parent chat, close), messages, composer
- [ ] Independent message history for the thread sub-session
- [ ] Thread composer sends to thread session, not parent
- [ ] Messages with threads show thread indicator with reply count

#### P2-15: Implement Thread Lifecycle

**As a** user, **I want** threads to have lifecycle states **so that** old threads don't clutter the interface.

- [ ] Thread states: Active, Archived, Locked
- [ ] Auto-archive after configurable inactivity (default 24h)
- [ ] Sending a message to archived thread auto-unarchives
- [ ] Locked threads: only creator/admin can unarchive
- [ ] Thread list button in chat header shows all threads for current chat
- [ ] Thread list: name, last activity, message count, state

#### P2-16: Implement Discord Chat Sync

**As a** user, **I want** chats synced with Discord channels **so that** I can use either interface.

- [ ] Creating a chat in the dashboard syncs as a new Discord channel (when Discord is connected)
- [ ] Creating a channel in Discord syncs as a new chat in the dashboard
- [ ] Renaming/deleting syncs bidirectionally
- [ ] Messages sent from dashboard appear in Discord and vice versa
- [ ] Chat list updates in real-time when Discord channels change

#### P2-17: Implement Discord Thread Sync

**As a** user, **I want** threads synced with Discord threads **so that** threaded conversations work across both interfaces.

- [ ] Creating a thread in the dashboard syncs as a new Discord thread
- [ ] Creating a thread in Discord syncs as a thread sub-session
- [ ] Thread archive/unarchive syncs bidirectionally
- [ ] Thread messages sync in both directions
- [ ] Forum/media thread-create starter messages supported

#### P2-18: Implement Discord Reply Sync

**As a** user, **I want** replies synced with Discord message references **so that** reply context is preserved.

- [ ] `replyToMessageId` in `chat.send` maps to Discord `message_reference`
- [ ] Replies from Discord appear as reply messages in dashboard
- [ ] Reply preview shows correct referenced message in both interfaces

#### P2-19: Implement Message Actions

**As a** user, **I want** quick actions on messages **so that** I can interact with responses efficiently.

- [ ] Copy response (one-click copy entire response as raw markdown)
- [ ] Reactions (quick emoji responses)
- [ ] Reply (starts inline reply — see P2-13)
- [ ] Start Thread (opens thread panel — see P2-14)
- [ ] Bookmark/Star (mark important messages)

#### P2-20: Implement Chat Navigation and Search

**As a** user, **I want** search and navigation within chats **so that** I can find specific messages.

- [ ] Global search across all chats
- [ ] Search within a single chat's messages
- [ ] Unread indicators: badge counts on chats, visual markers for new messages
- [ ] Jump to message via deep link (scroll + highlight)
- [ ] Infinite scroll: load history on scroll up
- [ ] Jump to bottom button when scrolled up + "new messages" banner
- [ ] Timestamps: relative display, hover for absolute

#### P2-21: Implement Chat Notifications

**As a** user, **I want** notifications for new messages **so that** I don't miss agent responses.

- [ ] Tab title changes when new messages arrive
- [ ] Notification sound (configurable)
- [ ] Browser notification API for when tab is not focused
- [ ] Unread badge on Chat tab (mobile) and individual chats

---

### Phase 3A: Documents

> **Goal:** File browser for the user's documents folder

#### P3A-01: Implement Document Server Routes

**As a** developer, **I want** server-side file API routes **so that** the browser can access the user's documents folder.

- [ ] `GET /api/files?root=documents` — root directory listing
- [ ] `GET /api/files/*path?root=documents` — file content (with hash) or directory listing
- [ ] `PUT /api/files/*path?root=documents` — write file content (requires `baseHash` for concurrency)
- [ ] `POST /api/files/*path?root=documents` — create new file or folder
- [ ] `DELETE /api/files/*path?root=documents` — delete file or folder
- [ ] Root resolves to `dashboard.documentsPath` config (default `~/Documents`)
- [ ] SHA-256 hash-based optimistic concurrency on writes
- [ ] `.secrets/` directory never exposed

#### P3A-02: Implement Document Browser

**As a** user, **I want** to browse my documents folder **so that** I can find and manage files.

- [ ] Directory listing with name, modified date, size columns
- [ ] Navigate into folders; breadcrumb path for quick navigation
- [ ] Back navigation (`..` entry)
- [ ] Sort by name, modified date, size
- [ ] Search files by name across documents folder
- [ ] File type icons (folder, markdown, code, image, etc.)

#### P3A-03: Implement Document Editor

**As a** user, **I want** to edit documents in the browser **so that** I can make changes without leaving the dashboard.

- [ ] CodeMirror (or similar) editor for markdown and text files
- [ ] Syntax highlighting for code files
- [ ] Preview pane for rendered markdown
- [ ] Hash-based save (rejects if file changed externally since load)
- [ ] Unsaved changes indicator
- [ ] File type-specific previews: markdown rendered, code highlighted, images displayed, JSON/YAML formatted

#### P3A-04: Implement Document Create and Upload

**As a** user, **I want** to create and upload files **so that** I can add content to my documents folder.

- [ ] Create new file (specify name + optional content)
- [ ] Create new folder
- [ ] Upload file via drag-and-drop or file picker
- [ ] Rename files and folders
- [ ] Delete files and folders (confirmation required)
- [ ] Copy file path to clipboard
- [ ] Download file to local machine

#### P3A-05: Implement Document Bulk Operations

**As a** user, **I want** to perform bulk operations **so that** I can manage multiple files at once.

- [ ] Multi-select files/folders
- [ ] Bulk delete (confirmation required)
- [ ] Bulk move to different folder
- [ ] Bulk download as zip

---

### Phase 3B: Agent Jobs

> **Goal:** Heartbeat configuration and cron job management

#### P3B-01: Implement Cron Job List

**As a** user, **I want** to see all scheduled jobs **so that** I know what the agent does automatically.

- [ ] Loads via `cron.list` with `includeDisabled: true`
- [ ] Columns: name, schedule (cron/interval/one-shot), next run, last run, status (enabled/disabled)
- [ ] Live updates from `event:cron` events
- [ ] Empty state with "Create Job" prompt

#### P3B-02: Implement Cron Job CRUD

**As a** user, **I want** to create, edit, and delete cron jobs **so that** I can configure the agent's automated tasks.

- [ ] Create form: name, description, schedule type (cron expression/interval/one-shot), payload type (system event/agent turn), session target
- [ ] Edit existing job (all fields)
- [ ] Delete job (confirmation required)
- [ ] Enable/disable toggle via `cron.update({ id, patch: { enabled: bool } })`
- [ ] "Run Now" button via `cron.run({ id, mode: "force" })`

#### P3B-03: Implement Cron Run History

**As a** user, **I want** to see job execution history **so that** I can verify jobs ran successfully.

- [ ] Per-job run history via `cron.runs({ id, limit: 50 })`
- [ ] Table: timestamp, status (success/error), output (expandable)
- [ ] Detail view with full run output

#### P3B-04: Implement Heartbeat Configuration

**As a** user, **I want** to configure the agent's heartbeat **so that** I control what it checks periodically.

- [ ] View heartbeat status: active/paused, interval (from `agents.defaults.heartbeat.every`), last run time
- [ ] View and edit active hours (start, end, timezone from config)
- [ ] View and edit delivery target (last, none, channel name from config)
- [ ] Preview rendered HEARTBEAT.md
- [ ] Edit HEARTBEAT.md in-browser markdown editor
- [ ] Save writes via `agents-files.set`
- [ ] Config changes via `config.patch`

#### P3B-05: Implement Heartbeat History

**As a** user, **I want** to see recent heartbeat results **so that** I know what the agent checked.

- [ ] View recent heartbeat executions via `last-heartbeat` method
- [ ] Shows what was checked and what was surfaced

#### P3B-06: Implement Cron Event Integration

**As a** user, **I want** live job status updates **so that** I see changes without refreshing.

- [ ] Subscribe to `event:cron` events
- [ ] Update job list in real-time on status changes
- [ ] Toast notification for job completion/failure

---

### Phase 3C: Passwords

> **Goal:** Encrypted credential vault using KeePassXC

#### P3C-01: Implement Password Server Routes

**As a** developer, **I want** server-side password API routes **so that** the browser can interact with the KeePassXC vault.

- [ ] `GET /api/passwords` — list entries (titles, usernames, URLs; no secret values)
- [ ] `POST /api/passwords/unlock` — unlock vault with master password; returns session token
- [ ] `GET /api/passwords/:path` — get entry with decrypted password (requires session token)
- [ ] `PUT /api/passwords/:path` — create or update entry (requires session token)
- [ ] `DELETE /api/passwords/:path` — delete entry (requires session token)
- [ ] `POST /api/passwords/lock` — clear session
- [ ] `POST /api/passwords/init` — create new vault (first-run only)
- [ ] All operations shell out to `keepassxc-cli` against `~/.openclaw/passwords.kdbx`

#### P3C-02: Implement Vault Creation Flow

**As a** user, **I want** to create a password vault on first run **so that** I have secure secret storage.

- [ ] Detect if `~/.openclaw/passwords.kdbx` exists
- [ ] If not: prompt for master password, create vault via `keepassxc-cli db-create`
- [ ] Validate master password strength
- [ ] Confirm password (type twice)
- [ ] Vault uses KDBX4 format (AES-256 + Argon2)

#### P3C-03: Implement Password List UI

**As a** user, **I want** to browse stored credentials **so that** I can find and use them.

- [ ] List view: title, username, URL (password always masked)
- [ ] Group/folder navigation
- [ ] Search by title, username, URL
- [ ] Sort by title, modified date

#### P3C-04: Implement Password CRUD

**As a** user, **I want** to add, edit, and delete credentials **so that** I can manage my secrets.

- [ ] Add new entry: title, username, password, URL, notes
- [ ] Edit existing entry (all fields)
- [ ] Delete entry (confirmation required)
- [ ] Password masked during input (toggle visibility)
- [ ] Password generator (optional)

#### P3C-05: Implement Vault Unlock Flow

**As a** user, **I want** to unlock the vault with my master password **so that** I can access secret values.

- [ ] Master password prompt before any secret values are accessible
- [ ] Server-side session (in-memory) with configurable idle timeout
- [ ] Auto-lock after idle timeout
- [ ] Manual lock button
- [ ] "Reveal" button per entry to show password (requires active session)
- [ ] Copy to clipboard with auto-clear after timeout

#### P3C-06: Implement Secrets Migration

**As a** user, **I want** to import existing `.secrets/` files **so that** I can consolidate credentials.

- [ ] `POST /api/passwords/import-secrets` — migrate `.secrets/` files into vault
- [ ] One-time migration with confirmation
- [ ] Shows preview of files to import before proceeding
- [ ] Preserves file names as entry titles

#### P3C-07: Implement Password Security Model

**As a** user, **I want** my credentials secured **so that** they are never accidentally exposed.

- [ ] Secret values never sent to the AI model or included in system prompts
- [ ] Agent references secrets by path, never by value
- [ ] Values masked in UI by default
- [ ] Clipboard auto-clears after configurable timeout
- [ ] All encryption/decryption happens server-side via `keepassxc-cli`
- [ ] `.kdbx` file encrypted at rest (no plaintext secrets on disk)

---

### Phase 4A: PM Skill Backend

> **Goal:** SQLite data layer + WS method registration + real-time events

#### P4A-01: Implement PM SQLite Data Layer

**As a** developer, **I want** a SQLite database with CRUD operations **so that** the PM system has a data foundation.

- [ ] Database at `~/.openclaw/data/pm.db` (configurable via `pm.database.path`)
- [ ] Schema applied: domains, focuses, milestones, projects, tasks, comments, blocks, activities, attachments, sync_mappings tables
- [ ] `sort_order` columns on domains, focuses, tasks for drag-and-drop reorder
- [ ] All CRUD operations for all entities
- [ ] Activity auto-logging on all mutations
- [ ] `last_activity_at` updated on any activity (comments, child updates)
- [ ] `updated_at` updated only on direct field edits
- [ ] better-sqlite3 for synchronous, fast access

#### P4A-02: Implement PM FTS5 Search Index

**As a** developer, **I want** full-text search **so that** users can find PM entities by content.

- [ ] FTS5 virtual table: `pm_search` with `entity_type`, `entity_id`, `project_id`, `title`, `body`
- [ ] Tokenizer: `porter unicode61`
- [ ] Triggers to keep FTS in sync (insert, update, delete on projects, tasks, comments)
- [ ] Search returns ranked results with match context snippets
- [ ] Relevance scoring

#### P4A-03: Implement PM WS Method Registration

**As a** developer, **I want** all `pm.*` methods registered with the gateway **so that** the dashboard can call them over WebSocket.

- [ ] ~45 methods registered across 13 method groups
- [ ] Domain: `pm.domain.list`, `get`, `create`, `update`, `delete`, `reorder`
- [ ] Focus: `pm.focus.list`, `get`, `create`, `update`, `move`, `delete`, `reorder`
- [ ] Milestone: `pm.milestone.list`, `get`, `create`, `update`, `delete`
- [ ] Project: `pm.project.list`, `get`, `create`, `update`, `delete`
- [ ] Task: `pm.task.list`, `get`, `create`, `update`, `move`, `reorder`, `delete`
- [ ] Comment: `pm.comment.list`, `create`, `update`, `delete`
- [ ] Block: `pm.block.list`, `create`, `delete`
- [ ] Attachment: `pm.attachment.list`, `create`, `delete`
- [ ] Activity: `pm.activity.list`
- [ ] Context: `pm.context.dashboard`, `domain`, `project`
- [ ] Search: `pm.search`
- [ ] Bulk: `pm.bulk.update`, `move`
- [ ] Stats: `pm.stats`

#### P4A-04: Implement PM Request Validation

**As a** developer, **I want** request/response validation **so that** invalid data is rejected early.

- [ ] TypeBox schemas for all `pm.*` method params and responses
- [ ] Validation on all incoming requests
- [ ] PM-specific error codes: `PM_NOT_FOUND`, `PM_CONSTRAINT`, `PM_INVALID_PARENT`, `PM_CIRCULAR_BLOCK`, `PM_DUPLICATE`
- [ ] Mutating methods require `idempotencyKey`
- [ ] ID format: accepts both raw integers and prefixed IDs (e.g., `42` or `P-42`)
- [ ] Cursor-based pagination on all list methods (default 50, max 200)

#### P4A-05: Implement PM Real-Time Events

**As a** developer, **I want** PM mutation events broadcast to all clients **so that** the UI stays in sync.

- [ ] `event:pm` broadcast on all mutations
- [ ] Payload: action (created/updated/deleted/moved/reordered), entityType, entityId, projectId, actor, data, timestamp
- [ ] `stateVersion` increments monotonically
- [ ] Data varies by action: full entity on create, changed fields on update, id on delete
- [ ] All operator clients receive PM events automatically (no subscription)

#### P4A-06: Implement PM Context Generation

**As a** developer, **I want** AI-optimized context summaries **so that** the dashboard can show what the agent sees.

- [ ] `pm.context.dashboard` — overview markdown (~1-2k tokens): due soon, in progress, blocked, recent activity
- [ ] `pm.context.domain` — domain deep dive (~3-5k tokens)
- [ ] `pm.context.project` — full project context (~5-10k tokens): tasks, comments, activity, blocks
- [ ] Markdown output suitable for both AI consumption and dashboard rendering
- [ ] Response includes `generated_at` timestamp and aggregate stats

#### P4A-07: Implement PM Stats Aggregates

**As a** developer, **I want** quick aggregate stats **so that** the dashboard header can render summaries.

- [ ] `pm.stats` returns: project counts by status, task counts by status, blocked count, overdue count, recent activity count (24h), due soon count (7 days)

#### P4A-08: Implement PM Bulk Operations

**As a** developer, **I want** bulk mutation methods **so that** the UI can perform multi-select operations.

- [ ] `pm.bulk.update` — update status, priority, milestone, due date on multiple targets
- [ ] `pm.bulk.move` — move multiple tasks to a new parent (project or task)
- [ ] Returns updated count and per-item errors
- [ ] Circular dependency check on bulk move

---

### Phase 4B: PM Dashboard UI

> **Goal:** Full project management UI consuming PM skill methods

#### P4B-01: Implement PM Store Layer

**As a** developer, **I want** reactive PM stores **so that** the UI stays in sync with PM data.

- [ ] Cached entity stores (domains, focuses, projects, tasks) hydrated on module mount
- [ ] Optimistic updates: mutations applied locally before server confirms, rollback on error
- [ ] `event:pm` events update cache incrementally
- [ ] `stateVersion` gap detection → refetch affected entities
- [ ] Derived stores for kanban, list, and tree views
- [ ] Feature detection: PM methods only available when pm-skill installed (check `features.methods`)

#### P4B-02: Implement PM Dashboard View

**As a** user, **I want** a project dashboard **so that** I see the big picture at a glance.

- [ ] `pm.stats` header: total projects, active, due soon, blocked, overdue
- [ ] Due soon section (next 7 days)
- [ ] In progress projects with task progress bars
- [ ] Blocked items section
- [ ] Recent activity feed
- [ ] Default landing view for the Projects app

#### P4B-03: Implement Domain/Focus Navigation

**As a** user, **I want** hierarchical navigation **so that** I can scope my view to a domain or focus area.

- [ ] Tree sidebar: Domain → Focus hierarchy via `pm.domain.list` + `pm.focus.list`
- [ ] Click domain to filter projects
- [ ] Click focus to filter further
- [ ] Project and task counts per node
- [ ] Drag-and-drop reorder domains and focuses

#### P4B-04: Implement Project List View

**As a** user, **I want** a filterable project list **so that** I can find and manage projects.

- [ ] Sortable table: title, status, priority, due date, focus, task progress
- [ ] Filters: status, priority, domain, focus, milestone, due date range, overdue
- [ ] Pagination (cursor-based, 50 per page)
- [ ] Click project to open detail view
- [ ] Create new project button

#### P4B-05: Implement Kanban Board

**As a** user, **I want** a kanban board **so that** I can visualize and change task status by dragging.

- [ ] Columns by status (todo, in_progress, review, done)
- [ ] Drag tasks between columns to change status (calls `pm.task.update`)
- [ ] Drag to reorder within column (calls `pm.task.reorder`)
- [ ] Cards show: title, priority badge, due date, subtask count, blocked indicator
- [ ] Filterable by project, priority, assignee
- [ ] Scoped to a single project or across all projects

#### P4B-06: Implement Project Detail View

**As a** user, **I want** a comprehensive project detail page **so that** I can manage all aspects of a project.

- [ ] Header: title, status, priority, due date, focus breadcrumb
- [ ] Task tree (recursive subtasks) via `pm.project.get` with `includeTasks: true`
- [ ] Comments section with add/edit/delete
- [ ] Attachments section with add/remove
- [ ] Activity feed (most recent N entries)
- [ ] Blocking/blocked-by relationships
- [ ] Edit all project fields inline

#### P4B-07: Implement Task Detail Panel

**As a** user, **I want** a task detail panel **so that** I can view and edit task information.

- [ ] Slide-out panel or modal with full task details
- [ ] Ancestry breadcrumb (project → parent task → current task)
- [ ] Edit: title, body, status, priority, due date, milestone
- [ ] Subtask list with create/reorder
- [ ] Comments with add/edit/delete
- [ ] Attachments with add/remove
- [ ] Blocking/blocked-by with add/remove dependencies
- [ ] Delete task with mode choice (cascade subtasks or promote to parent)

#### P4B-08: Implement AI Context Panel

**As a** user, **I want** to see what context the agent receives **so that** I can verify AI context quality.

- [ ] "AI Context" panel/tab in project view
- [ ] Calls `pm.context.project` and renders the markdown
- [ ] Dashboard-level context via `pm.context.dashboard`
- [ ] Styled panel showing the same summaries the agent uses
- [ ] Refresh button to regenerate

#### P4B-09: Implement PM Bulk Operations UI

**As a** user, **I want** to perform bulk actions **so that** I can manage multiple tasks at once.

- [ ] Multi-select tasks (checkbox column)
- [ ] Bulk toolbar: change status, change priority, assign milestone, move to project
- [ ] Calls `pm.bulk.update` / `pm.bulk.move`
- [ ] Shows per-item errors if any fail

#### P4B-10: Implement PM Search

**As a** user, **I want** to search across all PM entities **so that** I can find anything quickly.

- [ ] Search bar in PM module header
- [ ] Calls `pm.search` with query
- [ ] Results grouped by type (project, task, comment)
- [ ] Shows match context snippet and relevance score
- [ ] Click result navigates to entity detail
- [ ] Filter results by type and status

#### P4B-11: Implement PM Create Flows

**As a** user, **I want** to create domains, focuses, milestones, projects, and tasks **so that** I can organize my work.

- [ ] Create domain: slug, name, description
- [ ] Create focus: slug, domain, name, description
- [ ] Create milestone: name, due date, description
- [ ] Create project: focus, title, description, status, priority, due date, milestone
- [ ] Create task: parent (project or task), title, body, status, priority, due date, milestone
- [ ] All create forms validate required fields

#### P4B-12: Implement Dependency Graph

**As a** user, **I want** a visual dependency graph **so that** I can understand blocking relationships.

- [ ] Visual representation of task blocking relationships
- [ ] Calls `pm.block.list` for project scope
- [ ] Node = task, edge = blocks relationship
- [ ] Color coding: blocked (red), blocking (orange), clear (green)
- [ ] Click node to navigate to task detail

---

### Phase 5A: Settings

> **Goal:** Complete settings and configuration interface

#### P5A-01: Implement Workspace Files Tab

**As a** user, **I want** to edit agent workspace files **so that** I can customize agent behavior.

- [ ] Loads via `agents-files.list` to discover all files
- [ ] Known files pinned at top: SOUL.md, AGENTS.md, TOOLS.md, USER.md, IDENTITY.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md
- [ ] Missing known files show "Create" button
- [ ] Additional files/folders (memory/, scripts/) shown below
- [ ] Click file → preview rendered markdown
- [ ] Edit button → in-browser markdown editor
- [ ] Save via `agents-files.set` with hash-based concurrency

#### P5A-02: Implement Information Tab

**As a** user, **I want** system information **so that** I can monitor gateway health and usage.

- [ ] Gateway status: connection, URL, uptime, current model, session count
- [ ] Usage & costs: token usage per provider, estimated costs, usage by session
- [ ] Node list: paired nodes with status, capabilities, device type
- [ ] Sub-agents: active runs, history, details (task, model, tokens, cost), stop/log actions
- [ ] Restart gateway button via `update.run`

#### P5A-03: Implement Skills Tab

**As a** user, **I want** to manage agent skills **so that** I can enable or disable capabilities.

- [ ] List all skills via `skills.status`
- [ ] Enable/disable toggle via `skills.update({ skillKey, enabled })`
- [ ] API key management via `skills.update({ skillKey, apiKey })`
- [ ] Install new skill via `skills.install({ name, installId, timeoutMs: 120000 })`
- [ ] Skill details: description, version, documentation

#### P5A-04: Implement Discord Integration Setup

**As a** user, **I want** to connect Discord **so that** my chats sync with Discord channels.

- [ ] Step-by-step setup guide: create Discord Application, enable bot, copy token, enable Message Content intent
- [ ] Input fields for `client_id` and `bot_token`
- [ ] "Add to Discord Server" button generates OAuth2 URL with required permissions
- [ ] OAuth2 callback handler (`GET /api/discord/callback`)
- [ ] Permissions: Read/Send Messages, Manage Channels, Read History, Reactions, Slash Commands, Thread operations
- [ ] Status display: not configured / configured / connected / error
- [ ] Server name, channel count, disconnect button

#### P5A-05: Implement Device Management

**As a** user, **I want** to manage paired devices **so that** I control access to my gateway.

- [ ] Pending pairing requests via `device-pair.list`
- [ ] Approve/Reject buttons via `device-pair.approve/reject`
- [ ] Paired devices list
- [ ] Token rotation via `device-token.rotate`
- [ ] Token revocation via `device-token.revoke`
- [ ] Live updates from `device-pair.requested/resolved` events

#### P5A-06: Implement Exec Approvals Tab

**As a** user, **I want** to manage command execution approvals **so that** I control what the agent can run.

- [ ] View allowlist via `exec-approvals.get`
- [ ] Add/remove command patterns to allowlist
- [ ] Ask policy configuration (off, on-miss, always)
- [ ] Per-node allowlists via `exec-approvals-node.get/set`
- [ ] Pending approval queue from `exec-approval.requested` events
- [ ] Approve/deny via `exec-approval.resolve` with decisions: allow-once, allow-always, deny
- [ ] Auto-dismiss timeout on pending requests

#### P5A-07: Implement Gateway Configuration Editor

**As a** user, **I want** to edit gateway configuration **so that** I can tune system behavior.

- [ ] View current config via `config.get`
- [ ] Raw JSON editor with syntax highlighting
- [ ] Schema validation from `config.schema`
- [ ] Hash-based optimistic concurrency (sends `baseHash`)
- [ ] Save via `config.set` (no restart) or Apply + Restart via `config.apply`
- [ ] Warning on Apply that gateway will restart

#### P5A-08: Implement Live Logs Viewer

**As a** user, **I want** to view live gateway logs **so that** I can debug issues.

- [ ] Log tail via `logs.tail({ cursor, limit: 500, maxBytes: 250000 })`
- [ ] Cursor-based polling (not streaming)
- [ ] Filter by text and log level
- [ ] Auto-follow mode (scroll to bottom on new entries)
- [ ] Pause/Resume live tail
- [ ] Sliding window (old entries trimmed)
- [ ] Export/download log output

#### P5A-09: Implement Models List

**As a** user, **I want** to see available models **so that** I know what I can use.

- [ ] Load via `models.list`
- [ ] Shows all models across all providers
- [ ] Model selector in chat settings references this list
- [ ] Refresh button

#### P5A-10: Implement Dashboard Preferences Tab

**As a** user, **I want** to configure dashboard appearance **so that** I can personalize my experience.

- [ ] Theme: dark mode / light mode / system
- [ ] Notifications: enable/disable browser notifications
- [ ] Notification sound: enable/disable
- [ ] Compact mode: denser UI layout
- [ ] Default PM view: dashboard / kanban / list / tree

#### P5A-11: Implement About Tab

**As a** user, **I want** version and system info **so that** I know what's running.

- [ ] Agent name from IDENTITY.md (via `agent-identity`)
- [ ] OpenClaw version from `hello-ok.server.version`
- [ ] Dashboard version (from package.json)
- [ ] Gateway uptime
- [ ] Active session count

---

### Phase 5B: Canvas / A2UI

> **Goal:** Agent-generated interactive UI rendered in the dashboard

#### P5B-01: Implement A2UI Web Component Integration

**As a** developer, **I want** the A2UI web component embedded in falcon-dash **so that** agent-generated UIs render natively.

- [ ] Import `a2ui.bundle.js` (Lit web component, ~17K lines bundled)
- [ ] `<openclaw-a2ui-host>` custom element available
- [ ] `.applyMessages(messages)` to push A2UI JSONL payloads
- [ ] `.reset()` to clear state
- [ ] Web action bridge: replace native iOS/Android bridge with WS gateway call
- [ ] `globalThis.openclawCanvasA2UIAction.postMessage` wired to send actions via WS

#### P5B-02: Implement Inline A2UI in Chat

**As a** user, **I want** agent-generated UI inline in chat **so that** I can interact with rich content.

- [ ] When agent event stream contains A2UI payloads, render `<openclaw-a2ui-host>` inline in the message
- [ ] A2UI components render directly in the DOM (not iframe)
- [ ] Supports all A2UI components: layout (Row, Column, List, Card, Tabs), content (Text, Image, Icon), input (Button, CheckBox, TextField)
- [ ] Data binding and template children work correctly
- [ ] User actions dispatched back to agent via gateway WS

#### P5B-03: Implement Custom App Panel

**As a** user, **I want** to pin canvases as persistent sidebar apps **so that** I can access agent-created tools easily.

- [ ] "Pin as App" action on canvas content
- [ ] Pinned canvas appears in sidebar under Custom Apps
- [ ] Named (agent-provided or user-editable)
- [ ] Agent can push live updates to pinned canvases
- [ ] Reorderable via drag-and-drop
- [ ] Remove from sidebar (canvas still exists in original context)
- [ ] Surface registry: track active surfaces (ID → A2UI state)

#### P5B-04: Implement HTML Canvas Iframe

**As a** user, **I want** agent-generated HTML pages rendered safely **so that** arbitrary HTML doesn't compromise the dashboard.

- [ ] Sandboxed iframe: `<iframe sandbox="allow-scripts">` (no `allow-same-origin`)
- [ ] Canvas host URL derived from gateway config (not hardcoded port)
- [ ] Serves from `http://<host>:<canvasPort>/__openclaw__/canvas/...`
- [ ] postMessage bridge for action callbacks between iframe and dashboard
- [ ] Size auto-detection via ResizeObserver or postMessage
- [ ] Content-Security-Policy headers on iframe

#### P5B-05: Implement Canvas Delivery Pipeline

**As a** developer, **I want** a delivery mechanism for A2UI payloads **so that** agent-generated canvases reach the dashboard.

- [ ] Solve how A2UI payloads reach the dashboard (currently flows through `node.invoke` to native nodes)
- [ ] Options: dashboard registers as virtual node, new WS event type for dashboard, agent canvas tool gains `target: "web"`
- [ ] Selected approach implemented and tested
- [ ] A2UI messages from agent runs trigger inline rendering

---

### Phase 6: Mobile & Polish

> **Goal:** Dedicated mobile pass + accessibility + performance + themes + onboarding

#### P6-01: Implement Mobile Layout

**As a** mobile user, **I want** a touch-friendly layout **so that** I can use the dashboard on my phone.

- [ ] Bottom tab bar replacing sidebar: Chat, Projects, Docs, Jobs, More
- [ ] Single-pane navigation (tap to drill down, back to return)
- [ ] Active tab visually highlighted
- [ ] Unread badge on Chat tab
- [ ] Tab bar always visible (except when keyboard is open)
- [ ] "More" tab: Settings, Passwords, Custom Apps overflow

#### P6-02: Implement Touch Gestures

**As a** mobile user, **I want** touch gestures **so that** navigation feels native.

- [ ] Swipe back to return to previous view
- [ ] Pull-to-refresh on chat list, project views
- [ ] Long press for context menus (chats, tasks, messages)
- [ ] Bottom sheet for modal actions (create task, add comment)
- [ ] Minimum 44x44px tap targets for all interactive elements

#### P6-03: Implement PWA Service Worker

**As a** user, **I want** offline support and push notifications **so that** the dashboard works even without connectivity.

- [ ] Service worker via vite-plugin-pwa
- [ ] Offline caching strategy (read-only mode for cached data)
- [ ] Background sync: queue actions when offline, send on reconnect
- [ ] Push notifications: native notifications when tab is closed
- [ ] Install prompt: banner/button prompting PWA installation

#### P6-04: Implement Accessibility

**As a** user with accessibility needs, **I want** proper ARIA support **so that** I can use the dashboard with assistive technology.

- [ ] ARIA labels on all interactive elements
- [ ] Full keyboard navigation without mouse
- [ ] Screen reader tested (VoiceOver, NVDA)
- [ ] Logical focus flow with visible focus indicators
- [ ] Focus management on route changes and modal open/close
- [ ] Color contrast meets WCAG AA standards

#### P6-05: Implement Performance Optimization

**As a** user, **I want** fast page loads **so that** the dashboard feels responsive.

- [ ] Virtual scrolling for long chat message lists and task lists
- [ ] Lazy module loading (routes and heavy components on demand)
- [ ] Code splitting and tree shaking
- [ ] Image optimization (proper sizing and formats)
- [ ] Core Web Vitals meet "Good" thresholds (LCP, FID, CLS)
- [ ] Bundle size budget defined and enforced

#### P6-06: Implement Themes

**As a** user, **I want** dark and light modes **so that** I can use the dashboard in any lighting condition.

- [ ] Dark mode / light mode / system-auto toggle
- [ ] Accent color customization
- [ ] Tailwind CSS custom properties for theming
- [ ] Theme preference persisted in localStorage
- [ ] Smooth transition between themes

#### P6-07: Implement Onboarding Wizard

**As a** new user, **I want** a guided setup **so that** I can connect to my gateway quickly.

- [ ] First-run wizard: gateway URL entry, token paste, connection test
- [ ] Device pairing flow: show pairing request ID, guide user through CLI approval
- [ ] Optional Discord setup prompt
- [ ] Optional password vault creation
- [ ] Success confirmation with dashboard tour highlights

#### P6-08: Implement Mobile-Specific Adaptations

**As a** mobile user, **I want** optimized layouts per module **so that** each module works well on small screens.

- [ ] Chat: full-screen list view → tap → conversation (no sidebar)
- [ ] Projects: kanban vertical scroll with swipeable columns; card list instead of table
- [ ] Documents: full-screen list → tap to preview (no split pane)
- [ ] Settings: full-screen overlay instead of inline panel
- [ ] Modals: bottom sheet instead of centered dialog
- [ ] Slash commands: full-screen command palette instead of dropdown
- [ ] Drag-and-drop: long press + drag instead of mouse drag

#### P6-09: Implement Error Handling

**As a** user, **I want** graceful error handling **so that** failures don't break the app.

- [ ] Global error boundary with fallback UI
- [ ] Friendly error messages for common failures (connection lost, auth failed, method not found)
- [ ] Error reporting/logging for debugging
- [ ] Toast notifications for transient errors
- [ ] Retry affordances where appropriate

#### P6-10: Implement Ed25519 Device Identity (Production Auth)

**As a** user deploying in production, **I want** secure device identity **so that** my gateway is protected.

- [ ] Generate Ed25519 keypair via WebCrypto API
- [ ] Derive `device.id` from public key fingerprint
- [ ] Store keypair + device ID in IndexedDB (persistent)
- [ ] Sign `connect.challenge` nonce with private key
- [ ] Handle pairing required flow (show request ID, guide through approval)
- [ ] Persist `deviceToken` from `hello-ok` in IndexedDB
- [ ] Requires HTTPS or localhost (secure context for WebCrypto)

---

## 4. Functional Requirements

### Connection & Protocol

| #     | Requirement                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Dashboard connects to OpenClaw Gateway via WebSocket on configurable URL (default `ws://127.0.0.1:18789`)                     |
| FR-02 | First frame must be a `connect` request with `client.id: "openclaw-control-ui"`, `client.mode: "webchat"`, protocol version 3 |
| FR-03 | Dashboard reads `policy.tickIntervalMs` from `hello-ok` dynamically; never hardcodes tick interval                            |
| FR-04 | Connection timeout set to 2x `tickIntervalMs` (miss 2 ticks = connection lost)                                                |
| FR-05 | Reconnection uses exponential backoff: 800ms base, 1.7x multiplier, 15s cap                                                   |
| FR-06 | Dashboard parses `features.methods` from `hello-ok` for runtime feature detection                                             |
| FR-07 | Dashboard checks `features.methods` before enabling UI for optional modules (e.g., PM methods when pm-skill installed)        |
| FR-08 | All mutating WS requests include an `idempotencyKey` for safe retry                                                           |
| FR-09 | Token stored in localStorage; device keypair + token stored in IndexedDB                                                      |
| FR-10 | Dashboard handles `shutdown` event and uses `restartExpectedMs` for reconnection delay                                        |

### Chat

| #     | Requirement                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| FR-11 | Chat supports two-stage response pattern: ack → stream → final                                                        |
| FR-12 | Agent event stream renders thinking blocks, tool calls, tool results, and text deltas                                 |
| FR-13 | Message composer supports SHIFT+ENTER for newline, ENTER to send, file drag-and-drop, clipboard paste                 |
| FR-14 | Slash commands implemented: /new, /status, /stop, /compact, /usage, /reasoning, /verbose, /context, /subagents, /send |
| FR-15 | Chat list shows only group sessions (filtered by `kinds`); cron, webhook, node, sub-agent sessions never shown        |
| FR-16 | "General" chat persists across sessions; created on first connect if missing                                          |
| FR-17 | Session creation uses `sessions.patch` for explicit creation with metadata                                            |
| FR-18 | Session keys follow pattern: `agent:<agentId>:<channel>:group:<id>`                                                   |
| FR-19 | Thread keys follow pattern: `agent:<agentId>:<channel>:group:<parentId>:thread:<threadId>`                            |
| FR-20 | Replies send `replyToMessageId` in `chat.send`; sync as Discord `message_reference`                                   |
| FR-21 | Thread lifecycle: active → archived (auto after 24h inactivity) → locked                                              |
| FR-22 | On reconnect, `chat.history` fills message gaps; messages deduped by ID                                               |
| FR-23 | Thinking level options: off, minimal, low, medium, high, xhigh (NOT off/on/stream)                                    |

### Project Management

| #     | Requirement                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------- |
| FR-24 | PM data stored in local SQLite via pm-skill (not agent tool calls)                              |
| FR-25 | Data hierarchy: Domain → Focus → Project → Task → Task (recursive subtasks)                     |
| FR-26 | Status values: todo, in_progress, review, done, cancelled, archived                             |
| FR-27 | Priority values: low, normal, high, urgent                                                      |
| FR-28 | PM supports cursor-based pagination (default 50, max 200)                                       |
| FR-29 | PM supports full-text search via FTS5 on titles, descriptions, bodies, comments                 |
| FR-30 | PM real-time events: `event:pm` broadcast on all mutations with `stateVersion` tracking         |
| FR-31 | PM context generation: dashboard (~1-2k tokens), domain (~3-5k tokens), project (~5-10k tokens) |
| FR-32 | PM views: dashboard, kanban, list, tree, dependency graph                                       |
| FR-33 | Drag-and-drop for reorder, move between parents, change status (kanban)                         |

### Documents

| #     | Requirement                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------ |
| FR-34 | Documents root: `dashboard.documentsPath` (default `~/Documents`); never exposes `.secrets/`           |
| FR-35 | File operations via SvelteKit server routes with SHA-256 hash-based optimistic concurrency             |
| FR-36 | Supports nested directory navigation with breadcrumb                                                   |
| FR-37 | File preview types: markdown (rendered), code (highlighted), images (displayed), JSON/YAML (formatted) |

### Agent Jobs

| #     | Requirement                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------- |
| FR-38 | Cron job CRUD via `cron.*` methods; enable/disable via `cron.update({ patch: { enabled } })`         |
| FR-39 | Heartbeat config read from `agents.defaults.heartbeat.*` via `config.get`; edited via `config.patch` |
| FR-40 | HEARTBEAT.md read/write via `agents-files.get/set`                                                   |
| FR-41 | Schedule types supported: cron expression, interval, one-shot                                        |

### Passwords

| #     | Requirement                                                                    |
| ----- | ------------------------------------------------------------------------------ |
| FR-42 | Vault uses KeePassXC (KDBX4, AES-256 + Argon2) at `~/.openclaw/passwords.kdbx` |
| FR-43 | All vault operations via server routes shelling out to `keepassxc-cli`         |
| FR-44 | Master password unlock required before accessing secret values                 |
| FR-45 | Session auto-locks after configurable idle timeout                             |
| FR-46 | Secret values never sent to AI model or included in system prompts             |

### Settings

| #     | Requirement                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------- |
| FR-47 | Workspace files managed via `agents-files.*` WS methods (not server routes)                     |
| FR-48 | Config editing uses hash-based optimistic concurrency (`baseHash` from `config.get`)            |
| FR-49 | Discord setup: user creates own Discord Application; dashboard stores `client_id` + `bot_token` |
| FR-50 | Exec approval queue maintained client-side; events: `exec-approval.requested/resolved`          |
| FR-51 | Logs viewer uses cursor-based polling via `logs.tail` (not streaming)                           |

### Canvas / A2UI

| #     | Requirement                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------ |
| FR-52 | A2UI rendered inline via `<openclaw-a2ui-host>` Lit web component (no iframe for A2UI)           |
| FR-53 | HTML canvas rendered in sandboxed iframe with `sandbox="allow-scripts"` (no `allow-same-origin`) |
| FR-54 | Canvas host URL derived from gateway config (not hardcoded)                                      |
| FR-55 | A2UI action bridge wired to send user actions back via gateway WS                                |

### Platform

| #     | Requirement                                                                                  |
| ----- | -------------------------------------------------------------------------------------------- |
| FR-56 | PWA: web app manifest, service worker, offline read-only, push notifications, install prompt |
| FR-57 | Mobile: bottom tab bar, single-pane navigation, 44x44px min tap targets                      |
| FR-58 | Accessibility: ARIA labels, keyboard navigation, screen reader support, WCAG AA contrast     |
| FR-59 | Performance: virtual scrolling, lazy loading, code splitting, Core Web Vitals "Good"         |
| FR-60 | Themes: dark/light/system with accent color customization                                    |

---

## 5. Non-Goals (Explicitly Excluded)

| Feature                             | Reason                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Mobile native app                   | PWA covers mobile needs                                                                |
| Voice/video channels                | Out of scope for v1                                                                    |
| Edit/delete own chat messages       | Not needed for v1                                                                      |
| Calendar view (PM)                  | Not needed for v1                                                                      |
| Keyboard shortcuts                  | Conflicts with slash commands                                                          |
| Export conversations                | Copy button on individual messages is sufficient                                       |
| End-to-end encryption               | Out of scope                                                                           |
| Voice input                         | Deferred — use OS/keyboard voice typing                                                |
| Slack/WhatsApp/Telegram integration | Discord-first; other platforms may follow later via same `channels.status` abstraction |
| Multiple agents in single dashboard | Single agent per gateway instance                                                      |
| Collaborative multi-user editing    | Single-user self-hosted product                                                        |

---

## 6. Design Considerations

### Visual Direction

"Linear meets Discord" — clean, modern, keyboard-friendly with real-time chat dynamics. Dense but not cluttered. Information hierarchy through typography and spacing rather than borders and boxes.

### Responsive-First, Desktop-Primary

All layouts use Tailwind responsive breakpoints and flex/grid from day one. Primary development and testing target through Phases 1-5 is desktop. Phase 6 is the dedicated mobile pass. This is not "bolt mobile on later" — it's structurally responsive from the start, with desktop-first validation of complex layouts (sidebar + main + detail panels, kanban, multi-pane editor).

### Layout Model

- **Desktop:** Persistent sidebar (Chats + Apps) + main content area + optional side panel (threads, task detail)
- **Mobile:** Bottom tab bar + full-screen content + bottom sheet modals

### Interaction Patterns

- Drag-and-drop for reorder, move, and status change (kanban)
- Dark mode (system-aware with manual toggle)
- Toast notifications for transient feedback
- Optimistic updates with rollback on error
- Hash-based concurrency for multi-surface editing (config, files)

---

## 7. Technical Considerations

### Tech Stack

| Component   | Technology                                        |
| ----------- | ------------------------------------------------- |
| Framework   | SvelteKit                                         |
| Styling     | Tailwind CSS                                      |
| Language    | TypeScript (strict mode)                          |
| State       | Svelte writable stores + custom WS event stores   |
| Markdown    | unified/remark/rehype + KaTeX + Mermaid + Shiki   |
| PWA         | vite-plugin-pwa                                   |
| Code editor | CodeMirror (for document editing, config editing) |
| A2UI        | Lit web component (imported bundle)               |

### Gateway Protocol Constraints

- `client.id` must be `"openclaw-control-ui"` (gateway validates against enum)
- `client.mode` must be `"webchat"`
- Protocol version: 3
- Events are NOT replayed — client must detect gaps and refresh
- `stateVersion` is per-domain: `{ presence: N, health: N }`
- `tickIntervalMs` from `hello-ok` policy (typically 30s; read dynamically, never hardcode)
- `features.methods` from `hello-ok` is the source of truth for available methods

### Security Model

- Dev auth: `gateway.controlUi.allowInsecureAuth: true` for token-only (no device identity)
- Production auth: Ed25519 keypair via WebCrypto + challenge signing
- Device tokens persisted in IndexedDB
- KeePassXC for credential storage (encrypted at rest, server-side only)
- A2UI is declarative (safe to render inline); HTML canvas requires iframe sandbox
- `.secrets/` directory never exposed via file API
- Config writes use hash-based concurrency to prevent clobbering

### Reactive State Constraint

Gateway state flows one direction: gateway → stores → UI. Svelte `$effect` blocks must never write back to the same state they read. Connection and snapshot stores export `Readable` stores; only gateway internals may write to them. Components derive display state with `$derived`, never with read-write `$effect` loops.

---

## 8. Success Metrics

| Metric                   | Target                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| All 6 modules functional | Chat, PM, Docs, Jobs, Passwords, Settings fully operational        |
| Chat message latency     | First token streams to UI within 200ms of gateway event            |
| Reconnection reliability | Zero message loss across 100 consecutive reconnect cycles          |
| PM operation latency     | CRUD operations complete in <200ms (client to server to UI update) |
| PWA Lighthouse score     | >= 90                                                              |
| Mobile usability         | Functional on 375px-wide screens; 44px min tap targets             |
| Accessibility            | WCAG AA compliance; keyboard-navigable                             |
| Core Web Vitals          | LCP < 2.5s, FID < 100ms, CLS < 0.1                                 |
| Bundle size              | Initial load < 200KB gzipped (lazy-load heavy modules)             |
| Discord sync coverage    | Chats, threads, replies, messages sync bidirectionally             |

---

## 9. Open Questions

| #    | Question                                                                                    | Blocking?    | Status                                                                                       |
| ---- | ------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| OQ-1 | How do A2UI payloads reach the dashboard? (currently via `node.invoke` to native nodes)     | Phase 5B     | Three options identified: virtual node, new WS event type, or `target: "web"` on canvas tool |
| OQ-2 | Can the A2UI bundle be imported as an ES module outside the A2UI host page context?         | Phase 5B     | Untested — registers `<openclaw-a2ui-host>` as custom element on load                        |
| OQ-3 | Can TypeBox schemas be imported from the OpenClaw package for type safety?                  | Nice-to-have | Untested                                                                                     |
| OQ-4 | What is the exact `parentSessionId` format for threads? (UUID vs full key string)           | Phase 2      | Needs gateway verification                                                                   |
| OQ-5 | Does the gateway broadcast file change events when workspace files are modified externally? | Phase 5A     | Unknown — may need to poll `agents-files.list`                                               |
| OQ-6 | Visual design system specifications (component library, spacing, typography)                | Phase 2+     | "Linear meets Discord" direction, no detailed specs yet                                      |
| OQ-7 | Custom app persistence model — what gets persisted when a canvas is pinned?                 | Phase 5B     | Surface ID + A2UI JSONL state? URL for HTML canvas?                                          |

---

## Appendix A: Phase Dependency Chain

```
Phase 1: Core Infrastructure
    ├── blocks everything
    │
    ▼
Phase 2: Chat Module
    ├── validates streaming, reconnection, rich rendering
    │
    ▼
Phase 3A: Documents ──┐
Phase 3B: Agent Jobs ──┼── parallel, simpler CRUD modules
Phase 3C: Passwords ──┘
    │
    ▼
Phase 4A: PM Skill Backend ──► Phase 4B: PM Dashboard UI
    │
    ▼
Phase 5A: Settings ──┐
Phase 5B: Canvas/A2UI ┘── parallel, polish phase
    │
    ▼
Phase 6: Mobile & Polish
```

## Appendix B: Story Count Summary

| Phase                        | Stories | Description                                                                                                  |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| Phase 1: Core Infrastructure | 12      | SvelteKit scaffold, WS client, connection, app shell, PWA                                                    |
| Phase 2: Chat Module         | 21      | Stream manager, stores, rendering, threads, replies, Discord sync                                            |
| Phase 3A: Documents          | 5       | Server routes, browser, editor, create/upload, bulk ops                                                      |
| Phase 3B: Agent Jobs         | 6       | Cron CRUD, run history, heartbeat config, events                                                             |
| Phase 3C: Passwords          | 7       | Server routes, vault creation, UI, CRUD, unlock, migration, security                                         |
| Phase 4A: PM Skill Backend   | 8       | SQLite layer, FTS, WS methods, validation, events, context, stats, bulk                                      |
| Phase 4B: PM Dashboard UI    | 12      | Stores, dashboard, navigation, list, kanban, project/task detail, AI context, search                         |
| Phase 5A: Settings           | 11      | Workspace, info, skills, Discord, devices, approvals, config, logs, models, prefs, about                     |
| Phase 5B: Canvas/A2UI        | 5       | A2UI component, inline rendering, custom apps, HTML iframe, delivery                                         |
| Phase 6: Mobile & Polish     | 10      | Mobile layout, gestures, PWA, accessibility, performance, themes, onboarding, adaptations, errors, prod auth |
| **Total**                    | **97**  |                                                                                                              |
