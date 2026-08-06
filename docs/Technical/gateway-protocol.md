# OpenClaw Gateway Integration

Falcon Dash maintains one server-side OpenClaw Gateway connection. The browser communicates only
with same-origin Falcon Dash routes. This document describes that boundary; Falcon-specific plugin
behavior is in [gateway-plugin.md](gateway-plugin.md).

## Supported topology

Falcon Dash and OpenClaw run on the same host. `GATEWAY_URL` may use loopback or a private
same-host container service. Remote gateways are outside the supported product topology even
though some legacy configuration parsing remains in the current resolver.

Configuration resolution is server-only:

| Value | Priority                                                                         |
| ----- | -------------------------------------------------------------------------------- |
| URL   | `GATEWAY_URL`, `openclaw config get gateway --json`, `~/.openclaw/openclaw.json` |
| Token | `GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_TOKEN`, `~/.openclaw/openclaw.json`           |

There is no hardcoded fallback gateway port. Local OpenClaw configuration must provide its port, or
the URL must be explicit.

## Server client

`src/lib/server/gateway-client.ts` owns the WebSocket and exposes three states: `connecting`,
`ready`, and `disconnected`.

Connection sequence:

1. Resolve same-host URL and token.
2. Open the WebSocket and wait for `connect.challenge`.
3. Load or create the server device identity, sign the challenge, and send the `__connect` request.
4. Negotiate the range `minProtocol: 3` through `maxProtocol: 4` as client `gateway-client`, mode
   `ui`.
5. Store the returned hello snapshot, selected protocol, policy, and device token.
6. Treat gateway ticks as liveness and reconnect on loss.

RPC request IDs are monotonic strings and each pending request has a 30-second timeout. Disconnect
cancels all pending calls. Reconnect uses exponential backoff, except a retryable v4
`startup-sidecars` response can supply the next delay.

The client keeps only a small in-memory activity replay buffer for selected operational events.
That buffer is UI convenience, not history.

## Browser bridge

`src/lib/gateway-api.ts` is the only browser gateway adapter.

### RPC

`POST /api/gateway/rpc` accepts `{ method, params }` and forwards through the ready server client.
It returns:

- `400` for malformed requests;
- `503` when the gateway is not ready;
- `502` with structured gateway error fields when the upstream RPC fails;
- `{ ok: true, payload }` on success.

Feature code must preserve upstream error codes/details and must check method availability from the
hello snapshot when a capability is version- or plugin-dependent.

### Events

`GET /api/gateway/events` is an SSE stream. On connection it sends the latest snapshot when
available, current gateway state, and buffered activity. It then forwards live gateway events and
state changes, plus a 15-second SSE keepalive.

The browser adapter supports exact event names and `prefix.*` subscriptions. EventSource reconnects
automatically, but consumers must treat state as disconnected until a new ready snapshot arrives.

### Gateway Control UI

`/api/gateway/proxy` keeps the OpenClaw Control UI same-origin. HTTP requests use the SvelteKit
proxy route; WebSocket upgrades use Vite in development and `src/entry.js` in production. The token
is supplied to the embedded control UI through a URL fragment generated server-side.

## Protocol adapters

Gateway protocol v4 renamed and reshaped several capabilities. Adaptation belongs at feature or
store boundaries, not scattered through components. Current important mappings include:

- cron definitions use nested `schedule`, `payload`, `sessionTarget`, and `wakeMode`; create/remove
  methods are `cron.add` and `cron.remove`;
- configured agents come from `agents.list`, while active work is in the task ledger;
- workspace files use `agents.files.get/set`;
- session invalidation uses `sessions.changed` and messages use `session.message`;
- status and usage use the v4 method shapes;
- skill uninstall has no v4 RPC and requires an explicit configuration change.

Do not infer a gateway method or event from protocol number alone. Prefer the negotiated hello
feature list, with an explicit fallback only for known plugin-provided capabilities that are absent
from that list.

## Native cron versus Falcon scheduling

Current Jobs and Work Automations operate on OpenClaw native cron. Falcon Dash may add annotations,
derived health, authority, and history presentation, but the OpenClaw job ID is the runtime
identity.

The planned v4 integration-lifecycle scheduler is a different subsystem. It will not call itself an
OpenClaw cron job or reuse OpenClaw cron persistence merely because both execute on schedules.

## Security and reliability rules

- Never send gateway URL credentials or tokens to general browser state.
- Never allow browser callers to choose an upstream gateway host.
- Treat disconnected and unsupported capabilities explicitly; do not render stale data as ready.
- Do not duplicate the server connection per route or per browser.
- Keep plugin extensions out of the native transport adapter unless OpenClaw formally adopts them.
- Preserve the same-host boundary in configuration, deployment docs, and tests.
