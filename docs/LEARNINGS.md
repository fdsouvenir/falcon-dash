# Learnings

Running list of project discoveries, gotchas, architectural decisions, and things that were harder than expected. Both Frederic and Claude append here.

**Format:** `- **YYYY-MM-DD (who):** one-liner with optional detail`

---

## Gateway / Protocol

- **2026-02-25 (Claude, seeded):** `client.id` must come from a hardcoded enum in the gateway — custom IDs are rejected. Falcon Dash uses `openclaw-control-ui`.
- **2026-02-25 (Claude, seeded):** `allowInsecureAuth` only auto-approves Control UI connections, not backend/agent connections. Agent backend pairing is a separate process.
- **2026-02-25 (Claude, seeded):** Tool stream events require declaring `caps: ["tool-events"]` in the connect frame. Without it, tool events are silently dropped by the gateway.
- **2026-02-25 (Claude, seeded):** The connect frame uses string ID `'__connect'` (not numeric) to avoid collision with `RequestCorrelator`'s monotonic counter. Do not change this to a numeric ID.
- **2026-02-25 (Claude, seeded):** `webchat-ui` as client ID triggers `isWebchatClient()=true` regardless of mode — never use it for operator dashboards.

## Agent streams

- **2026-02-25 (Claude, seeded):** Tool events use `data.phase` (not `data.type`). Phases: `start`, `update`, `result`.
- **2026-02-25 (Claude, seeded):** Tool events can arrive before the `chat.send` RPC response — `handleMessageStart` creates an assistant placeholder early to prevent a race condition.
- **2026-02-25 (Claude, seeded):** Thinking events use `stream: "thinking"` (not `stream: "assistant"`). Fields: `data.text` (accumulated), `data.delta` (incremental).

## Dev environment

- **2026-02-25 (Claude, seeded):** No `.env` file is needed in local dev — gateway config is read from `~/.openclaw/openclaw.json` via the `/api/gateway-config` endpoint.
- **2026-02-25 (Claude, seeded):** Use `journalctl --user -u openclaw-gateway` for gateway logs. The `openclaw logs` command requires its own device pairing and is less practical.
- **2026-02-25 (Claude, seeded):** `window.__oc` exposes `call`, `connection`, `snapshot`, `eventBus`, and `canvasStore` for runtime debugging in the browser console.

## Channel adapters

- **2026-02-25 (Claude):** `AgentToolResult` (from `@mariozechner/pi-agent-core`) requires `content: TextContent[]` and `details: T` — not a simple `{ ok, data }` shape. The `handleAction` adapter must return this format.
- **2026-02-25 (Claude):** `api.logger.debug` may be undefined (optional on the `ChannelLogSink` type) — use `api.logger.info` instead for action logging.
- **2026-02-25 (Claude):** For `deliveryMode: 'gateway'` channels, `handleAction` can return a success result and let the gateway handle routing — no custom logic needed per action.
- **2026-02-25 (Claude):** 13 of 20+ channel adapters are unnecessary for Falcon Dash because it uses gateway-level auth/routing and operates as a single-operator dashboard. Only 7 adapters beyond the original 3 (config, capabilities, outbound) were needed.

## Polls & Send Effects

- **2026-02-25 (Claude):** `SvelteSet` must be used instead of `Set` in Svelte 5 reactive code — the `svelte/prefer-svelte-reactivity` lint rule enforces this. `SvelteSet` is already reactive, so wrapping it in `$state()` triggers `svelte/no-unnecessary-state-wrap`.
- **2026-02-25 (Claude):** Direct DOM manipulation (`document.createElement`) in Svelte components triggers the `svelte/no-dom-manipulating` lint rule. Use `{#each}` blocks with data arrays instead.
- **2026-02-25 (Claude):** Screen effects use CSS `@keyframes` with `animation` inline styles on generated particle arrays. Fireworks use `cos()/sin()` CSS functions with `--angle` custom properties for radial burst directions.
- **2026-02-25 (Claude):** `prefers-reduced-motion: reduce` is respected by both bubble effects (skipping animation) and screen effects (not generating particles at all via early `ondone()` call).
- **2026-02-25 (Claude):** Poll and sendWithEffect actions added to channel plugin's `SUPPORTED_ACTIONS` array. `polls: true` capability flag enables poll tool availability for agents.
- **2026-02-25 (Claude):** Gateway has a dedicated `poll` RPC method (params: `to`, `question`, `options`, `maxSelections`, `durationHours`, `channel`, `idempotencyKey`). Do NOT pass poll data via `chat.send` — the gateway rejects unknown properties with strict schema validation.
- **2026-02-25 (Claude):** `sendWithEffect` is agent→frontend only (no user-facing EffectPicker). The channel plugin's `handleAction` broadcasts a `chat.message` event with `sendEffect: { type, name }` metadata. The frontend's `handleIncomingMessage` picks up the metadata and triggers BubbleEffect/ScreenEffect rendering. The broadcast function is captured from gateway context via `canvas.bridge.register` and stored module-level in `channel.ts`.

## Channels & Session Management

- **2026-02-25 (Claude):** Channel data is stored in localStorage (`falcon-dash:channels`), NOT synced from the gateway. If localStorage is cleared, `ensureDefaultChannel()` must check `sessions.list` for existing `#general` sessions on the gateway before creating new ones — otherwise `sessions.patch` rejects the duplicate label.
- **2026-02-26 (Claude):** Channel protocol ID is `falcon` (with aliases `fd`, `falcon-dash`). Session keys use `falcon:dm:` prefix (e.g., `agent:main:falcon:dm:fd-chan-abc123`). The gateway infers the channel from the session key — `chat.send` does NOT pass an explicit `channel` param. Old `falcon-dash:dm:` sessions are orphaned after migration; no auto-pruning — clean up manually or let them accumulate.
- **2026-02-25 (Claude):** `selectedAgentId` store starts as `null` and is set by `AgentRail` after connection. The channel auto-creation `$effect` in `+layout.svelte` must trigger on BOTH `connectionState` and `selectedAgentId` changes — a subscribe-inside-subscribe pattern misses the case where one fires before the other.
- **2026-02-25 (Claude):** Switching agents in the rail must also switch the active channel to the new agent's default channel. Without this, the chat view shows the previous agent's messages with the new agent's name in the header.

## Chat History

- **2026-02-25 (Claude):** Gateway `chat.history` returns tool calls as `{ type: "toolCall", id, name, arguments }` content blocks on assistant messages, with separate `role: "toolResult"` messages containing `toolCallId`, `toolName`, `content`, `isError`. The `normalizeMessage()` function must pair these and build `ToolCallInfo[]` — otherwise they render as raw JSON.
- **2026-02-25 (Claude):** `extractTextContent()` must skip `toolCall` blocks (same as `thinking` blocks) to avoid empty string artifacts in the message content.

## Svelte 5 Gotchas

- **2026-02-25 (Claude):** `Math.random()` as an `{#each}` key causes `each_key_volatile` runtime errors in Svelte 5. Use index-based fallback keys like `` `prefix-${i}` `` instead.

## Decisions

_(Add architectural and design decisions here as they are made.)_
