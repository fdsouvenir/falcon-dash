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

## Mobile UX

- **2026-03-13 (Claude):** The `MobileShell` BottomTabBar had 5 tabs (Home, Projects, Jobs, Docs, Channels) but 7 pages were completely inaccessible — Ops, Skills, Passwords, Secrets had no mobile nav entry. The "More" tab was conditionally rendered only when pinned apps existed. Fix: always show "More" tab, add Navigate section to MoreSheet.
- **2026-03-13 (Claude):** The Ops page uses a side-by-side `ProcessList` + `ProcessDetail` layout that breaks at 375px. On mobile, use the `isMobile` store from `$lib/stores/viewport.js` to switch to list-OR-detail mode with a back button. The store uses `matchMedia('(max-width: 767px)')` so it only fires on threshold crossings.
- **2026-03-13 (Claude):** `EntryList.svelte` had a pre-existing `svelte/require-each-key` lint error on the breadcrumbs `{#each}` (line 80) that blocks commits via the pre-commit hook. Added `(crumb.path)` key expression to fix.

## Cloudflare Access / Remote Access

- **2026-03-13 (Claude):** The Gateway Control tab iframed `http://127.0.0.1:28789` directly. This breaks behind Cloudflare Access because: (1) Cloudflare's CSP (`default-src 'self'`) blocks cross-origin iframes, and (2) the browser can't reach loopback from a remote session. Fix: server-side reverse proxy at `/api/gateway/proxy/[...path]` makes the Control UI same-origin. WebSocket proxying is not yet implemented — the Control UI's WS connections may need a follow-up if the UI relies on them for real-time updates.
- **2026-03-14 (Claude):** SvelteKit server routes cannot proxy WebSocket upgrade requests — the Control UI iframe shows disconnected (1006). Fix: route `/setup` through Cloudflare Tunnel directly to the gateway at port 28789, bypassing SvelteKit entirely. In dev, fall back to the HTTP-only proxy at `/api/gateway/proxy/`. Controlled by `GATEWAY_CONTROL_PATH` env var. **Gotcha:** The gateway sends `X-Frame-Options: DENY` and `frame-ancestors 'none'` — a Cloudflare Transform Rule is needed to strip/rewrite these headers on the `/setup` path so the iframe isn't blocked.

## Decisions

_(Add architectural and design decisions here as they are made.)_

## PM Activity Feed

- **2026-03-11 (Claude):** The PM activity feed was inline in `ProjectDetail.svelte` (lines 722-744) — not a separate component. Extracted to `src/lib/components/pm/ActivityFeed.svelte` to enable independent testing and reuse.
- **2026-03-11 (Claude):** `updateProject()` in `crud.ts` logged a generic `action: 'updated'` with no details. Fixed to capture old values before the DB write and build a change summary (`"Status: todo → in_progress; Priority: normal → high"`). Pure status-only changes now use `action: 'status_changed'` (already in the schema's CHECK constraint).
- **2026-03-11 (Claude):** `updatePlan()` logged `"Status changed to X"` without the old value. Fixed to log `"old → new"` using `currentPlan.status` (already fetched at function start).
- **2026-03-11 (Claude):** Batch collapsing in the activity feed groups consecutive entries with the same `action:target_id` key within a 60-second window. Implemented in the frontend only — no backend grouping needed since we sort by `created_at DESC` and group in `$derived.by()`.
- **2026-03-11 (Claude):** Plan links in the activity feed use a callback prop (`onPlanClick`) rather than URL navigation — project detail is a state-driven component with no URL route per project. The handler switches to the Plans tab and calls `scrollIntoView` on `#plan-{id}` after a 50ms tick.
- **2026-03-11 (Claude):** There is no `src/routes/projects/[id]/+page.svelte` — project detail is rendered inline within `/projects` via a state variable `selectedProjectId`. No URL-based plan routes exist.

## KeePassXC Vault

- **2026-03-05 (Claude):** `keepassxc-cli ls` with an empty vault returns empty output with exit 0 — parse defensively, filter blank lines.
- **2026-03-05 (Claude):** `keepassxc-cli show --show-protected` is required to retrieve password values; without `-s` the Password field is omitted from output.
- **2026-03-05 (Claude):** `keepassxc-cli add` / `edit` use `-p` / `--password-prompt` to read the entry password from stdin. Pipe the password string + newline to the child process's stdin.
- **2026-03-05 (Claude):** `keepassxc-cli ls` without `-R` lists only immediate children in the given group. Groups are suffixed with `/`, bare names are entries. Use this to build the group tree incrementally.
- **2026-03-05 (Claude):** The exec provider secret resolver (`bin/keepassxc-secret-resolver.cjs`) caches `keepassxc-cli show` output per entry within a single invocation to avoid redundant CLI calls when multiple fields of the same entry are requested.
- **2026-03-05 (Claude):** Entry paths use `/` as the group separator matching KeePassXC's internal path format. URL-encode the path when using it in REST routes — the `[...path]` catch-all receives the decoded string automatically via SvelteKit.
