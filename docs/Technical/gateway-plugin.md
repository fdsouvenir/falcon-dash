# Gateway plugin

This document describes the `falcon-dash-plugin/` OpenClaw gateway plugin that extends the gateway with Falcon Dash-specific functionality.

See also:

- [Gateway protocol](gateway-protocol.md) -- the protocol the plugin extends
- [Architecture overview](architecture.md) -- where the plugin sits in the system
- [Stores](stores.md) -- client-side `canvasStore` that consumes plugin methods

## Plugin purpose

The falcon-dash-plugin is an OpenClaw gateway plugin (ID: `falcon-dash-plugin`) with three responsibilities:

1. **Channel registration** -- registers a `falcon` channel (aliases: `fd`, `falcon-dash`) so chat sessions use `falcon:dm:` key prefixes instead of generic `webchat` keys
2. **Canvas bridge** -- bridges dashboard operators into the canvas pipeline, allowing agents to present canvas surfaces to the dashboard UI
3. **Context injection** -- injects Falcon Dash awareness and peer agent information into every agent prompt

## Plugin entry point

**File:** `falcon-dash-plugin/src/index.ts`

```typescript
const plugin: OpenClawPluginDefinition = {
	id: 'falcon-dash-plugin',
	name: 'Falcon Dashboard',
	description: 'Channel plugin and canvas operator bridge for Falcon Dash',
	version: '0.2.0',

	activate(api) {
		registerFalconDashChannel(api);
		registerCanvasBridge(api);

		api.on('before_prompt_build', (_event, ctx) => {
			return {
				prependContext: buildContext(api, ctx.agentId)
			};
		});
	}
};
```

The `activate` function is called once when the gateway loads the plugin. It:

1. Registers the channel
2. Registers the canvas bridge methods
3. Hooks into `before_prompt_build` to inject context

## Channel registration

**File:** `falcon-dash-plugin/src/channel.ts`

The channel registration declares Falcon Dash as a full channel provider with 10 adapter slots populated (out of 20+ available). The gateway uses these adapters to route messages, enable agent tools, manage streaming, and perform health checks.

### Core adapters

#### Capabilities

Declares what the Falcon Dash client supports:

```typescript
capabilities: {
	chatTypes: ['direct'],
	threads: true,
	reactions: true,
	reply: true,
	edit: true,
	media: true,
	blockStreaming: true,
	polls: true
}
```

The gateway uses these flags to decide which events and features to enable for the channel.

#### Config

Single-account setup — always returns a `default` account:

```typescript
config: {
	listAccountIds: () => ['default'],
	resolveAccount: (_cfg, accountId) => ({
		accountId: accountId ?? 'default',
		enabled: true
	})
}
```

#### Outbound

Gateway delivery mode — messages are delivered through the gateway event system, not through an external service:

```typescript
outbound: {
	deliveryMode: 'gateway',
	sendText: async () => ({
		channel: 'falcon',
		messageId: `fd-${Date.now()}`
	})
}
```

### Threading adapter

Routes reply-to IDs and provides thread context to agent tools:

```typescript
threading: {
	resolveReplyToMode: () => 'all',
	allowExplicitReplyTagsWhenOff: true,
	buildToolContext: ({ context }) => ({
		currentChannelId: context.Channel ?? undefined,
		currentChannelProvider: 'falcon',
		currentThreadTs: context.MessageThreadId?.toString(),
		currentMessageId: context.CurrentMessageId,
		replyToMode: 'all',
		skipCrossContextDecoration: true
	})
}
```

- `resolveReplyToMode: 'all'` — always attach reply-to ID (appropriate for direct chats)
- `skipCrossContextDecoration: true` — no `[from X]` prefix needed (single operator)
- Thread session keys follow the pattern `agent:{agentId}:falcon:dm:{parentId}:thread:fd-chat-{shortId}` (from `stores/threads.ts`)

### Message actions adapter

Enables agents to use message tools (react, reply, thread-create, edit, search, etc.):

```typescript
actions: {
	listActions: () => [...SUPPORTED_ACTIONS],
	supportsAction: ({ action }) => SUPPORTED_ACTIONS.includes(action),
	handleAction: async (ctx) => { /* returns success, lets gateway handle routing */ }
}
```

**Supported actions:** `send`, `react`, `reactions`, `reply`, `edit`, `thread-create`, `thread-reply`, `thread-list`, `search`, `read`, `sendAttachment`, `pin`, `unpin`, `list-pins`, `poll`, `sendWithEffect`

**Custom-handled actions:**

- `sendWithEffect` -- resolves the effect name to bubble/screen type, then broadcasts a `falcon.sendEffect` event with `sendEffect` metadata attached. The broadcast function is captured from the gateway context via `canvas.bridge.register`. The frontend's `ChatView.svelte` subscribes to `falcon.sendEffect` events globally and injects the message into the active chat session via `injectMessage()`, which triggers the corresponding visual effect (BubbleEffect or ScreenEffect component). A custom event is used instead of `chat.message` because the plugin doesn't have access to the frontend's active session key.

**Gateway-routed actions:** All other actions return a success result and let the gateway handle routing (appropriate for `deliveryMode: 'gateway'`).

**Excluded:** `unsend` (no delete-for-everyone UI), `broadcast` (no broadcast UI), group management actions (`chatTypes: ['direct']` only), Discord-specific actions.

### Streaming adapter

Controls how the gateway coalesces streaming text before delivery:

```typescript
streaming: {
	blockStreamingCoalesceDefaults: {
		minChars: 20,
		idleMs: 150
	}
}
```

The client-side `AgentStreamManager` uses accumulated text fields (`data.text`), so coalescing mainly affects network traffic. The `minChars` prevents single-char deltas; `idleMs` flushes after 150ms idle for smooth rendering.

### Agent prompt adapter

Provides the agent with tool hints about Falcon Dash messaging capabilities:

```typescript
agentPrompt: {
	messageToolHints: () => [
		'Falcon Dash supports: reactions (emoji), threaded replies, ...',
		'Use thread-create to start a threaded conversation. ...',
		'The operator sees rich markdown including code blocks, ...'
	];
}
```

This complements the `before_prompt_build` context injection (which covers rendering context). The adapter specifically teaches the agent about available message tools.

### Status adapter

Provides the gateway with channel health info for diagnostics:

```typescript
status: {
	buildAccountSnapshot: ({ account }) => ({
		accountId: account.accountId,
		enabled: true,
		configured: true,
		name: 'Falcon Dashboard'
	});
}
```

### Heartbeat adapter

Lets the gateway health check system know if a Falcon Dash client is connected:

```typescript
heartbeat: {
	checkReady: async ({ deps }) => {
		if (deps?.hasActiveWebListener?.()) {
			return { ok: true, reason: 'Gateway client connected' };
		}
		return { ok: false, reason: 'No Falcon Dash client connected' };
	};
}
```

### Adapters intentionally skipped

13 adapters are not implemented because Falcon Dash uses gateway-level auth/routing and operates as a single-operator dashboard:

| Adapter      | Reason                                                     |
| ------------ | ---------------------------------------------------------- |
| `setup`      | No onboarding flow — uses gateway auth directly            |
| `auth`       | Uses gateway token auth, no channel-specific auth          |
| `gateway`    | No external service lifecycle (no login/logout/start/stop) |
| `onboarding` | No setup wizard needed                                     |
| `pairing`    | Uses gateway device pairing, not channel-specific          |
| `security`   | DM policy enforced at gateway level                        |
| `elevated`   | No allowlist fallback needed                               |
| `directory`  | Single operator, no user/group directory                   |
| `resolver`   | Gateway handles routing for `deliveryMode: 'gateway'`      |
| `groups`     | Only `chatTypes: ['direct']` — no group chats              |
| `mentions`   | No @-mention system                                        |
| `messaging`  | Gateway routes by session key, not external user IDs       |
| `commands`   | Slash commands handled client-side                         |

### What this enables

Without the channel plugin, Falcon Dash sessions would use generic `webchat` channel keys. With the plugin:

- Session keys contain `falcon:dm:` (e.g., `agent:default:falcon:dm:fd-chat-a1b2c3d4`)
- Agents can identify Falcon Dash sessions by the `fd-` prefix and adapt responses accordingly (rich markdown, KaTeX, Mermaid diagrams)
- Agents have access to message tools (react, reply, thread, edit, search, pin)
- Streaming coalescing reduces network chatter for smooth rendering
- Gateway health checks know whether a dashboard client is connected
- Delivery mode is `gateway` — messages are delivered through the gateway event system, not through an external service

## Canvas bridge

**File:** `falcon-dash-plugin/src/canvas-bridge.ts`

The canvas bridge registers three gateway methods that allow dashboard operators to participate in the canvas pipeline. Without this plugin, operators cannot receive canvas commands from agents because the gateway's `node.invoke` system only routes to clients with the `node` role.

### `canvas.bridge.register`

Registers the calling operator as a virtual canvas node:

1. Validates the client has the `canvas` capability
2. Generates a stable virtual node ID: `virtual-canvas-<instanceId>` (the `instanceId` comes from the connect frame's `client.instanceId`, which is a stable per-tab UUID)
3. Cleans stale mappings -- removes previous virtual nodes for the same `instanceId` and sweeps all other virtual nodes (only one canvas dashboard should be active)
4. Creates a synthetic client object with `role: 'node'` and registers it with the gateway's `nodeRegistry`
5. Auto-pairs the virtual node by writing to `~/.openclaw/devices/paired.json` so agents discover it via `node.list`

Called by `src/lib/stores/gateway.ts` after every hello-ok:

```typescript
call<{ nodeId?: string }>('canvas.bridge.register', {})
	.then((result) => {
		canvasStore.setBridgeStatus({ registered: true, nodeId: result?.nodeId });
	})
	.catch((err) => {
		canvasStore.setBridgeStatus({ registered: false, error: String(err) });
	});
```

### `canvas.bridge.invokeResult`

Proxies invoke results from the dashboard back to the gateway's node registry:

1. Validates the operator has a registered virtual node
2. Normalizes the error format (dashboard may send string or `{ code, message }` object)
3. Calls `context.nodeRegistry.handleInvokeResult()` with the virtual node ID

This bypasses the gateway's `NODE_ROLE_METHODS` authorization check, which would otherwise reject the response because the operator's real role is `operator`, not `node`.

### `canvas.bridge.unregister`

Explicit cleanup:

1. Removes the virtual node from the gateway's node registry
2. Removes the entry from `~/.openclaw/devices/paired.json`

Called on:

- Tab close (`beforeunload` event)
- Explicit disconnect (`disconnectFromGateway()`)
- Before reconnection (best-effort)

### Virtual node lifecycle

```
1. Dashboard connects to gateway
2. hello-ok received
3. call('canvas.bridge.register') → virtual-canvas-<instanceId> created
4. Agent runs node.list → sees virtual-canvas-<instanceId>
5. Agent runs node.invoke → gateway routes to dashboard via canvas events
6. Dashboard receives node.invoke.request event
7. CanvasStore handles command, calls canvas.bridge.invokeResult
8. Tab closes → call('canvas.bridge.unregister') (best-effort)
```

### Stale node cleanup

The bridge aggressively cleans stale virtual nodes:

- **Per-instanceId dedup** -- if the same `instanceId` re-registers under a new `connId`, the old mapping is removed
- **Broad sweep** -- on register, all other virtual nodes are removed (only one dashboard should be active)
- **Paired store sweep** -- stale `virtual-canvas-*` entries in `paired.json` that do not correspond to active nodes are removed

## Context injection

**File:** `falcon-dash-plugin/src/context.ts`

The plugin hooks into `before_prompt_build` to prepend context to every agent prompt:

### Static context

Teaches agents about Falcon Dash:

- How to identify Falcon Dash sessions (session keys with `fd-` prefix)
- Available rendering capabilities: GFM markdown, KaTeX math, Mermaid diagrams, syntax-highlighted code, admonitions, collapsible sections
- Session type definitions (currently `fd-chat` for DM sessions)

### Dynamic peer context

If more than one agent is configured, the plugin reads `api.config.agents.list` and generates a peer agent section listing all other agents with their ID, emoji, and theme. This enables inter-agent collaboration via `sessions_send`.

Example output:

```markdown
## Peers

Collaborate with peer agents via `sessions_send` using their agent ID.

### Peer agents

- **Research Bot** (id: `agent-001`, emoji: magnifying_glass, theme: blue)
- **Writer** (id: `agent-002`, emoji: pencil)
```

## Build and install

```bash
# Build
cd falcon-dash-plugin
npm install
npm run build

# Install into gateway
openclaw plugins install ./falcon-dash-plugin

# Restart gateway to activate
systemctl --user restart openclaw-gateway
```

The plugin must be rebuilt and reinstalled after changes. The gateway loads plugins at startup.

## Relationship to the gateway process

The plugin runs inside the gateway process (not as a separate service). It has access to:

- `api.registerChannel()` -- register channel providers
- `api.registerGatewayMethod()` -- add new RPC methods
- `api.on()` -- hook into gateway lifecycle events
- `api.config` -- read the current OpenClaw configuration
- `api.logger` -- structured logging through the gateway's logger
- `context.nodeRegistry` -- direct access to the node registry for canvas bridging

The plugin does not have access to Falcon Dash's SvelteKit server or browser-side code. Communication between the plugin and the dashboard happens exclusively through gateway RPC calls and events.
