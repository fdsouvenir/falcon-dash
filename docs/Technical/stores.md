# Browser State and Stores

Falcon Dash uses small Svelte stores for browser state that is transient, gateway-derived, or shared
between current components. Durable Work state belongs in SQLite and is loaded through page servers;
gateway runtime state belongs in OpenClaw.

## Realtime sources

### Gateway events

`src/lib/gateway-api.ts` owns one browser `EventSource` for `/api/gateway/events`. It exposes:

- connection state and a ready/disconnected boolean;
- the current `hello-ok` snapshot;
- exact and wildcard event subscriptions;
- `rpc()` for same-origin calls through `/api/gateway/rpc`.

Feature stores subscribe to this adapter. There is no browser-side OpenClaw WebSocket, token store,
request correlator, or gateway connection class.

### Work events

`src/lib/work3/live.ts` subscribes to `/api/work3/events` and debounces SvelteKit invalidation for
Work readers. The event stream signals that data changed; page servers reread the canonical state.
Do not treat the stream as a durable event store.

## Store groups

The current files under `src/lib/stores/` fall into these groups:

- **Gateway feature state:** `agent-identity`, `agent-lifecycle`, `sessions`, `cron`, `heartbeat`,
  `exec-approvals`, `channel-readiness`, `discord`, `secrets`, `files`, `ops`, and diagnostics.
- **Falcon UI state:** `preferences`, `viewport`, `toast`, `notifications`, `editor`, and
  `pinned-apps`.
- **Canvas state:** `canvas` plus diagnostic logging for plugin-provided canvas events.
- **Vault UI state:** `vault`, backed by Falcon Dash vault APIs rather than a gateway secret value
  cache.

Read each store before using it; the file list describes ownership, not a promise that every older
route still consumes every store.

## Store rules

1. Keep durable or authoritative state on the server. A writable browser store is not a database.
2. Subscribe once at the narrowest shared boundary and always return cleanup.
3. Use gateway events as invalidations unless the event payload is explicitly the authoritative
   replacement.
4. Clear or rebuild gateway-derived state on disconnect; never display stale readiness as live.
5. Keep derived values derived. Do not mirror one store into another solely for convenience.
6. Expose async failures and disconnected states; do not convert them to empty success.
7. Do not persist gateway tokens, vault values, or agent Work bearer tokens in browser storage.
8. Avoid module-scope browser side effects that run during SSR. Start subscriptions from lifecycle
   code or an explicit `start` function.

## Adding or changing a store

- Identify the actual source of truth and the events that can invalidate it.
- Define initial, loading, ready, empty, error, and disconnected semantics.
- Make start/stop behavior idempotent when several components may consume it.
- Add unit tests for event adaptation, cleanup, retries, and derived state.
- Update this document, [../RELIABILITY.md](../RELIABILITY.md), and the owning end-user guide when
  visible behavior changes.
