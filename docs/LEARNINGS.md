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

### Gateway protocol v4 migration (2026-06-28, Claude)

Gateway 2026.6.10 serves **protocol v4**; Falcon Dash hardcoded v3 and could not connect. Migration notes:

- **Negotiation is a range.** The gateway accepts a client when `maxProtocol >= 4 && minProtocol <= 4`. We now send `minProtocol: 3, maxProtocol: 4` (constants `MIN_PROTOCOL`/`MAX_PROTOCOL` in `gateway-client.ts`) to stay compatible with both v3 and v4 gateways. The negotiated version is read back from `helloOk.protocol`.
- **Device signing is still v2.** The gateway and its own control-ui both sign with the `v2|deviceId|clientId|clientMode|role|scopes|signedAt|token|nonce` format. No v3 sign-string exists in the installed gateway — do NOT speculatively emit v3 or connect auth breaks.
- **Many RPC methods were renamed or reshaped.** Confirmed against the installed binary + live `hello-ok.features.methods`:
  - `cron.create`→`cron.add`, `cron.delete`→`cron.remove`. **`cron.add` also reshaped:** `schedule` is now a discriminated object (`{kind:'cron',expr}` / `{kind:'every',everyMs}` / `{kind:'at',at}`), plus required `payload` (`{kind:'systemEvent',text}` / `{kind:'agentTurn',message}`), `sessionTarget`, and `wakeMode`. `cron.remove/update/run` accept `id` (anyOf `id`/`jobId`).
    `cron.list` keeps runtime times/status under `job.state`; `cron.update.patch` uses the same nested
    schedule/payload objects; and `cron.runs` returns `{entries}` with `ok`/`error`/`skipped` statuses.
    Human interval input must be parsed into integer milliseconds. `systemEvent` requires `main`,
    while `agentTurn` requires `isolated`, `current`, or `session:<id>`.
  - `agents-files.get/set`→`agents.files.get/set` AND params changed: `{agentId, name}` (not `path`); content is at `payload.file.content`.
  - `agents.stop` removed → `tasks.cancel {taskId}` (or `sessions.abort {sessionKey, runId}`).
  - `agents.list` now returns **configured agents** (`{agents:[...]}`), NOT runs. Agent runs live in the **task ledger**: `tasks.list` → `{tasks: TaskSummary[]}` (status `queued`/`running` = active). `tasks.cancel {taskId}` stops a run.
  - `heartbeat.status` removed. Heartbeat enabled/interval come from the `status` payload (`status.heartbeat.agents[]`); enable/disable via `set-heartbeats {enabled}` (global toggle only — interval/activeHours/deliveryTarget have no granular v4 RPC, they're gateway config). Template via `agents.files.*`.
    `last-heartbeat` returns one nullable event (`{ts,status,...}`), not an executions collection.
  - `info.status`→`status` (session count at `sessions.count`; no uptime field — use the hello-ok snapshot `uptimeMs`). `info.usage`→`usage.cost` (totals) + `usage.status` (provider list). `nodes.list`→`node.list`.
  - `skills.uninstall` removed (no RPC replacement; removal is a gateway config edit).
  - `config.get` dropped path-scoping (`{path:'heartbeat'}` is rejected); call with `{}` for the full config.
- **Event renames.** `session`→`sessions.changed` (broad invalidation, reload on any), `chat.message`→`session.message`. Check the snapshot's `features.events`.
- **Chat `deltaText`/`replace`** streaming deltas are a no-op for Falcon Dash — streaming chat was removed in the #288 pivot; nothing consumes them.
- **Plugin methods/events aren't in `features.methods`/`features.events`.** discord/telegram/canvas methods (e.g. `canvas.action`) are plugin-provided; the discord/telegram wizards already gate on `features.methods.includes(...)` and fall back to `config.apply`. `canvas.action` is unregistered in the gateway core — it belongs to the separate falcon-dash gateway plugin.
- **Gateway 2026.6.10 upgrade gotchas:** daemon refuses to host unless `gateway.mode: "local"` (was `remote`); `channels.{telegram,discord}.streaming` must be an object `{mode:"off"}` not the scalar `"off"`. `openclaw doctor --fix` migrates telegram but misses discord.

## Agent streams

- **2026-02-25 (Claude, seeded):** Tool events use `data.phase` (not `data.type`). Phases: `start`, `update`, `result`.
- **2026-02-25 (Claude, seeded):** Tool events can arrive before the `chat.send` RPC response — `handleMessageStart` creates an assistant placeholder early to prevent a race condition.
- **2026-02-25 (Claude, seeded):** Thinking events use `stream: "thinking"` (not `stream: "assistant"`). Fields: `data.text` (accumulated), `data.delta` (incremental).

## Dev environment

- **2026-03-03 (Claude):** `openclaw config get gateway.auth.token` always returns `__OPENCLAW_REDACTED__` — the CLI redacts sensitive values. Use CLI for port/bind (URL construction) but tokens must come from env vars or direct file read.
- **2026-03-03 (Claude):** Managed deployments write `OPENCLAW_GATEWAY_TOKEN` (not `GATEWAY_TOKEN`) to the env file. Both are now accepted. `GATEWAY_TOKEN` takes precedence if both are set.
- **2026-03-03 (Claude):** Never hardcode a default gateway port. The port comes from `openclaw config get gateway --json` or `~/.openclaw/openclaw.json`. The old default of 18789 caused connection failures on deployments using port 28789.
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
- **2026-02-25 (Claude):** `sendWithEffect` is agent→frontend only (no user-facing EffectPicker). The channel plugin's `handleAction` broadcasts a `falcon.sendEffect` event (custom event, not `chat.message`) with `sendEffect: { type, name }` metadata. `ChatView.svelte` subscribes globally and injects into the active chat session via `injectMessage()`. A custom event is needed because the plugin's `handleAction` doesn't have access to the frontend's active session key (`ctx.params.to` resolves to "operator", not the real session key). The broadcast function is captured from gateway context via `canvas.bridge.register` and stored module-level in `channel.ts`.

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

## Dashboard State Persistence

- **2026-03-03 (Claude):** Gateway snapshot's `uptimeMs` is a point-in-time value from when the _server_ connected. The browser must use `snapshotReceivedAt` (server timestamp injected as `_snapshotReceivedAt`) to compute correct uptime: `uptimeMs + (now - snapshotReceivedAt)`. Using `Date.now()` at browser connect time causes uptime to reset on page refresh.
- **2026-03-03 (Claude):** Activity events are buffered server-side in a ring buffer (max 50) on `GatewayClient` and replayed to new SSE connections. Replayed events carry `_timestamp` in the payload so the ActivityFeed shows original event times, not replay time. Buffer is cleared on gateway reconnect (stale events from a different connection aren't useful).

## Mobile UX

- **2026-03-13 (Claude):** The `MobileShell` BottomTabBar had 5 tabs (Home, Projects, Jobs, Docs, Channels) but 7 pages were completely inaccessible — Ops, Skills, Passwords, Secrets had no mobile nav entry. The "More" tab was conditionally rendered only when pinned apps existed. Fix: always show "More" tab, add Navigate section to MoreSheet.
- **2026-03-13 (Claude):** The Ops page uses a side-by-side `ProcessList` + `ProcessDetail` layout that breaks at 375px. On mobile, use the `isMobile` store from `$lib/stores/viewport.js` to switch to list-OR-detail mode with a back button. The store uses `matchMedia('(max-width: 767px)')` so it only fires on threshold crossings.
- **2026-03-13 (Claude):** `EntryList.svelte` had a pre-existing `svelte/require-each-key` lint error on the breadcrumbs `{#each}` (line 80) that blocks commits via the pre-commit hook. Added `(crumb.path)` key expression to fix.

## Cloudflare Access / Remote Access

- **2026-03-13 (Claude):** The Gateway Control tab iframed `http://127.0.0.1:28789` directly. This breaks behind Cloudflare Access because: (1) Cloudflare's CSP (`default-src 'self'`) blocks cross-origin iframes, and (2) the browser can't reach loopback from a remote session. Fix: server-side reverse proxy at `/api/gateway/proxy/[...path]` makes the Control UI same-origin. WebSocket proxying is not yet implemented — the Control UI's WS connections may need a follow-up if the UI relies on them for real-time updates.
- **2026-03-15 (Claude):** SvelteKit server routes cannot proxy WebSocket upgrade requests. Fix: `entry.js` hooks into the Node HTTP server's `upgrade` event and proxies WS connections on `/api/gateway/proxy` to the gateway using the `ws` library (same pattern as `/terminal-ws`). In dev, Vite's built-in proxy handles it with `ws: true`. No Cloudflare Tunnel or extra env vars needed.

## Decisions

_(Add architectural and design decisions here as they are made.)_

## KeePassXC Vault

- **2026-03-05 (Claude):** `keepassxc-cli ls` with an empty vault returns empty output with exit 0 — parse defensively, filter blank lines.
- **2026-03-05 (Claude):** `keepassxc-cli show --show-protected` is required to retrieve password values; without `-s` the Password field is omitted from output.
- **2026-03-05 (Claude):** `keepassxc-cli add` / `edit` use `-p` / `--password-prompt` to read the entry password from stdin. Pipe the password string + newline to the child process's stdin.
- **2026-03-05 (Claude):** `keepassxc-cli ls` without `-R` lists only immediate children in the given group. Groups are suffixed with `/`, bare names are entries. Use this to build the group tree incrementally.
- **2026-03-05 (Claude):** The exec provider secret resolver (`bin/keepassxc-secret-resolver.cjs`) caches `keepassxc-cli show` output per entry within a single invocation to avoid redundant CLI calls when multiple fields of the same entry are requested.
- **2026-03-05 (Claude):** Entry paths use `/` as the group separator matching KeePassXC's internal path format. URL-encode the path when using it in REST routes — the `[...path]` catch-all receives the decoded string automatically via SvelteKit.
- **2026-07-22 (Claude):** v3 contracts consolidated into `docs/Technical/v3/` from epic #326. Issue #324 was corrected in place — its early object sections had drifted from the later "Approved correction" sections (Decision has no draft state, Change review is not embedded state, Automaton is one OpenClaw-backed aggregate, Plan lifecycle vs derived Review disposition, no Evidence/Run objects). Added the missing actor-model contract to #327 (person/agent/system classes, person authority basis for authority-creating commands — no IAM) and the conversational-capture path to #329 (agent translates conversation into AXI commands; no NL-ingestion subsystem). #332 now requires an OpenClaw capability audit before Automaton work — the one-aggregate contract depends on gateway v4 RPCs that have known gaps (cron-create payload body, granular update RPCs).
