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

## PM / context pipeline

- **2026-02-25 (Claude, seeded):** `BOOTSTRAP.md` lives at `{workspace}/.falcon-dash/BOOTSTRAP.md`, loaded by `bootstrap-extra-files` hook, not by Falcon Dash itself.
- **2026-02-25 (Claude, seeded):** `sync-peers.sh` self-heals: it recreates `BOOTSTRAP.md` if the file is missing or lacks `<!-- PEERS:START -->` / `<!-- PEERS:END -->` markers.
- **2026-02-25 (Claude, seeded):** On new agent creation, only `mkdir` the workspace directory — no need to provision `BOOTSTRAP.md` manually.

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
- **2026-02-25 (Claude):** `sendWithEffect` data is client-side only — the gateway `chat.send` RPC also rejects `sendEffect` as an unknown property. Effects are stored on the optimistic message and rendered locally.
- **2026-02-25 (Claude):** EffectPicker popover needs `z-50` to appear above the sidebar (`z-40`). Without it, the picker renders behind the sidebar's `<nav>` overlay on desktop.

## Decisions

_(Add architectural and design decisions here as they are made.)_
