# Stores

This document describes the Svelte store layer that bridges gateway data to UI components. All stores live in `src/lib/stores/`.

See also:

- [Gateway protocol](gateway-protocol.md) -- the classes that stores wrap
- [Architecture overview](architecture.md) -- how stores fit in the data flow
- [Components](components.md) -- how components consume stores

## Store architecture

Falcon Dash uses Svelte's `writable`/`readable`/`derived` stores as the reactive bridge between the gateway layer and UI components. The pattern:

1. Gateway classes (`src/lib/gateway/`) manage protocol state
2. Stores (`src/lib/stores/`) wrap gateway classes as singletons and expose reactive interfaces
3. Components subscribe to stores via `$effect` or Svelte auto-subscription (`$storeVar`)

Private state uses `writable`, while public APIs expose `readonly` wrappers. The `call<T>()` function provides typed RPC access to any gateway method.

## Gateway store

**File:** `src/lib/stores/gateway.ts`

The central wiring module. Creates singleton instances of all gateway classes and connects them:

```typescript
export const connection = new GatewayConnection();
export const correlator = new RequestCorrelator();
export const eventBus = new EventBus();
export const snapshot = new SnapshotStore();
export const reconnector = new Reconnector(connection, eventBus);
export const canvasStore = new CanvasStore();
```

### `connectToGateway(url, token)`

Entry point called by `+layout.svelte` after token is available:

1. Loads or generates Ed25519 device identity
2. Configures `reconnector.onBeforeReconnect` to refresh tokens from `/api/gateway-config`
3. Enables reconnector with the connection config
4. Calls `connection.connect(config)`

### `call<T>(method, params)`

The primary way to make gateway RPC calls from anywhere in the app:

```typescript
export function call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
	const id = correlator.nextId();
	const promise = correlator.track<T>(id);
	connection.send({ type: 'req', id, method, params });
	return promise;
}
```

### Frame routing

```typescript
connection.onFrame((frame: Frame) => {
	if (correlator.handleFrame(frame)) return;
	eventBus.handleFrame(frame);
});
```

Responses go to the correlator (resolving promises), events go to the EventBus (dispatching to subscribers).

### Hello-ok callback

When hello-ok arrives, the store:

1. Hydrates `snapshot` from the payload
2. Subscribes `snapshot` and `canvasStore` to the EventBus
3. Registers as a virtual canvas node via `canvas.bridge.register`
4. Stores the device token from `helloOk.auth.deviceToken`
5. Starts tick health monitoring via `reconnector.onConnected()`

### Pairing state

Exposed as `pairingState: Readable<PairingState>` with status `idle | waiting | approved | timeout`. When the gateway returns close code 1008, the store retries up to 10 times at 3-second intervals, waiting for device approval.

### Connection health summary

`getConnectionSummary()` returns a snapshot for diagnostics export:

```typescript
{
  timestamp, connectionState, connId, networkOnline,
  reconnect: { attempt, maxAttempts, exhausted, tickIntervalMs },
  requests: { total, pending, timeouts, errors, successRate },
  log: diagnosticLog.summary()
}
```

### Dev debugging

In dev mode, `window.__oc` exposes `call`, `connection`, `snapshot`, `eventBus`, `canvasStore`, and test helpers for canvas surfaces.

## Chat store

**File:** `src/lib/stores/chat.ts`

Factory function `createChatSession(sessionKey)` returns a session-scoped store. Each active chat session gets its own instance with independent state.

### Returned interface

```typescript
{
  messages: Readable<ChatMessage[]>,
  activeRunId: Readable<string | null>,
  isStreaming: Readable<boolean>,
  isLoadingHistory: Readable<boolean>,
  hasActiveRun: Readable<boolean>,
  pendingQueue: Readable<string[]>,
  replyTo: Readable<ChatMessage | null>,
  send(message: string, files?: File[]): Promise<void>,
  setReplyTo(message: ChatMessage | null): void,
  addReaction(messageId: string, emoji: string): Promise<void>,
  removeReaction(messageId: string, emoji: string): Promise<void>,
  abort(): Promise<void>,
  retry(messageId: string): Promise<void>,
  insertDivider(content?: string): void,
  loadHistory(): Promise<void>,
  reconcile(): Promise<void>,
  destroy(): void,
  streamManager: AgentStreamManager
}
```

### Message lifecycle

1. **User sends** -- optimistic: user message added with `status: 'sending'`
2. **RPC succeeds** -- `chat.send` returns `{ runId }`, message updated to `status: 'sent'`
3. **Stream starts** -- `messageStart` event creates assistant placeholder with `status: 'streaming'`
4. **Deltas arrive** -- `delta` events update `content` and `thinkingText`
5. **Tools run** -- `toolCall`/`toolResult` events populate `toolCalls[]`
6. **Stream ends** -- `messageEnd` sets `status: 'complete'` or `status: 'error'`

### Safety mechanisms

- **60-second timeout**: if no `messageEnd` arrives within 60 seconds, the run is force-ended with an error
- **Pending queue**: messages sent while disconnected are queued and flushed on reconnect
- **Deduplication**: incoming messages are deduplicated by ID
- **Internal message filtering**: messages starting with `[System Message]` or `[system]` are hidden

### Event subscriptions

Each session subscribes to:

- `agent` events via `AgentStreamManager`
- `chat.message` -- incoming messages from other users or Discord
- `chat.message.update` -- message edits
- `chat.reaction` -- reaction add/remove

### Reactions

Reactions use optimistic updates with rollback on failure:

```typescript
async function addReaction(messageId: string, emoji: string): Promise<void> {
  // Optimistic: add reaction immediately
  _messages.update(...)
  try {
    await call('chat.react', { sessionKey, messageId, emoji, action: 'add' });
  } catch {
    // Rollback
    _messages.update(...)
  }
}
```

## Sessions store

**File:** `src/lib/stores/sessions.ts`

Manages session lifecycle across all agents. Key exports:

| Export             | Type                           | Purpose                                 |
| ------------------ | ------------------------------ | --------------------------------------- |
| `sessions`         | `Readable<ChatSessionInfo[]>`  | All sessions from gateway               |
| `activeSessionKey` | `Readable<string \| null>`     | Currently selected session              |
| `filteredSessions` | `Readable<ChatSessionInfo[]>`  | Agent-filtered, search-filtered, sorted |
| `groupedSessions`  | `Readable<{ pinned, groups }>` | Time-grouped (Today, Yesterday, etc.)   |
| `selectedAgentId`  | `Readable<string \| null>`     | Active agent filter                     |
| `pinnedSessions`   | `Readable<string[]>`           | Pinned session keys                     |

### Session key format

Session keys follow the pattern: `agent:<agentId>:falcon:dm:fd-chat-<8hex>`

The `fd-` prefix identifies Falcon Dash sessions. The type segment (`fd-chat`) indicates session capabilities. Agents use this pattern to adapt their responses (e.g., rich markdown for `fd-chat` sessions).

### Operations

- `loadSessions()` -- fetches via `call('sessions.list', {})`, disambiguates display names
- `createSession(label?)` -- creates key, calls `sessions.patch`, reloads list
- `createSessionOptimistic(label?)` -- same but non-blocking (fire-and-forget)
- `renameSession(key, name)` -- calls `sessions.patch` with `label` parameter
- `deleteSession(key)` -- calls `sessions.delete` with `deleteTranscript: true`
- `setActiveSession(key)` -- persists to localStorage, clears unread count
- `togglePin(key)` -- persists pinned list to localStorage

### Event subscriptions

`subscribeToEvents()` registers two EventBus listeners:

1. `session` events (created/updated/deleted) trigger debounced `loadSessions()`
2. `chat.message` events increment unread counts and trigger notifications

### System session filtering

Sessions with keys containing `:cron:`, `:heartbeat:`, `:thread:`, or `:fd-chan-` are filtered from the main list. They appear in their respective feature views instead.

## Feature stores

### Threads (`src/lib/stores/threads.ts`)

Manages thread navigation within chat sessions. `activeThread` store tracks the currently open thread; `closeThread()` returns to the main view.

### Bookmarks (`src/lib/stores/bookmarks.ts`)

Message bookmarking with localStorage persistence.

### Chat search (`src/lib/stores/chat-search.ts`)

In-session message search with `searchQuery` and `searchResults` stores.

### Chat resilience (`src/lib/stores/chat-resilience.ts`)

`watchConnectionForChat()` monitors connection state changes and triggers `reconcile()` on the active chat session when reconnecting.

### Channels (`src/lib/stores/channels.ts`)

Discord-like channel system. `ensureDefaultChannel()` creates a `#general` channel per agent. `activeChannelId` persists to localStorage.

## PM stores

### pm-store (`src/lib/stores/pm-store.ts`)

Root PM store with availability detection and cache hydration:

```typescript
export const pmAvailable: Readable<boolean>;
export async function checkPMAvailability(): Promise<void>;
export async function hydratePMStores(): Promise<void>;
```

Caches domains, focuses, and projects in `Map` stores for fast lookup.

### pm-domains (`src/lib/stores/pm-domains.ts`)

Domain and focus CRUD operations against `/api/pm/domains` and `/api/pm/focuses`.

### pm-projects (`src/lib/stores/pm-projects.ts`)

Project CRUD, filtering, and activity loading against `/api/pm/projects` and `/api/pm/activities`.

### pm-operations (`src/lib/stores/pm-operations.ts`)

Higher-level PM operations (bulk updates, status transitions, search).

### pm-api (`src/lib/stores/pm-api.ts`)

HTTP helper (`pmGet`, `pmPost`, `pmPatch`, `pmDelete`) for PM REST API calls.

## Utility stores

| Store            | File                | Purpose                                            |
| ---------------- | ------------------- | -------------------------------------------------- |
| `heartbeat`      | `heartbeat.ts`      | Agent health monitoring state                      |
| `cron`           | `cron.ts`           | Cron job management state                          |
| `toast`          | `toast.ts`          | Toast notification queue (`addToast()`)            |
| `notifications`  | `notifications.ts`  | Notification center (sound, browser notifications) |
| `discord`        | `discord.ts`        | Discord sync status                                |
| `diagnostics`    | `diagnostics.ts`    | Connection health metrics (`tickHealth`)           |
| `token`          | `token.ts`          | Gateway token and URL persistence (localStorage)   |
| `viewport`       | `viewport.ts`       | `isMobile` responsive detection                    |
| `exec-approvals` | `exec-approvals.ts` | Exec approval request queue                        |
| `agent-identity` | `agent-identity.ts` | Agent identity info and connection state           |
| `canvas`         | `canvas.ts`         | CanvasStore (surfaces, bridge status)              |
| `pinned-apps`    | `pinned-apps.ts`    | Pinned custom app panels                           |
| `editor`         | `editor.ts`         | Document editor state                              |
| `files`          | `files.ts`          | Document browser state                             |
| `passwords`      | `passwords.ts`      | Password vault state                               |

## Patterns

### EventBus subscription with cleanup

Stores that subscribe to EventBus events follow a consistent pattern -- subscribe in an init function and collect unsubscribe callbacks:

```typescript
let unsubscribers: Array<() => void> = [];

export function subscribeToEvents(): void {
	unsubscribeFromEvents();
	unsubscribers.push(
		eventBus.on('some.event', (payload) => {
			// handle event
		})
	);
}

export function unsubscribeFromEvents(): void {
	for (const unsub of unsubscribers) unsub();
	unsubscribers = [];
}
```

### Store-to-component bridging (Svelte 5)

Components use `$effect` to bridge Svelte stores into Svelte 5 runes:

```svelte
<script lang="ts">
	import { someStore } from '$lib/stores/example.js';
	let value = $state(initialValue);

	$effect(() => {
		const unsub = someStore.subscribe((v) => {
			value = v;
		});
		return unsub;
	});
</script>
```

### Gateway call pattern

All RPC calls go through the `call<T>()` function:

```typescript
import { call } from '$lib/stores/gateway.js';

const result = await call<{ sessions: Array<Record<string, unknown>> }>('sessions.list', {});
```

The generic type parameter provides TypeScript typing for the response payload.
