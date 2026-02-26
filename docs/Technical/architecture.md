# Architecture overview

This document describes the high-level architecture of Falcon Dash, a SvelteKit web dashboard for the OpenClaw AI Agent platform.

See also:

- [Gateway protocol](gateway-protocol.md) -- WebSocket protocol v3 internals
- [Stores](stores.md) -- Svelte store layer
- [Components](components.md) -- UI component architecture
- [Gateway plugin](gateway-plugin.md) -- `falcon-dash-plugin/` channel and canvas bridge
- [PM pipeline](pm-pipeline.md) -- project management system
- [fredbot integration](fredbot-integration.md) -- deployment infrastructure
- [Deployment](deployment.md) -- build, Docker, reverse proxy setup

## System overview

```
Browser (Falcon Dash SvelteKit app)
   |
   |  HTTP (SvelteKit API routes)      WebSocket (protocol v3)
   |  /api/pm/*, /api/agents/*, etc.   /ws (proxied in dev)
   v                                    v
+--SvelteKit Server--+         +--OpenClaw Gateway--+
|  better-sqlite3    |         |  Session mgmt      |
|  PM CRUD           |         |  Auth / Pairing     |
|  File ops          |         |  Event broadcast    |
|  Password vault    |         |  Canvas pipeline    |
+--------------------+         +----+----------------+
                                    |
                                    v
                             +--Agent Process--+
                             |  Claude Code    |
                             |  Tool execution |
                             |  Workspace      |
                             +-----------------+
```

The browser client communicates over two channels:

1. **HTTP** -- SvelteKit API routes for server-side operations (PM database, file system, password vault, agent config CRUD). These endpoints run inside the SvelteKit Node.js process and access local resources directly.

2. **WebSocket** -- A persistent connection to the OpenClaw Gateway for real-time operations (chat, sessions, presence, health, canvas, exec approvals). In development, Vite proxies `/ws` to `GATEWAY_URL` (default `ws://127.0.0.1:18789`). In production, a reverse proxy terminates TLS and forwards `wss://` connections.

The gateway manages agent processes, routes messages between operators and agents, and broadcasts events. The `falcon-dash-plugin` registers a custom channel (`falcon-dash`) and a canvas bridge so agents can present canvas surfaces to the dashboard.

## Directory structure

```
falcon-dash/
├── src/
│   ├── routes/                    # SvelteKit pages and API routes
│   │   ├── +layout.svelte        # Root layout: auth gating, connection bootstrap
│   │   ├── +page.svelte          # Chat view (session active) or welcome
│   │   ├── documents/            # File browser + editor
│   │   ├── jobs/                 # Cron job management
│   │   ├── heartbeat/            # System health monitoring
│   │   ├── passwords/            # Password vault (KeePassXC)
│   │   ├── projects/             # PM dashboard
│   │   ├── settings/             # Settings page
│   │   └── api/                  # Server-side API routes
│   │       ├── agents/           # Agent CRUD
│   │       ├── pm/               # PM REST API
│   │       ├── files/            # File CRUD
│   │       ├── files-bulk/       # Bulk file operations
│   │       ├── gateway-config/   # Gateway config proxy
│   │       └── passwords/        # Vault management
│   └── lib/
│       ├── gateway/              # WebSocket client (6 core classes)
│       │   ├── connection.ts     # GatewayConnection
│       │   ├── correlator.ts     # RequestCorrelator
│       │   ├── event-bus.ts      # EventBus
│       │   ├── snapshot-store.ts # SnapshotStore
│       │   ├── reconnector.ts    # Reconnector
│       │   ├── stream.ts         # AgentStreamManager
│       │   ├── diagnostic-log.ts # DiagnosticLog
│       │   ├── device-identity.ts# DeviceIdentity
│       │   └── types.ts          # Frame types, connection state, hello-ok payload
│       ├── stores/               # Svelte stores (reactive state)
│       │   ├── gateway.ts        # Singleton wiring, connectToGateway(), call()
│       │   ├── chat.ts           # createChatSession() factory
│       │   ├── sessions.ts       # Session lifecycle
│       │   ├── canvas.ts         # CanvasStore
│       │   └── ...               # Feature, PM, utility stores
│       ├── components/           # Svelte 5 UI components
│       │   ├── AppShell.svelte   # Desktop layout
│       │   ├── ChatView.svelte   # Chat message view
│       │   ├── mobile/           # Mobile-specific shell and pages
│       │   ├── settings/         # Settings tabs
│       │   ├── canvas/           # Canvas rendering
│       │   ├── pm/               # PM list, detail, utils
│       │   └── ai/               # AI display adapters (reasoning, tools, etc.)
│       ├── server/               # Server-only code
│       │   ├── pm/               # PM database, context generation, scheduling
│       │   ├── agents/           # Agent CRUD against openclaw.json
│       │   └── ...               # Files, passwords, config
│       ├── chat/                 # Markdown pipeline, Shiki, slash commands
│       ├── canvas/               # A2UI bridge, canvas delivery
│       ├── performance/          # Virtual scroll
│       ├── pwa/                  # Service worker registration
│       └── theme/                # Theme manager
├── falcon-dash-plugin/           # OpenClaw gateway plugin
│   └── src/
│       ├── index.ts              # Plugin entry (activate)
│       ├── channel.ts            # falcon-dash channel registration
│       ├── canvas-bridge.ts      # Canvas operator bridge
│       └── context.ts            # Agent context injection
└── docs/                         # Project documentation
```

## Request flow

A typical user action (sending a chat message) traverses the system as follows:

```
1. User types message in MessageComposer
2. ChatView calls chatSession.send(message)
3. chat.ts store calls call<T>('chat.send', { sessionKey, message, ... })
4. gateway.ts: call() generates ID via correlator.nextId()
5. gateway.ts: correlator.track(id) creates a Promise
6. connection.send() serializes { type: 'req', id, method: 'chat.send', params }
7. WebSocket delivers JSON frame to gateway
8. Gateway routes to agent, returns { runId, status: 'started' }
9. Response frame arrives: correlator resolves the Promise
10. streamManager.onAck(runId) creates the run tracker
11. Gateway streams agent events: { type: 'event', event: 'agent', payload: { stream, data } }
12. EventBus dispatches to AgentStreamManager
13. AgentStreamManager emits delta/toolCall/toolResult/messageEnd events
14. chat.ts updates _messages writable store
15. ChatView reactively re-renders
```

## Auth flow

Authentication is handled at the root layout (`src/routes/+layout.svelte`):

```
1. Page loads → fetch('/api/gateway-config')
   - Server reads ~/.openclaw/openclaw.json for token + URL
   - Sets gatewayToken and gatewayUrl stores

2. If no token → render TokenEntry for manual entry
   If token exists → render AppShell (desktop) or MobileShell (mobile)

3. connectToGateway(url, token) called:
   a. ensureDeviceIdentity() — load or generate Ed25519 keypair from IndexedDB
   b. exportPublicKeyBase64() — encode public key for wire format
   c. connection.connect(config) — open WebSocket

4. Gateway sends connect.challenge event with { nonce, ts }
   - State transitions: CONNECTING → AUTHENTICATING

5. Client builds connect frame:
   - Signs challenge: buildSignMessage() + signMessage() with Ed25519 private key
   - Includes: client.id='openclaw-control-ui', mode='ui', role='operator'
   - Declares scopes, caps, commands
   - Uses frame ID '__connect' (non-numeric to avoid correlator collision)

6. Gateway validates → responds with hello-ok or:
   - Close code 1008 → PAIRING_REQUIRED (retries up to 10 times)
   - Error response → AUTH_FAILED

7. hello-ok received → onHelloOk callback fires:
   a. snapshot.hydrate(helloOk) — populate presence, health, session defaults
   b. snapshot.subscribe(eventBus) — wire incremental updates
   c. canvasStore.subscribe(eventBus, call)
   d. canvas.bridge.register RPC — register as virtual canvas node
   e. reconnector.onConnected(tickIntervalMs)
   f. State: CONNECTED → READY

8. Layout reacts to READY:
   - restoreActiveSession()
   - subscribeToEvents() (sessions, notifications, approvals)
   - ensureDefaultChannel() per agent
```

## Data flow

Data flows through three phases:

### Initial hydration (hello-ok)

When the connection reaches READY, the hello-ok payload contains a snapshot:

- `snapshot.presence` -- list of connected operators/devices
- `snapshot.health` -- agent health data
- `snapshot.stateVersion` -- per-domain version counters
- `snapshot.sessionDefaults` -- model, thinkingLevel, defaultAgentId
- `features.methods` -- available gateway methods
- `policy` -- maxPayload, maxBufferedBytes, tickIntervalMs

`SnapshotStore.hydrate()` populates writable stores from this payload.

### Incremental updates (EventBus)

After hydration, `SnapshotStore.subscribe(eventBus)` registers handlers for `presence` and `health` events. Other stores subscribe independently:

- `sessions.ts` listens for `session` and `chat.message` events
- `chat.ts` listens for `agent`, `chat`, `chat.message`, `chat.message.update`, `chat.reaction` events
- `canvas.ts` listens for `node.invoke.request`, `canvas.deliver`, `canvas.message` events
- `exec-approvals.ts` listens for `exec.approval.requested` events
- `notifications.ts` listens for `notification.*` events

### Reactive rendering (stores to components)

Svelte stores (`writable`/`readable`/`derived`) drive component rendering. Components subscribe to stores and re-render when values change. The `$state` and `$derived` runes (Svelte 5) handle local component state.

## Server-side overview

The SvelteKit server process handles operations that require local filesystem or database access:

| Subsystem          | Storage                                               | Key files                        |
| ------------------ | ----------------------------------------------------- | -------------------------------- |
| Project management | better-sqlite3 at `~/.openclaw/data/pm.db` (WAL mode) | `src/lib/server/pm/`             |
| Agent CRUD         | `~/.openclaw/openclaw.json`                           | `src/lib/server/agents/`         |
| File browser       | Filesystem (agent workspaces)                         | `src/lib/server/files-config.ts` |
| Password vault     | KeePassXC database                                    | `src/lib/server/keepassxc.ts`    |
| Gateway config     | `~/.openclaw/openclaw.json`                           | `src/routes/api/gateway-config/` |

The PM subsystem also generates context files (`PROJECTS.md`, per-project markdown, `PM-API.md`) and symlinks them into agent workspaces so agents can read PM data. See [PM pipeline](pm-pipeline.md) for details.
