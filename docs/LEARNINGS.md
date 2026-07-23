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
- **2026-07-22 (Claude):** OpenClaw capability audit for the v3 one-aggregate Automaton contract (full results: #332 comment). Verdict: implementable today against openclaw 2026.7.1-2. Key discoveries: `cron.add` now takes a first-class `payload` (`systemEvent`/`agentTurn`/`command`) so the old "payload body gap" was UI-only; `cron.update` accepts `{id, patch, expectedConfigRevision}` giving real optimistic concurrency (`configRevision` is an opaque token over the definition excluding scheduler state); `cron.runs` is a rich filterable history query; a `cron` gateway event fires on run/job changes (payload granularity undocumented — diff `configRevision` on receipt). Restore creates a new runtime id, so Falcon must re-bind extension attributes and record lineage.
- **2026-07-22 (Claude):** v3 implementation architecture chosen and documented in `docs/Technical/v3/06-implementation-architecture.md`; #332 decomposed into sequenced issues #333–#342 (foundation → transport → Task slice → CLI → knowledge → governance → projects → Automaton ∥ → Mission Control → cutover). Notable decisions: two-phase transition engine (async pre-guards can't share a better-sqlite3 tx — source-ref resolution and Automaton ops are async); `/api/v3` is bearer-only and can never mint a person actor (localhost CLI bypasses Cloudflare Access, so "no bearer = person" would let agents act as Fred — person actorship is the in-process UI path only); ambient context is gateway-plugin brief injection, not v2's symlinked markdown mirror; CLI is `falcon` on axi-sdk-js (pinned 0.x) + @toon-format/toon v4, TOON rendered CLI-side, HTTP stays JSON.

## Work v3

- **2026-07-22 (Claude):** work3 foundation (#333): numbered `.sql` migration files load cleanly via `import.meta.glob('./migrations/**/*.sql', { eager: true, query: '?raw', import: 'default' })` — works identically under vitest and the SvelteKit build, so migrations stay real SQL files per doc 06 without a custom bundling step.
- **2026-07-22 (Claude):** The recurring `better-sqlite3` "Module did not self-register" failure (previously noted on `work/migration.test.ts`) was an ABI mismatch; `npm rebuild better-sqlite3` fixed it and the whole suite now passes. If it reappears after a Node upgrade, rebuild again.
- **2026-07-22 (Claude):** Engine semantic no-ops (repeating an already-achieved transition) deliberately skip the envelope version bump AND event emission — returning `noop: true` with the current version. Idempotency-key replay is a different mechanism: it returns the stored original result (including its original event ids) flagged `replayed: true`, and post-commit side effects (bus emit, outbox kick) are skipped on replay so events are never double-published.
- **2026-07-22 (Claude):** #334 actor/transport: `resolveBearerActor` is constructed so a bearer credential can only ever yield an `agent` actor — person actorship is exclusively `person.ts` (in-process operator-UI path, label from `Cf-Access-Authenticated-User-Email`). The human-authority pre-guard (`humanAuthorityPreGuard`) is pluggable: `setAuthoritySourceResolver()` will point at gateway chat history once source-ref resolution lands (#337); until then presence+shape are enforced and resolution defaults to accept. Re-minting a token for an agent revokes the previous one (one active token per agent keeps `<data>/tokens/<agent>.token` semantics simple).
- **2026-07-22 (Claude):** #335 slice: the engine's `registerCommand` must be non-generic (accept `CommandDefinition<unknown>`) — inferring TResult from the execute callback makes TypeScript unify the semantic-no-op branch's literal types with the mutation branch and every command fails to typecheck. Callers get typing via `executeCommand<T>` instead.
- **2026-07-22 (Claude):** Playwright against the dev server: `wait_for_load_state('networkidle')` never fires because the app holds SSE connections open — use timed waits or selector waits. Also `page.content()` does not serialize live DOM input values (client-side `applyAction` sets properties, not attributes), so "form input preserved" assertions need `input_value()`, not HTML matching.
- **2026-07-22 (Claude):** Version-conflict recovery pattern for /work3 forms: the action catches Work3Error, re-reads the current projection, and returns `fail(400, {error, values, command, current_version})`; `use:enhance` applies the failure without invalidating load data, so the stale form stays rendered with the user's typed values repopulated from `values` and a refresh hint showing the new version.
- **2026-07-22 (Claude):** #336 falcon CLI: axi-sdk-js@0.1.8 (pinned exact) handles dispatch/help/version/update; we bypass its bundled TOON (v2) and render with @toon-format/toon@4.0.0 directly — commands return pre-rendered strings so only one TOON version ever touches output. TOON/JSON semantic equivalence is testable via toon v4's `decode()`. The SDK auto-derives the version from the nearest package.json (no version wiring needed in the bundle). Bundled `bin/falcon.js` must be in eslint ignores.
- **2026-07-22 (Claude):** CLI agent identity resolution (doc 06 open question, resolved): the bearer token IS the agent identity server-side, so the CLI only needs token discovery — `FALCON_DASH_TOKEN` env → `~/.config/falcon-dash/cli.json` → token files under `<data-dir>/tokens/`; with multiple token files `FALCON_AGENT_ID` selects one, and the ambiguous case fails loudly listing candidates. No separate host-token+attribution fallback needed.
- **2026-07-22 (Claude):** CLI verbs auto-pin optimistic concurrency: `falcon task start t3` fetches the current envelope version (one GET) then sends it as expected_version; `--expect-version` overrides for scripted retries. The server still enforces — the fetch just makes the happy path one command.
- **2026-07-23 (Claude):** #337 source-ref resolution: `chat.message.get` (openclaw dist, `{sessionKey, messageId}` → `{ok, message?, unavailableReason: not_found|oversized|not_visible}`) is the message-resolution primitive — message refs are `sessionKey#messageId`. `oversized` still proves existence (available). Gateway down → refs report `gateway_unreachable` and authority-creating commands fail closed; the agent's escape hatch is routing through the operator UI (person session needs no ref).
- **2026-07-23 (Claude):** Source-ref kinds without a resolver (commit, external tickets) report `unverifiable_kind` — honest "cannot verify", never available. `human_statement` refs need a `label` quoting the statement (the recorded statement is the native record when it wasn't a gateway message); a `#` in the ref upgrades them to gateway message resolution.
- **2026-07-23 (Claude):** #338 governance: Plan revisions don't fit the generic `appendRevision` helper — `is_current` must track the _current applicable_ revision (a submitted revision stays current while a revise-draft is open; the draft becomes current only on submit, which is also when the prior revision flips to superseded). Plan revisions are managed with explicit state transitions instead.
- **2026-07-23 (Claude):** Authorization effectiveness is fully derived (`authorizationEffectiveness` in read/governance-derived.ts): revoked/consumed/expired from the grant row, invalidated by comparing pinned change-revision id, plan-revision id, and scope fingerprint (sha256 over scope/targets/risk) against the subject's current state. The same function backs guards AND projections so gate-2 divergence is impossible. `create_change` creates its Plan atomically (the authority-ready package "includes the current Plan") — solves the chicken-and-egg of plan.work_item_id.
- **2026-07-23 (Claude):** #339 relationships: the typed link table stores only depends_on/contributes_to/satisfies/implements/derived_from/related_to — blocks stays the specialized Blocker record, and supersedes/answers/authorizes stay specialized fields/artifacts (doc 01's "specialized records" rule wins over doc 03 listing them in the vocabulary; projections may render them as relationships). Doc 01 prohibits `relates_to`; doc 03's `related_to` is the sanctioned last-resort variant, excluded from every derived calculation.
- **2026-07-23 (Claude):** Reconciliation is wired into the terminal commands themselves (task complete/cancel, question answer/withdraw, decision decide/withdraw, change succeed/cancel) via `reconcile.ts`: clears project current-next pointers (emitting project_next_item_cleared — the Project deliberately becomes health-unknown, an explicit actionable inconsistency), auto-resolves blockers sourced from SUPPORTIVE terminals (completed/answered/decided/succeeded) and leaves ambiguous ones (cancelled) active. Sed-style bulk patches against prettier-formatted files silently miss — always grep for the declaration AND the use site after batch edits.
- **2026-07-23 (Claude):** #340 correction to the 2026-07-22 capability audit: the installed openclaw 2026.7.1-2 gateway has NO `expectedConfigRevision`/`configRevision` — `cron.update` is `{id, patch}` (verified in dist source; `updateWithPrecondition` exists internally but its precondition is a server-side callback, not a client CAS token). Automaton optimistic concurrency is Falcon-side: compare caller `expected_runtime_updated_at_ms` to live `job.updatedAtMs` before patching (accepted race window). Doc 06 updated.
- **2026-07-23 (Claude):** Real-gateway cron validations discovered in #340 verification: `payload.kind: "systemEvent"` is only allowed with `sessionTarget: "main"` (isolated/current/session-key targets require `agentTurn` or `command`). `cron.get` returns the job directly; `cron.list` returns `{jobs}`; `cron.runs` returns `{entries}`. Direct `openclaw cron edit` changes appear on Falcon read-through immediately (one-aggregate confirmed live). Restore produces a new job id — attrs re-bind with lineage on both old and new ids.
- **2026-07-23 (Claude):** Automaton engine shape: gateway RPCs run in async pre-guards, stashing results in a WeakMap keyed by the payload object; the sync transaction consumes them immediately after (no interleaving is possible between the last awaited pre-guard and the synchronous tx). Automatons reuse the OpenClaw job id as their entities-row id — no Falcon prefix, satisfying "no separate Falcon id" while keeping FK compatibility for blockers/relationships.
