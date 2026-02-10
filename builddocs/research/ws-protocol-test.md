# WS Protocol Live Test Results

**Date:** 2026-02-08
**Tested against:** OpenClaw Gateway on localhost:18789

---

## Summary

Successfully connected, authenticated, and called 5 methods. Protocol works as documented with a few important corrections.

## Corrections to Protocol Doc

### 1. `client.id` must be an allowed constant — NOT arbitrary

**Doc said:** `client.id` is a free-form string like `"falcon-dash"`
**Reality:** The gateway validates `client.id` against an enum of allowed values:
- `"openclaw-control-ui"` (for control UI / dashboard clients)
- `"webchat"` (for webchat widget)
- `"node"` (for node clients)
- `"cli"` (for CLI clients)

**Impact:** falcon-dash must use `"openclaw-control-ui"` as its client.id. Custom IDs are rejected.

### 2. `client.mode` must also be an allowed constant

**Doc said:** `client.mode` is `"operator"`
**Reality:** Must be one of the allowed modes. The control-ui uses `"webchat"`.

**Impact:** falcon-dash should use `mode: "webchat"` (matching the control-ui).

### 3. Device identity is REQUIRED unless `allowInsecureAuth` is enabled

**Doc said:** Mentioned `allowInsecureAuth` as a fallback
**Reality:** Without device identity (Ed25519 keypair + challenge signing), the gateway rejects with `"control ui requires HTTPS or localhost (secure context)"` even on localhost over plain WS.

**Config needed:** Either:
- `gateway.controlUi.allowInsecureAuth: true` (skips device identity, token auth only)
- `gateway.controlUi.dangerouslyDisableDeviceAuth: true` (same but more explicit)
- Or implement full Ed25519 device identity (WebCrypto in browser)

**Impact:** For development, we'll need `allowInsecureAuth`. For production, implement device identity. This should be documented in the setup/onboarding flow.

### 4. hello-ok payload has MORE fields than documented

**Doc said:** `{ protocol, policy, snapshot, auth }`
**Actual shape:**
```json
{
  "type": "hello-ok",
  "protocol": 3,
  "server": {
    "version": "dev",
    "host": "fredbot.system",
    "connId": "06a28701-..."
  },
  "features": {
    "methods": ["health", "logs.tail", "channels.status", ...]
  },
  "policy": {
    "maxPayload": 524288,
    "maxBufferedBytes": 1572864,
    "tickIntervalMs": 30000
  },
  "snapshot": {
    "presence": [...],
    "health": {...},
    "stateVersion": { "presence": 27, "health": 350 },
    "uptimeMs": ...,
    "configPath": "...",
    "stateDir": "...",
    "sessionDefaults": {...}
  },
  "auth": undefined  // (not returned when using token-only auth)
}
```

**Key additions not in our doc:**
- `server.version`, `server.host`, `server.connId`
- `features.methods` — **full list of available methods!** This is huge for feature detection
- `snapshot.configPath`, `snapshot.stateDir`, `snapshot.sessionDefaults`
- `snapshot.stateVersion` is an OBJECT `{ presence: N, health: N }`, not a single number

### 5. `tickIntervalMs` is 30000 (30s), not 15000 (15s)

**Doc said:** Default 15s
**Actual:** 30s

**Impact:** Adjust tick timeout to 2 × 30s = 60s before assuming connection lost.

### 6. `connect.challenge` IS sent (even on localhost)

Confirmed: the gateway sends a `connect.challenge` event with `{ nonce, ts }` before the client sends `connect`. On localhost without device auth, the nonce doesn't need to be signed.

## Methods Tested Successfully

| Method | Status | Notes |
|--------|--------|-------|
| `health` | ✅ | Returns full health with channel probes, Discord bot info |
| `status` | ✅ | Returns heartbeat config, channel summary, session count |
| `sessions.list` | ✅ | Returns sessions with full metadata (tokens, model, etc.) |
| `models.list` | ✅ | Returns all available models across all providers |
| `channels.status` | ✅ | Returns per-channel connection state, account info |

## Events Received

| Event | When | Notes |
|-------|------|-------|
| `connect.challenge` | Immediately on WS open | Contains nonce + timestamp |
| `health` | After connect | Health state change broadcast |

No `tick` event received during the 20s test window (expected — tickInterval is 30s).

## Recommendations for WS Client

1. **Use `client.id: "openclaw-control-ui"` and `mode: "webchat"`** — don't try custom values
2. **Parse `features.methods` from hello-ok** — use for feature detection instead of hardcoding method availability
3. **Implement Ed25519 device identity for production** — use `allowInsecureAuth` only for development
4. **Set tick timeout to 60s** (2 × 30s tickInterval)
5. **`stateVersion` is per-domain** — track `presence` and `health` versions separately
6. **Store `server.connId`** — useful for debugging and reconnection correlation
