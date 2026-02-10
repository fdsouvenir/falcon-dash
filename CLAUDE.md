# falcon-dash

Web dashboard for the OpenClaw AI platform (docs.openclaw.ai/llms.txt). Connects to the OpenClaw Gateway via WebSocket.

## Current State

Repo was reset for rebuild. Only architecture docs remain. No application code, no dependencies, no config.

## Reference Docs

All prior research and specs are in `builddocs/`:

- `falcon-dash-architecture-v02.md` — full architecture spec
- `ws-protocol.md` — WebSocket protocol reference
- `pm-spec.md` — PM specification
- `research/` — canvas UI, control-ui features, file operations, PM API design, webchat client analysis, ws-protocol test

Consult these docs before making architectural decisions.

## Gateway WS Protocol

- **URL:** `ws://127.0.0.1:18789` (default)
- **client.id:** must be `"openclaw-control-ui"` (gateway validates)
- **client.mode:** must be `"webchat"`
- **Protocol version:** `3`
- **Frame types:** `req`, `res`, `event`
- **First frame:** must be `connect` request
- **Tick interval:** from `policy.tickIntervalMs` in hello-ok (read dynamically, do not hardcode)
- **Timeout:** 2x tick interval (miss 2 ticks = connection lost)
- **Reconnection:** exponential backoff: 800ms base, 1.7x multiplier, 15s cap
- **Dev auth:** set `gateway.controlUi.allowInsecureAuth: true` for token-only
