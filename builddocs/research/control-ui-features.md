# Control UI Feature Analysis

**Date:** 2026-02-08
**Source:** Reverse-engineered from OpenClaw Control UI bundle (`index-CXUONUC9.js`)

---

## Complete Method List (41 methods used)

```
agent.identity.get    channels.logout    channels.status    chat.abort
chat.history          chat.send          config.apply       config.get
config.schema         config.set         connect            cron.add
cron.list             cron.remove        cron.run           cron.runs
cron.status           cron.update        device.pair.approve
device.pair.list      device.pair.reject device.token.revoke
device.token.rotate   exec.approval.resolve                health
last-heartbeat        logs.tail          models.list        node.list
sessions.delete       sessions.list      sessions.patch     skills.install
skills.status         skills.update      status             system-presence
update.run            web.login.start    web.login.wait
```

## Event Types Handled

```
agent                    chat                  connect.challenge
cron                     device.pair.requested device.pair.resolved
exec.approval.requested  exec.approval.resolved presence
```

---

## 1. Cron Job Management

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `cron.status` | `{}` | Overall cron scheduler status |
| `cron.list` | `{ includeDisabled: true }` | Always fetches all jobs including disabled |
| `cron.add` | Full job object (built from form) | Name, schedule, payload, sessionTarget, etc. |
| `cron.update` | `{ id, patch: { enabled: bool } }` | Partial update via patch object |
| `cron.remove` | `{ id }` | Delete by job ID |
| `cron.run` | `{ id, mode: "force" }` | Trigger immediate execution |
| `cron.runs` | `{ id, limit: 50 }` | Fetch last 50 run history entries |

### Event: `cron`
Broadcast on job lifecycle changes. UI refreshes job list on receipt.

### Patterns
- Form builds full job object for `cron.add` (name, description, schedule, payload, sessionTarget)
- Enable/disable is a `cron.update` with just `{ enabled: bool }` in the patch
- `mode: "force"` on `cron.run` bypasses schedule checks
- Run history fetched per-job with `limit: 50`

---

## 2. Config Editing

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `config.get` | `{}` | Returns `{ raw, parsed, hash, valid, issues, warnings }` |
| `config.schema` | `{}` | Returns JSON Schema for form rendering |
| `config.set` | `{ raw, baseHash }` | Write config with optimistic concurrency |
| `config.apply` | `{ raw, baseHash, sessionKey }` | Write + restart gateway |

### Patterns
- **Hash-based concurrency**: Must send `baseHash` from last `config.get`. If config changed since, server rejects.
- **Error handling**: If hash is missing, shows "Config hash missing; reload and retry."
- `config.set` writes without restart. `config.apply` writes AND restarts (includes `sessionKey` to resume after restart).
- `config.schema` returns full JSON Schema — could be used to auto-generate settings forms.
- After any config change, re-fetches config to get new hash.

---

## 3. Channel Status

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `channels.status` | `{}` | Returns per-channel connection state |
| `channels.logout` | Channel-specific params | Disconnect a channel |

### WhatsApp QR Login Flow

| Method | Params | Notes |
|--------|--------|-------|
| `web.login.start` | `{ force: bool, timeoutMs: 30000 }` | Initiates login, returns `{ message, qrDataUrl }` |
| `web.login.wait` | `{ timeoutMs: 120000 }` | Waits for QR scan completion, returns `{ message, connected }` |

### Patterns
- `web.login.start` returns a `qrDataUrl` (data URL of QR code image) — render directly in an `<img>` tag
- `web.login.wait` blocks for up to 2 minutes waiting for the user to scan
- When `connected: true`, clears the QR display
- `force: true` on start forces re-auth even if already connected

---

## 4. Exec Approvals

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `exec.approvals.get` | `{}` | Get gateway-level allowlist |
| `exec.approvals.set` | Allowlist object | Set gateway-level allowlist |
| `exec.approvals.node.get` | `{ nodeId }` | Get per-node allowlist |
| `exec.approvals.node.set` | `{ nodeId, ...allowlist }` | Set per-node allowlist |
| `exec.approval.resolve` | `{ id, decision }` | Approve/deny a pending request |

### Events

| Event | Description |
|-------|-------------|
| `exec.approval.requested` | New approval needed — added to queue with auto-dismiss timeout |
| `exec.approval.resolved` | Approval resolved (by this or another client) — removed from queue |

### Patterns
- Approval queue maintained client-side as an array
- New requests added via `exec.approval.requested` event
- Each request has an auto-dismiss timeout (removed from queue after N seconds if not acted on)
- `decision` values: from event handlers, options are `"allow-once"`, `"allow-always"`, `"deny"`
- Gateway vs node allowlists are separate — UI switches between them based on selected scope

---

## 5. Session Management

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `sessions.list` | Variable params object | List sessions with filters |
| `sessions.patch` | Variable params object | Update session overrides (model, thinking, etc.) |
| `sessions.delete` | `{ key, deleteTranscript: true }` | Delete session + transcript |

### Patterns
- `sessions.delete` always sends `deleteTranscript: true`
- `sessions.patch` used for per-session overrides (model, thinking level, verbose)
- Session list refreshed on presence events

---

## 6. Skills Management

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `skills.status` | `{}` | Returns all skills with enabled/disabled status |
| `skills.update` | `{ skillKey, enabled: bool }` | Enable/disable a skill |
| `skills.update` | `{ skillKey, apiKey: string }` | Set API key for a skill |
| `skills.install` | `{ name, installId, timeoutMs: 120000 }` | Install skill (2 min timeout) |

### Patterns
- Same `skills.update` method used for both enable/disable and API key updates (different param shapes)
- Install has a generous 2-minute timeout (npm install can be slow)
- `installId` is a unique identifier for the install operation
- Per-skill success/error toasts tracked by skillKey

---

## 7. Node/Device Management

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `node.list` | `{}` | List all connected/paired nodes |
| `device.pair.list` | `{}` | List pending pairing requests |
| `device.pair.approve` | `{ requestId }` | Approve a device |
| `device.pair.reject` | `{ requestId }` | Reject a device |
| `device.token.rotate` | Token-specific params | Rotate a device's token |
| `device.token.revoke` | Token-specific params | Revoke a device's token |

### Events

| Event | Description |
|-------|-------------|
| `device.pair.requested` | New device wants to pair — refresh list |
| `device.pair.resolved` | Pairing resolved — refresh list |

### Patterns
- On `device.pair.requested` or `device.pair.resolved` events, quietly refreshes the device/pairing lists
- Token rotation and revocation are separate operations

---

## 8. Log Viewer

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `logs.tail` | `{ cursor?, limit: 500, maxBytes: 250000 }` | Fetch log entries |

### Response Shape
```
{ lines: string[], cursor: number, file: string, truncated: boolean }
```

### Patterns
- **Cursor-based pagination**: First call sends no cursor (gets latest). Subsequent calls send last cursor to get new entries.
- `limit: 500` lines per fetch, `maxBytes: 250000` (250KB) safety cap
- Lines are filtered client-side by text and log level
- Auto-follow mode: automatically scrolls to bottom on new entries
- `reset` flag clears cursor to start fresh
- Entries kept in a sliding window (old entries trimmed from front)
- Not a streaming WebSocket — it's polling with cursors

---

## 9. Models

### Methods & Params

| Method | Params | Notes |
|--------|--------|-------|
| `models.list` | `{}` | Returns all available models across all providers |

### Patterns
- Called once on startup alongside health/status
- Used to populate model selector dropdowns
- No method for switching models — that's done via `sessions.patch` or `config.set`

---

## 10. Additional Methods

### Status/Health

| Method | Params | Notes |
|--------|--------|-------|
| `health` | `{}` | Full health snapshot with channel probes |
| `status` | `{}` | Heartbeat config, channel summary, session count |
| `last-heartbeat` | `{}` | Last heartbeat run details |
| `system-presence` | `{}` | Current presence list |

### Agent Identity

| Method | Params | Notes |
|--------|--------|-------|
| `agent.identity.get` | Agent-specific params | Get agent identity (name, avatar, etc.) |

### Update

| Method | Params | Notes |
|--------|--------|-------|
| `update.run` | `{ sessionKey }` | Run package/git update + restart |

---

## Key Patterns for falcon-dash

1. **Optimistic concurrency everywhere**: Config uses `baseHash`, cron operations refetch after mutation.

2. **Event-driven updates**: The UI subscribes to events (`cron`, `presence`, `device.pair.*`, `exec.approval.*`) and updates state reactively. No polling.

3. **Logs are poll-based, not streamed**: Despite being real-time-ish, logs use cursor-based pagination, not a streaming subscription.

4. **Skills and config share a pattern**: Call `get`/`status`, mutate with `set`/`update`, re-fetch to confirm.

5. **Exec approvals are queued client-side**: The gateway pushes events, the UI maintains an approval queue with auto-dismiss timeouts.

6. **WhatsApp login is a two-step flow**: Start (get QR) → Wait (block for scan). Clean UX pattern we should replicate.

7. **Usage/cost methods exist server-side but aren't used by the UI**: `usage.status` and `usage.cost` are implemented in the gateway but the control-ui never calls them. Major opportunity for falcon-dash's Information tab.

8. **Hidden session methods**: `sessions.reset` and `sessions.compact` exist server-side but aren't exposed in the UI. Easy wins for falcon-dash's channel settings panel.
