# OpenClaw Gateway WS Protocol — falcon-dash Reference

**Purpose:** Complete protocol map for building the falcon-dash WS client layer.
**Source:** Compiled from docs.openclaw.ai + live protocol testing (2026-02-08)
**Date:** 2026-02-08
**Verified:** ✅ Tested against live gateway — corrections applied

---

## 1. Transport

- **WebSocket**, text frames with JSON payloads
- Single port serves both WS and HTTP (default `ws://127.0.0.1:18789`)
- First frame **must** be a `connect` request — anything else = hard close
- All frames are validated server-side with AJV against JSON Schema
- Protocol definitions are TypeBox schemas in `src/gateway/protocol/schema.ts`
- TS types can be generated: `pnpm protocol:gen`

---

## 2. Frame Types

Three frame types. Every frame is a JSON object with a `type` field.

### Request
```json
{ "type": "req", "id": "<unique>", "method": "<method>", "params": { ... } }
```
- `id` must be unique per request (used for response correlation)
- Side-effecting methods require **idempotency keys** (e.g. `chat.send`, `agent`)

### Response
```json
{ "type": "res", "id": "<matching-req-id>", "ok": true, "payload": { ... } }
{ "type": "res", "id": "<matching-req-id>", "ok": false, "error": { "code": "...", "message": "...", "details?": ..., "retryable?": bool, "retryAfterMs?": number } }
```

### Event (server-push)
```json
{ "type": "event", "event": "<event-name>", "payload": { ... }, "seq?": number, "stateVersion?": number }
```
- `seq` is present on ordered streams (agent events)
- `stateVersion` tracks state changes (presence)
- **Events are NOT replayed** — client must detect seq gaps and refresh via `health` + `system-presence`

---

## 3. Connection Lifecycle

### 3a. Challenge (server → client, pre-connect)
```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "...", "ts": 1737264000000 }
}
```
Non-local connections must sign this nonce with the device keypair.

### 3b. Connect (client → server)
```json
{
  "type": "req",
  "id": "1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "openclaw-control-ui",
      "version": "0.1.0",
      "platform": "web",
      "mode": "webchat",
      "displayName": "Falcon Dashboard",
      "instanceId": "<unique-per-tab>"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": { "token": "<gateway-token>" },
    "locale": "en-US",
    "userAgent": "falcon-dash/0.1.0",
    "device": {
      "id": "<device-fingerprint>",
      "publicKey": "...",
      "signature": "...",
      "signedAt": 1737264000000,
      "nonce": "..."
    }
  }
}
```

**Key fields for falcon-dash:**
- `client.id`: **must be** `"openclaw-control-ui"` — gateway validates against an enum, custom IDs are rejected
- `client.mode`: **must be** `"webchat"` — same constraint
- `role`: always `"operator"` (we are a control-plane client, not a node)
- `scopes`: `["operator.read", "operator.write"]` minimum; add `"operator.admin"`, `"operator.approvals"`, `"operator.pairing"` as needed
- `auth.token`: the gateway token (stored in localStorage or settings)
- `device.id`: stable browser fingerprint — switching browsers or clearing data = new device = re-pairing
- `client.instanceId`: unique per tab (important for presence dedup)

### 3c. Hello-OK (server → client)
```json
{
  "type": "res",
  "id": "1",
  "ok": true,
  "payload": {
    "type": "hello-ok",
    "protocol": 3,
    "server": {
      "version": "dev",
      "host": "fredbot.system",
      "connId": "06a28701-..."
    },
    "features": {
      "methods": ["health", "logs.tail", "channels.status", "config.get", ...]
    },
    "policy": {
      "maxPayload": 524288,
      "maxBufferedBytes": 1572864,
      "tickIntervalMs": 30000
    },
    "snapshot": {
      "presence": [ ... ],
      "health": { ... },
      "stateVersion": { "presence": 27, "health": 350 },
      "uptimeMs": ...,
      "configPath": "...",
      "stateDir": "...",
      "sessionDefaults": { ... }
    },
    "auth": {
      "deviceToken": "...",
      "role": "operator",
      "scopes": ["operator.read", "operator.write"]
    }
  }
}
```

**Critical:** `hello-ok` includes a full `snapshot` — presence, health, stateVersion, uptimeMs. Render immediately from this; no extra requests needed at connect time.

**Key fields (verified via live testing):**
- `server.connId` — unique per connection, useful for debugging
- `features.methods` — **full list of available RPC methods**. Use for feature detection instead of hardcoding
- `policy.tickIntervalMs` — **30000 (30s)**, not 15s as previously assumed
- `snapshot.stateVersion` — **object** with per-domain versions: `{ presence: N, health: N }`
- `snapshot.sessionDefaults` — default model, context tokens, etc.
- `auth` — only returned when device token is issued (new pairing). Undefined for token-only auth

**Device token:** If issued (new device pairing), persist `auth.deviceToken` for future connects.

### 3d. Pairing Required (connect rejection)
If the device is unknown, the gateway closes with code `1008: pairing required`.

**Flow:**
1. Client connects → gets `1008` close
2. Show user "Pairing required — approve this device on your gateway host"
3. User runs: `openclaw devices approve <requestId>`
4. Client reconnects → gets `hello-ok`

**Note:** Device identity (Ed25519 keypair + challenge signing) is **required** even on localhost unless one of these config flags is set:
- `gateway.controlUi.allowInsecureAuth: true` — skips device identity, allows token-only auth
- `gateway.controlUi.dangerouslyDisableDeviceAuth: true` — same but more explicit

For development, set `allowInsecureAuth: true`. For production, implement full Ed25519 device identity via WebCrypto.

Local connections (127.0.0.1) are auto-approved for pairing. Remote connections always require explicit approval.

---

## 4. Methods (Request/Response)

### Chat Methods

| Method | Description | Response |
|--------|-------------|----------|
| `chat.send` | Send a user message | **Non-blocking**: ack `{ runId, status: "started" }`, then streams via `agent` events, then final `res { runId, status: "ok"\|"error", summary }` |
| `chat.history` | Fetch session transcript | `{ messages: [...] }` in raw transcript format |
| `chat.abort` | Abort current agent run | `{ sessionKey }` — aborts all active runs for that session |
| `chat.inject` | Append assistant note (no agent run) | Broadcasts a `chat` event for UI-only updates |

**chat.send details:**
- Requires `idempotencyKey` for safe retry
- Re-sending same key while running → `{ status: "in_flight" }`
- Re-sending same key after completion → `{ status: "ok" }`
- Agent responses are **two-stage**: first ack, then streamed `event:agent`, then final `res`

### Session Methods

| Method | Description | Params |
|--------|-------------|--------|
| `sessions.list` | List sessions | `kinds?`, `limit?`, `activeMinutes?`, `messageLimit?` |
| `sessions.patch` | Update session overrides | thinking/verbose toggles per session |

**Session key model:**
- Main direct chat: `agent:<agentId>:<mainKey>` (default `main`)
- Group chats: `agent:<agentId>:<channel>:group:<id>`
- Cron jobs: `cron:<jobId>`
- Nodes: `node-<nodeId>`

### Status & Health

| Method | Description |
|--------|-------------|
| `health` | Full health snapshot (same as `openclaw health --json`) |
| `status` | Short summary |
| `system-presence` | Current presence list (keyed by device identity) |
| `system-event` | Post a presence/system note |
| `models.list` | List available models |

### Config Methods

| Method | Description | Notes |
|--------|-------------|-------|
| `config.get` | Read current config | Returns `{ payload, hash }` |
| `config.set` | Set individual keys | |
| `config.patch` | Partial config update | |
| `config.apply` | Full config replace + restart | Requires `baseHash` to prevent clobbering concurrent edits |
| `config.schema` | Get config JSON Schema | For form rendering |

### Skills Methods

| Method | Description |
|--------|-------------|
| `skills.*` | Status, enable/disable, install, API key updates |

### Cron Methods

| Method | Description |
|--------|-------------|
| `cron.list` | List all cron jobs |
| `cron.add` | Create a new job |
| `cron.edit` | Modify existing job |
| `cron.rm` | Delete a job |
| `cron.enable` / `cron.disable` | Toggle job |
| `cron.run` | Trigger job immediately (force or due) |
| `cron.runs` | Execution history |

### Node Methods

| Method | Description |
|--------|-------------|
| `node.list` | Paired + connected nodes (caps, deviceFamily, commands) |
| `node.describe` | Describe a node's capabilities |
| `node.invoke` | Invoke a command on a node (canvas.*, camera.*, etc.) |
| `node.pair.*` | Pairing lifecycle (request, list, approve, reject, verify) |

### Exec Approval Methods

| Method | Description |
|--------|-------------|
| `exec.approvals.*` | Edit gateway/node allowlists + ask policy |
| `exec.approval.resolve` | Approve/deny a pending exec request (requires `operator.approvals` scope) |

### Device Methods

| Method | Description |
|--------|-------------|
| `device.token.rotate` | Rotate a device token |
| `device.token.revoke` | Revoke a device token |

### Other

| Method | Description |
|--------|-------------|
| `send` | Send a message via active channel(s) |
| `agent` | Run an agent turn (two-stage: ack → stream → final) |
| `logs.tail` | Live tail of gateway file logs with filter |
| `update.run` | Run package/git update + restart |
| `channels.status` | Channel connection status |
| `web.login.*` | Channel QR login flows |

---

## 5. Events (Server Push)

| Event | Description | Payload |
|-------|-------------|---------|
| `agent` | Streamed tool/output events from agent run | seq-tagged; includes thinking, tool calls, tool results, assistant text deltas |
| `chat` | Chat event (new message, inject) | Used by chat.inject for UI-only updates |
| `presence` | Presence updates (deltas) | Includes `stateVersion` for ordering |
| `tick` | Periodic keepalive | Confirms gateway is alive; interval from `policy.tickIntervalMs` |
| `shutdown` | Gateway is exiting | `{ reason, restartExpectedMs? }` — client should reconnect |
| `exec.approval.requested` | Exec needs approval | Broadcast to operator clients |
| `health` | Health state change | |
| `heartbeat` | Heartbeat lifecycle | |
| `cron` | Cron job lifecycle | |

### Agent Event Stream Detail

When `chat.send` triggers an agent run, the response flow is:

```
client                          gateway
  |--- req: chat.send ----------->|
  |<-- res: { runId, status:      |
  |         "started" }           |
  |                               |  (agent starts running)
  |<-- event: agent (thinking)  --|
  |<-- event: agent (thinking)  --|
  |<-- event: agent (tool_start)--|
  |<-- event: agent (tool_result)-|
  |<-- event: agent (text_delta)--|
  |<-- event: agent (text_delta)--|
  |<-- event: agent (text_end)  --|
  |<-- res: { runId, status:      |
  |         "ok", summary }       |
```

Agent events include tool call cards (args + results) that can be rendered inline.

---

## 6. Keepalive & Reconnection

### Keepalive
- `tick` events emitted at `policy.tickIntervalMs` from hello-ok (read dynamically, do not hardcode)
- If no tick received within ~2x the interval, assume connection lost

### Reconnection Strategy
- Events are **not replayed** — client must:
  1. Detect disconnect
  2. Reconnect with exponential backoff (800ms base, 1.7× multiplier, 15s cap — dashboard-chosen, see architecture §4.4)
  3. On successful reconnect, refresh state:
     - `hello-ok` snapshot gives current presence + health
     - Call `chat.history` to fill message gaps (compare last known message)
     - Call `sessions.list` for session state
  4. Detect seq gaps in agent events → call `health` + `system-presence` before continuing

### Shutdown Event
- Gateway sends `shutdown` event before closing
- Includes `restartExpectedMs` — client should auto-reconnect after that delay

---

## 7. Error Codes

Standard error shape: `{ code, message, details?, retryable?, retryAfterMs? }`

| Code | Meaning |
|------|---------|
| `NOT_LINKED` | WhatsApp not authenticated |
| `AGENT_TIMEOUT` | Agent didn't respond in time |
| `INVALID_REQUEST` | Schema/param validation failed |
| `UNAVAILABLE` | Gateway shutting down or dependency unavailable |

---

## 8. falcon-dash Scoping

### Methods we need immediately (Chat module):
- `chat.send`, `chat.history`, `chat.abort`, `chat.inject`
- `sessions.list`, `sessions.patch`
- `system-presence` (for connection status)
- `health`, `status` (for header indicators)

### Methods for Files module:
- Workspace file operations are likely via `agent` turns or direct workspace file access
- Need to investigate: are there `workspace.*` or `file.*` RPC methods, or does the Control UI use agent turns for file ops?

### Methods for Agent Jobs module:
- `cron.*` (full CRUD + run history)
- Heartbeat config via `config.get` / `config.patch` on `agents.defaults.heartbeat`
- Workspace file read/write for HEARTBEAT.md

### Methods for Settings module:
- `config.*` (get, set, patch, apply, schema)
- `skills.*`
- `channels.status`, `web.login.*`
- `node.list`, `node.pair.*`
- `exec.approvals.*`
- `logs.tail`
- `models.list`
- `system-presence`
- `health`, `status`

### Methods for PM module:
- **Does not exist yet** — needs to be designed as either:
  - Custom Gateway WS methods (`pm.project.list`, `pm.task.create`, etc.)
  - Or agent turns that invoke the `pm` CLI tool
  - Or a skill/plugin that registers WS methods

---

## 9. Open Questions for falcon-dash

1. **File operations** — How does the Control UI read/write workspace files? Is there a `workspace.read` / `workspace.write` RPC, or does it use `config.get`/`config.set` for workspace files?

2. **PM API** — Best path: OpenClaw skill/plugin that registers `pm.*` WS methods? Or agent tool calls?

3. **Canvas rendering** — Canvas host serves from `http://<host>:18793/__openclaw__/canvas/`. Does falcon-dash iframe this, or does it need to render A2UI payloads inline?

4. **Protocol version** — Current version appears to be 3. Need to track `PROTOCOL_VERSION` for compatibility.

5. **Device identity in browser** — WebCrypto is blocked over plain HTTP (non-secure context). Need HTTPS or localhost for device identity + pairing. The Control UI handles this with `allowInsecureAuth` as a fallback.

6. **TypeBox schema consumption** — Can we import the TypeBox definitions directly from the OpenClaw package for type safety?
