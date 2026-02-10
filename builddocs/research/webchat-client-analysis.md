# OpenClaw Webchat Client Analysis

## Purpose
Reverse-engineered OpenClaw's built-in Control UI webchat client to extract patterns, protocol details, and reusable code for building falcon-dash's WebSocket client.

## Source Locations

### OpenClaw Package Root
```
/home/fredbot/.local/share/pnpm/global/5/.pnpm/openclaw@2026.1.30_.../node_modules/openclaw/
```

### Key Server-Side Files (compiled JS)
| File | Purpose |
|------|---------|
| `dist/gateway/client.js` | Node.js GatewayClient (WS client for backend use) |
| `dist/gateway/auth.js` | Auth logic (token, password, Tailscale, device auth) |
| `dist/gateway/server-chat.js` | Chat event handler (delta/final/error broadcasting) |
| `dist/gateway/server-bridge-methods-chat.js` | Server-side handlers for chat.send, chat.history, chat.abort, chat.inject |
| `dist/gateway/control-ui.js` | HTTP server for the Control UI SPA |
| `dist/gateway/control-ui-shared.js` | Shared utils (avatar URLs, base path) |
| `dist/gateway/device-auth.js` | Device auth payload builder |
| `dist/gateway/protocol/index.js` | Protocol validators (AJV-compiled) |
| `dist/gateway/protocol/client-info.js` | Client IDs and modes enum |
| `dist/gateway/protocol/schema/*.js` | TypeBox schema definitions |

### Key Frontend Source Files (from sourcemap)
The Control UI is a **Lit Element** SPA bundled into `dist/control-ui/assets/index-CXUONUC9.js`. Source files extracted from the sourcemap:

| Source Path | Purpose |
|-------------|---------|
| `ui/src/ui/gateway.ts` | **`GatewayBrowserClient`** — THE browser WS client class |
| `ui/src/ui/app-gateway.ts` | Gateway connection management, event routing |
| `ui/src/ui/controllers/chat.ts` | Chat state management (send, history, abort, event handling) |
| `ui/src/ui/controllers/sessions.ts` | Session list/patch/delete operations |
| `ui/src/ui/app-chat.ts` | Chat UI orchestration (queuing, stop commands, avatar) |
| `ui/src/ui/app-tool-stream.ts` | Tool call streaming display |
| `ui/src/ui/app-lifecycle.ts` | Component lifecycle (connect on mount) |
| `ui/src/ui/app.ts` | Main `<openclaw-app>` Lit Element |
| `ui/src/ui/device-identity.ts` | Ed25519 keypair generation + localStorage persistence |
| `ui/src/ui/device-auth.ts` | Device auth token storage (localStorage) |
| `ui/src/ui/chat/message-extract.ts` | Text extraction from message content blocks |
| `ui/src/ui/chat/message-normalizer.ts` | Message normalization for rendering |

### Protocol Schema Files
| File | Schemas Defined |
|------|----------------|
| `schema/frames.js` | `RequestFrame`, `ResponseFrame`, `EventFrame`, `ConnectParams`, `HelloOk`, `GatewayFrame` |
| `schema/agent.js` | `AgentEvent`, `SendParams`, `AgentParams`, `ChatSendParams` |
| `schema/logs-chat.js` | `ChatHistoryParams`, `ChatSendParams`, `ChatAbortParams`, `ChatInjectParams`, `ChatEvent` |
| `schema/sessions.js` | `SessionsList`, `SessionsPatch`, `SessionsReset`, `SessionsDelete`, etc. |
| `schema/snapshot.js` | `Snapshot`, `PresenceEntry`, `StateVersion`, `SessionDefaults` |
| `schema/primitives.js` | `NonEmptyString`, `SessionLabelString`, `GatewayClientId`, `GatewayClientMode` |

---

## Protocol Details

### Protocol Version
**Current: 3** (both `minProtocol` and `maxProtocol` set to 3)

### Frame Types
Three frame types, discriminated by `type` field:

```typescript
// Request (client → server)
type RequestFrame = {
  type: "req";
  id: string;       // UUID, used for correlating response
  method: string;    // e.g., "connect", "chat.send", "sessions.list"
  params?: unknown;
};

// Response (server → client)
type ResponseFrame = {
  type: "res";
  id: string;        // matches request id
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
};

// Event (server → client, push)
type EventFrame = {
  type: "event";
  event: string;     // e.g., "connect.challenge", "agent", "chat", "tick", "presence"
  payload?: unknown;
  seq?: number;       // monotonic sequence number
  stateVersion?: { presence: number; health: number };
};
```

### Connection Flow

```
1. Client opens WebSocket to gateway URL
2. Server sends:  { type: "event", event: "connect.challenge", payload: { nonce: "..." } }
3. Client waits 750ms (queueConnect timer), then sends:
   { type: "req", id: "...", method: "connect", params: ConnectParams }
4. Server responds with HelloOk:
   { type: "res", id: "...", ok: true, payload: { type: "hello-ok", protocol: 3, ... } }
5. Connection established — client can now send requests and receive events
```

#### ConnectParams Structure
```typescript
{
  minProtocol: 3,
  maxProtocol: 3,
  client: {
    id: "openclaw-control-ui",    // or "webchat", "cli", etc.
    version: "dev",
    platform: navigator.platform,
    mode: "webchat",              // "webchat" | "cli" | "ui" | "backend" | "node"
    instanceId?: string,
  },
  role: "operator",
  scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
  device?: {  // Ed25519 device identity (optional, requires secure context)
    id: string,         // SHA-256 hash of public key
    publicKey: string,  // base64url-encoded
    signature: string,  // base64url-encoded Ed25519 signature
    signedAt: number,   // timestamp ms
    nonce?: string,     // from connect.challenge
  },
  caps: [],
  auth?: {
    token?: string,     // gateway token
    password?: string,  // gateway password
  },
  userAgent: navigator.userAgent,
  locale: navigator.language,
}
```

#### Device Auth Payload (signed string)
```
"v2|{deviceId}|{clientId}|{clientMode}|{role}|{scopes}|{signedAtMs}|{token}|{nonce}"
```
Uses Ed25519 (`@noble/ed25519`) for signing. Keys stored in localStorage.

#### HelloOk Response
```typescript
{
  type: "hello-ok",
  protocol: 3,
  server: { version, commit?, host?, connId },
  features: { methods: string[], events: string[] },
  snapshot: {
    presence: PresenceEntry[],
    health: HealthSnapshot,
    stateVersion: { presence: number, health: number },
    uptimeMs: number,
    sessionDefaults?: { defaultAgentId, mainKey, mainSessionKey, scope? }
  },
  auth?: { deviceToken, role, scopes, issuedAtMs? },
  policy: { maxPayload, maxBufferedBytes, tickIntervalMs },
}
```

### Authentication Methods
1. **Token auth** — `OPENCLAW_GATEWAY_TOKEN` env var or config
2. **Password auth** — `gateway.auth.mode: "password"` 
3. **Device auth** — Ed25519 keypair, browser generates and stores in localStorage
4. **Tailscale auth** — Automatic via Tailscale Serve headers

The browser client attempts device auth first (stored token), falls back to shared token.

### Reconnection
- Exponential backoff: starts at 800ms, multiplied by 1.7 each attempt, max 15s
- On successful connect: backoff resets to 800ms
- On close: flush all pending promises with error, schedule reconnect
- **No resume** — after reconnect, chat state is reset and history is reloaded

### Keepalive / Tick
- Server sends `tick` events at `tickIntervalMs` (default 30s)
- Node.js client monitors: if gap > 2× tickInterval, closes with code 4000
- Browser client does NOT implement tick monitoring (server handles it)

### Sequence Gap Detection
- Events have monotonic `seq` numbers
- Client tracks `lastSeq`; if `received > lastSeq + 1`, fires `onGap` callback
- No automatic recovery — just logs warning

---

## Chat Protocol

### Methods

#### `chat.history`
```typescript
// Request
{ sessionKey: string, limit?: number }  // max 200, default 200

// Response
{ 
  sessionKey: string,
  sessionId: string,
  messages: Array<{
    role: "user" | "assistant" | "system",
    content: Array<{ type: "text", text: string } | { type: "image", source: {...} }>,
    timestamp: number,
    stopReason?: string,
    usage?: { input: number, output: number, totalTokens: number }
  }>,
  thinkingLevel?: string
}
```

#### `chat.send`
```typescript
// Request
{
  sessionKey: string,
  message: string,
  thinking?: string,
  deliver?: boolean,        // false for webchat (don't forward to external channels)
  attachments?: Array<{
    type: "image",
    mimeType: string,
    content: string,        // base64
  }>,
  timeoutMs?: number,
  idempotencyKey: string,   // UUID, doubles as clientRunId
}

// Response (immediate ack)
{ runId: string, status: "started" }

// Then streaming via events (see below)
```

#### `chat.abort`
```typescript
// Request
{ sessionKey: string, runId?: string }

// Response  
{ ok: boolean, aborted: boolean, runIds: string[] }
```

#### `chat.inject`
```typescript
// Request (inject a message into transcript without running agent)
{ sessionKey: string, message: string, label?: string }

// Response
{ ok: boolean, messageId: string }
```

### Chat Event Streaming

After `chat.send`, the server broadcasts events:

```typescript
// Event: { type: "event", event: "chat", payload: ChatEventPayload }
type ChatEventPayload = {
  runId: string,           // matches idempotencyKey from chat.send
  sessionKey: string,
  seq: number,
  state: "delta" | "final" | "aborted" | "error",
  message?: {
    role: "assistant",
    content: [{ type: "text", text: string }],
    timestamp: number,
  },
  errorMessage?: string,
};
```

**Delta throttling:** Server throttles delta events to every 150ms. The `text` field in deltas contains the **full accumulated text so far** (not incremental).

**Client-side delta handling:** The client compares `next.length >= current.length` to avoid regression (out-of-order deltas).

### Agent Events

```typescript
// Event: { type: "event", event: "agent", payload: AgentEventPayload }
type AgentEventPayload = {
  runId: string,
  seq: number,          // per-run sequence
  stream: string,       // "assistant" | "tool" | "lifecycle" | "error" | "compaction"
  ts: number,
  sessionKey?: string,
  data: Record<string, unknown>,
};
```

Key lifecycle phases: `"end"`, `"error"`
Tool events include `toolCallId`, `name`, `args`, `output` fields.

---

## Client Architecture Patterns

### `GatewayBrowserClient` (key class)
```typescript
class GatewayBrowserClient {
  // State
  private ws: WebSocket | null;
  private pending: Map<string, { resolve, reject }>;
  private closed: boolean;
  private lastSeq: number | null;
  private connectNonce: string | null;
  private connectSent: boolean;
  private backoffMs: number;

  // Core API
  start(): void;
  stop(): void;
  get connected(): boolean;
  request<T>(method: string, params?: unknown): Promise<T>;
  
  // Internal
  private connect(): void;
  private sendConnect(): Promise<void>;
  private handleMessage(raw: string): void;
  private queueConnect(): void;
  private scheduleReconnect(): void;
  private flushPending(err: Error): void;
}
```

### State Management Pattern
The Control UI uses a **controller pattern** with mutable state objects:
- `ChatState` — chat messages, loading state, stream, run tracking
- `SessionsState` — session list, filters
- Controllers are pure functions that mutate state: `loadChatHistory(state)`, `sendChatMessage(state, msg)`
- The Lit Element re-renders on `@state()` property changes

### Chat Message Queue
When a message is sent while another is in-flight, messages are queued:
```typescript
type ChatQueueItem = {
  id: string;
  text: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  refreshSessions?: boolean;
};
```
The queue is flushed when the current run completes (on "final"/"error"/"aborted" events).

### Tool Stream Display
Tool calls are tracked separately from chat messages:
- `toolStreamById: Map<string, ToolStreamEntry>` — indexed by toolCallId
- `toolStreamOrder: string[]` — display order
- Throttled sync (80ms) to avoid excessive re-renders
- Limit of 50 tool entries
- Tool output truncated at 120K chars

### Session Key Resolution
The client resolves session keys from HelloOk snapshot defaults:
```typescript
// Default session key comes from snapshot.sessionDefaults.mainSessionKey
// Aliases like "main", "agent:{agentId}:main" resolve to the canonical key
```

---

## What falcon-dash Needs vs What Exists

### Can Directly Reuse
1. **Protocol frame types** — RequestFrame, ResponseFrame, EventFrame
2. **Connection flow** — connect.challenge → connect → hello-ok
3. **Chat protocol** — chat.send, chat.history, chat.abort, chat.inject
4. **Chat event handling** — delta/final/error/aborted state machine
5. **Session operations** — sessions.list, sessions.patch, sessions.delete
6. **Agent event structure** — tool stream, lifecycle phases
7. **Message content format** — `{ role, content: [{ type, text }], timestamp }`

### Must Adapt
1. **Device identity** — OpenClaw uses Ed25519 via `@noble/ed25519`; falcon-dash should use same approach but needs React integration, not Lit
2. **Auth flow** — falcon-dash connects through fredbot-hosting proxy; may need different auth strategy
3. **Multi-agent routing** — falcon-dash serves multiple customers; needs customer-level routing
4. **Reconnection** — may want more aggressive reconnection with session resume
5. **State management** — OpenClaw uses Lit's reactive state; falcon-dash uses React (useState/useReducer/Zustand)

### falcon-dash Needs That Don't Exist in OpenClaw Client
1. **Multi-instance management** — switching between different gateway URLs/bots
2. **Customer authentication** — Microsoft OAuth → customer portal → agent server
3. **Admin dashboard** — not just chat, but monitoring multiple agents
4. **Historical search** — searching across sessions
5. **Notification system** — push notifications for agent events

---

## Recommendation: Extract and Adapt

**Recommendation: Build a new TypeScript WS client library inspired by `GatewayBrowserClient`, not a copy.**

### Why Not Copy Directly
1. OpenClaw's client is tightly coupled to Lit Element patterns (mutable state, `@state()` decorators)
2. Device identity uses `@noble/ed25519` which is fine, but the storage layer assumes single-gateway localStorage
3. The control UI mixes concerns (chat + config + logs + cron + nodes in one component)

### What to Extract
1. **Protocol types** — Create a `gateway-protocol.ts` with TypeScript types matching the schemas
2. **Connection state machine** — The connect.challenge → connect → hello-ok flow
3. **Request/response correlation** — The `pending` Map pattern with UUID-keyed promises
4. **Chat event state machine** — The delta → final/error/aborted handling
5. **Backoff logic** — Exponential reconnection with 800ms base, 1.7× multiplier, 15s cap
6. **Device auth payload building** — The `buildDeviceAuthPayload` function

### Suggested Architecture for falcon-dash
```
src/lib/gateway/
├── types.ts              # Protocol frame types (from schema analysis)
├── client.ts             # GatewayClient class (adapted from GatewayBrowserClient)
├── auth.ts               # Device identity + auth token management  
├── chat.ts               # Chat state machine (delta/final/error handling)
├── events.ts             # Event routing and subscription
└── hooks/
    ├── useGateway.ts      # React hook for gateway connection
    ├── useChat.ts         # React hook for chat state
    └── useSessions.ts     # React hook for session management
```

### Key Design Differences for falcon-dash
1. **React hooks** instead of Lit controllers
2. **Zustand/Jotai store** instead of mutable state objects
3. **Multi-gateway support** — store per-gateway state indexed by URL
4. **Customer context** — route through fredbot-hosting proxy
5. **Separate concerns** — chat, sessions, config in separate components/stores

---

## Protocol Method Reference

### Chat Methods
| Method | Params | Response |
|--------|--------|----------|
| `chat.send` | `{ sessionKey, message, deliver?, attachments?, idempotencyKey }` | `{ runId, status }` |
| `chat.history` | `{ sessionKey, limit? }` | `{ messages[], thinkingLevel? }` |
| `chat.abort` | `{ sessionKey, runId? }` | `{ aborted, runIds[] }` |
| `chat.inject` | `{ sessionKey, message, label? }` | `{ ok, messageId }` |

### Session Methods
| Method | Params | Response |
|--------|--------|----------|
| `sessions.list` | `{ limit?, activeMinutes?, includeGlobal?, includeUnknown? }` | `{ sessions[] }` |
| `sessions.preview` | `{ keys[], limit?, maxChars? }` | `{ previews[] }` |
| `sessions.resolve` | `{ key?, sessionId?, label? }` | session entry |
| `sessions.patch` | `{ key, label?, thinkingLevel?, model?, ... }` | `{}` |
| `sessions.reset` | `{ key }` | `{}` |
| `sessions.delete` | `{ key, deleteTranscript? }` | `{}` |
| `sessions.compact` | `{ key, maxLines? }` | `{}` |

### System Methods
| Method | Params |
|--------|--------|
| `connect` | ConnectParams (see above) |
| `agents.list` | `{}` |
| `agent.identity` | `{ agentId?, sessionKey? }` |
| `config.get` | `{ path? }` |
| `config.set` | `{ path, value }` |
| `cron.list` | `{}` |
| `nodes.list` | `{}` |
| `logs.tail` | `{ cursor?, limit?, maxBytes? }` |

### Event Types
| Event | Payload |
|-------|---------|
| `connect.challenge` | `{ nonce }` |
| `tick` | `{ ts }` |
| `agent` | AgentEventPayload |
| `chat` | ChatEventPayload |
| `presence` | `{ presence: PresenceEntry[] }` |
| `cron` | cron state update |
| `shutdown` | `{ reason, restartExpectedMs? }` |
| `exec.approval.requested` | approval request |
| `exec.approval.resolved` | approval resolution |
| `device.pair.requested` | device pairing |
| `device.pair.resolved` | pairing resolution |

---

*Analysis completed: 2026-02-07*
