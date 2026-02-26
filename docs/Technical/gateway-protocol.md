# Gateway protocol

This document covers the OpenClaw Gateway protocol v3 as implemented by Falcon Dash. The client-side implementation lives in `src/lib/gateway/`.

See also:

- [Architecture overview](architecture.md) -- system-level context
- [Stores](stores.md) -- how gateway classes are wired into Svelte stores
- [Gateway plugin](gateway-plugin.md) -- server-side plugin that extends gateway methods

## Connection lifecycle

### URL and proxy

- **Default URL:** `ws://127.0.0.1:18789`
- **Dev proxy:** Vite proxies `/ws` to `GATEWAY_URL` so the browser connects to the same origin
- **Production:** set `ORIGIN=https://your-domain.com` and the client derives `wss://` URLs. A reverse proxy (Caddy, nginx) terminates TLS and forwards to the gateway

### Handshake sequence

```
Browser                          Gateway
   |                                |
   |--- WebSocket open ----------->|
   |                                |
   |<-- event: connect.challenge --|  { nonce, ts }
   |                                |
   |--- req: connect (id=__connect) -->|
   |    { token, device, scopes,    |
   |      caps, commands, client }  |
   |                                |
   |<-- res: __connect (hello-ok) --|  { snapshot, policy, features, auth }
   |                                |
   |    State: READY                |
   |                                |
   |<-- event: tick --------------|  (every tickIntervalMs)
   |<-- event: agent ------------|  (streaming responses)
   |<-- event: presence ----------|  (join/leave)
   |                                |
```

### Connection states

Defined in `src/lib/gateway/types.ts`:

```typescript
type ConnectionState =
	| 'DISCONNECTED'
	| 'CONNECTING'
	| 'AUTHENTICATING'
	| 'CONNECTED'
	| 'PAIRING_REQUIRED'
	| 'AUTH_FAILED'
	| 'READY'
	| 'RECONNECTING';
```

State transitions:

- `DISCONNECTED` -- initial state, or after explicit disconnect
- `CONNECTING` -- WebSocket opening
- `AUTHENTICATING` -- challenge received, building connect frame
- `CONNECTED` -- hello-ok received, hydrating snapshot (brief intermediate state)
- `READY` -- fully connected, stores hydrated, events flowing
- `AUTH_FAILED` -- connect response was not ok (bad token)
- `PAIRING_REQUIRED` -- gateway closed with code 1008 (device not yet approved)
- `RECONNECTING` -- lost connection, backoff timer active

## Frame format

All frames are JSON-serialized over WebSocket text messages.

### Request frame

```typescript
interface RequestFrame {
	type: 'req';
	id: string; // monotonic counter from RequestCorrelator
	method: string; // e.g. 'chat.send', 'sessions.list'
	params?: Record<string, unknown>;
}
```

Example:

```json
{
	"type": "req",
	"id": "7",
	"method": "chat.send",
	"params": {
		"sessionKey": "agent:default:falcon-dash:dm:fd-chat-a1b2c3d4",
		"message": "Hello",
		"idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
	}
}
```

### Response frame

```typescript
interface ResponseFrame {
	type: 'res';
	id: string; // matches the request ID
	ok: boolean;
	payload?: Record<string, unknown>;
	error?: {
		code: string;
		message: string;
		details?: unknown;
		retryable?: boolean;
		retryAfterMs?: number;
	};
}
```

### Event frame

```typescript
interface EventFrame {
	type: 'event';
	event: string; // e.g. 'agent', 'presence', 'tick', 'chat.message'
	payload: Record<string, unknown>;
	seq?: number; // sequence number for ordering
	stateVersion?: number;
}
```

## GatewayConnection

**File:** `src/lib/gateway/connection.ts`

Manages the WebSocket lifecycle. Key responsibilities:

- Opens WebSocket, listens for messages
- Intercepts `connect.challenge` events and auto-replies with the connect frame
- Intercepts `__connect` response (hello-ok) and transitions through CONNECTED to READY
- Dispatches all other frames to registered handlers via `onFrame()`
- Handles close codes: 1008 maps to `PAIRING_REQUIRED`, others to `DISCONNECTED`
- Exposes `state` and `helloOk` as Svelte readable stores

### Connect frame construction

The connect frame (`src/lib/gateway/connection.ts`, `buildAndSendConnectFrame`) includes:

```typescript
{
  type: 'req',
  id: '__connect',           // Non-numeric — avoids RequestCorrelator collision
  method: 'connect',
  params: {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'openclaw-control-ui',   // Hardcoded enum in gateway
      version: '0.1.0',
      platform: 'web',
      mode: 'ui',
      displayName: 'Falcon Dashboard',
      instanceId: '<stable-per-tab-uuid>'
    },
    role: 'operator',
    scopes: ['operator.read', 'operator.write', 'operator.admin',
             'operator.approvals', 'operator.pairing'],
    caps: ['canvas', 'canvas.a2ui', 'tool-events'],
    commands: ['canvas.present', 'canvas.hide', 'canvas.navigate',
               'canvas.a2ui.pushJSONL', 'canvas.a2ui.reset'],
    auth: { token: '<gateway-token>' },
    device: {
      id: '<sha256-of-public-key>',
      publicKey: '<base64-ed25519-public-key>',
      signature: '<base64-ed25519-signature>',
      signedAt: 1708000000000,
      nonce: '<challenge-nonce>'
    }
  }
}
```

## RequestCorrelator

**File:** `src/lib/gateway/correlator.ts`

Maps outgoing request IDs to Promises. The primary mechanism for request/response correlation over the multiplexed WebSocket.

- `nextId()` -- returns a monotonically increasing string counter (`"1"`, `"2"`, ...)
- `track<T>(id, timeout?)` -- registers a pending request, returns a `Promise<T>` that resolves on matching response or rejects on timeout (default 30s)
- `handleFrame(frame)` -- if frame is a response matching a pending request, resolves or rejects the Promise. Returns `true` if handled
- `cancel(id, error)` / `cancelAll(reason)` -- reject pending requests (used on disconnect)
- `metrics` -- Svelte readable store tracking pending count, total requests, timeouts, errors

The `call<T>()` function in `src/lib/stores/gateway.ts` is the public API:

```typescript
export function call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
	const id = correlator.nextId();
	const promise = correlator.track<T>(id);
	connection.send({ type: 'req', id, method, params });
	return promise;
}
```

### Error handling

Failed responses produce a `GatewayRequestError` with structured fields:

```typescript
class GatewayRequestError extends Error {
	readonly code: string; // e.g. 'NOT_FOUND', 'UNAUTHORIZED'
	readonly details?: unknown;
	readonly retryable: boolean;
	readonly retryAfterMs?: number;
}
```

## EventBus

**File:** `src/lib/gateway/event-bus.ts`

Pub/sub system for gateway event frames. Supports exact event names and wildcard patterns.

```typescript
// Exact match
const unsub = eventBus.on('chat.message', (payload, frame) => { ... });

// Wildcard -- 'pm.*' matches 'pm.task.create', 'pm.project.list', etc.
const unsub = eventBus.on('pm.*', (payload, frame) => { ... });

// One-shot
const payload = await eventBus.once('session');
```

Frame routing in `src/lib/stores/gateway.ts`:

```typescript
connection.onFrame((frame: Frame) => {
	if (correlator.handleFrame(frame)) return; // Response? Resolve promise
	eventBus.handleFrame(frame); // Event? Dispatch to subscribers
});
```

The correlator gets first pass. If the frame is not a response (or not a pending one), the EventBus handles it.

## SnapshotStore

**File:** `src/lib/gateway/snapshot-store.ts`

Hydrates from the hello-ok payload and stays in sync via EventBus subscriptions. Exposes:

| Store             | Source                     | Updated by                     |
| ----------------- | -------------------------- | ------------------------------ |
| `presence`        | `snapshot.presence`        | `presence` events (join/leave) |
| `health`          | `snapshot.health`          | `health` events                |
| `stateVersion`    | `snapshot.stateVersion`    | event `stateVersion` fields    |
| `sessionDefaults` | `snapshot.sessionDefaults` | hello-ok only                  |
| `features`        | `features.methods`         | hello-ok only                  |
| `server`          | `server`                   | hello-ok only                  |
| `policy`          | `policy`                   | hello-ok only                  |

`hasMethod(method)` returns a derived store for feature detection.

## Reconnector

**File:** `src/lib/gateway/reconnector.ts`

Automatic reconnection with exponential backoff and tick-based health monitoring.

### Backoff parameters

| Parameter    | Value    |
| ------------ | -------- |
| Base delay   | 800ms    |
| Multiplier   | 1.7x     |
| Cap          | 15,000ms |
| Max attempts | 20       |

Delay sequence: 800, 1360, 2312, 3930, 6681, 11358, 15000, 15000, ...

### Tick monitoring

After hello-ok, the reconnector starts a tick timer. If no `tick` event arrives within `2 * tickIntervalMs`, the connection is assumed lost and reconnection is scheduled.

### Network awareness

If `navigator.onLine` is false, the reconnector pauses and listens for the `online` event instead of burning retry attempts while offline.

### Shutdown events

The gateway may send a `shutdown` event with `restartExpectedMs`. The reconnector uses this as the initial delay instead of the backoff formula, allowing faster reconnection after planned restarts.

### Token refresh

Before each reconnection attempt, `onBeforeReconnect` fetches `/api/gateway-config` to get a fresh token. This handles token rotation without requiring a page reload.

## AgentStreamManager

**File:** `src/lib/gateway/stream.ts`

Reassembles streaming agent responses from gateway events into a unified stream of typed events.

### Gateway agent event format

Agent events arrive as `{ type: 'event', event: 'agent', payload: { stream, data, runId, seq } }`:

| `stream` field | `data.phase` / content                                | Maps to                        |
| -------------- | ----------------------------------------------------- | ------------------------------ |
| `lifecycle`    | `data.phase: 'start' \| 'end' \| 'error'`             | Run lifecycle                  |
| `assistant`    | `data.text` (accumulated), `data.delta` (incremental) | `DeltaEvent`                   |
| `thinking`     | `data.text` (accumulated), `data.delta` (incremental) | `DeltaEvent` with thinkingText |
| `tool`         | `data.phase: 'start'`                                 | `ToolCallEvent`                |
| `tool`         | `data.phase: 'result'`                                | `ToolResultEvent`              |

**Important:** Tool events use `data.phase` (not `data.type`). The `tool-events` capability must be declared in the connect frame to receive them.

### Emitted stream events

```typescript
type AnyStreamEvent =
	| MessageStartEvent // run started
	| DeltaEvent // text and/or thinking text updated
	| ToolCallEvent // tool invocation started
	| ToolResultEvent // tool returned result
	| MessageEndEvent; // run completed (ok/error/aborted)
```

### Race condition handling

Tool events may arrive before the `chat.send` RPC response. The stream manager auto-creates a run on the first agent event if no ack has been received, preventing orphaned events.

## DeviceIdentity

**File:** `src/lib/gateway/device-identity.ts`

Manages Ed25519 keypair generation and persistence via IndexedDB (`falcon-dash` database, `device-identity` store).

### Key operations

- `generateKeypair()` -- `crypto.subtle.generateKey('Ed25519')`, non-extractable private key
- `deriveDeviceId(publicKey)` -- SHA-256 hash of raw public key bytes, hex-encoded
- `exportPublicKeyBase64(publicKey)` -- raw public key as base64 for the connect frame
- `buildSignMessage(payload)` -- pipe-delimited string: `v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce`
- `signMessage(privateKey, message)` -- Ed25519 signature as base64
- `ensureDeviceIdentity()` -- load from IndexedDB or generate and persist
- `storeDeviceToken(token)` -- persist the `deviceToken` from hello-ok for future sessions

## DiagnosticLog

**File:** `src/lib/gateway/diagnostic-log.ts`

Ring-buffer logger (200 entries max) for connection events. Used by the `DiagnosticPanel` component.

Categories: `connection`, `auth`, `reconnect`, `tick`, `request`, `error`, `canvas`
Levels: `debug`, `info`, `warn`, `error`

Exposes `entries`, `errorCount`, `warnCount` as Svelte readable stores, and `export()` for clipboard copy.

## Capabilities

The connect frame declares three capabilities:

| Capability    | Purpose                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `canvas`      | Receive canvas commands (`canvas.present`, `canvas.hide`, etc.)           |
| `canvas.a2ui` | Receive A2UI JSONL streams and canvas resets                              |
| `tool-events` | Receive `stream: 'tool'` events from agents (added in OpenClaw v2026.2.3) |

Without `tool-events`, the client only receives text/thinking deltas and lifecycle events.

## Known gotchas

### `__connect` frame ID

The connect frame uses the string `'__connect'` as its ID. This is intentional -- `RequestCorrelator` uses monotonically increasing numeric strings (`"1"`, `"2"`, ...). A non-numeric ID avoids collisions. Do not change this to a numeric value.

### `allowInsecureAuth` scope

Setting `gateway.controlUi.allowInsecureAuth: true` in `openclaw.json` only auto-approves Control UI connections (client mode `ui`). It does not auto-approve backend or agent connections. If an agent's backend pairing is pending, exec approval events will not reach the UI.

### `client.id` enum

The gateway validates `client.id` against a hardcoded enum (`GATEWAY_CLIENT_IDS` in `client-info.ts`). Falcon Dash uses `openclaw-control-ui`. Custom IDs are rejected. Other valid IDs include `webchat-ui`, `webchat`, `cli`, `gateway-client`, `openclaw-macos`, `openclaw-ios`, `openclaw-android`, `node-host`, `test`, `fingerprint`, `openclaw-probe`.

Avoid `webchat-ui` for dashboards -- it triggers `isWebchatClient()=true` regardless of mode, which changes gateway behavior.

### `sessions.patch` and `sessions.delete` parameters

These methods use `key` (not `sessionKey`) and `label` (not `displayName`):

```typescript
await call('sessions.patch', { key: sessionKey, label: name });
await call('sessions.delete', { key: sessionKey, deleteTranscript: true });
```

### Thinking levels

Valid values: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`. Not `off`/`on`/`stream`.
