# falcon-dash

Web dashboard for the OpenClaw AI platform. Connects to the OpenClaw Gateway via WebSocket.

## Tech Stack

- **SvelteKit 2** + **Svelte 4** + **TypeScript** (strict)
- **Tailwind CSS 3** for styling
- **PWA** via vite-plugin-pwa
- **State:** Svelte writable/readable stores

## Critical: Svelte 4 Syntax

This project uses **Svelte 4**, NOT Svelte 5. Use:
- `on:click`, `on:input`, `on:submit` (NOT `onclick`, `oninput`)
- `export let prop` for component props (NOT `$props()`)
- `$:` reactive declarations (NOT `$derived()` or `$effect()`)
- `{#if}`, `{#each}`, `{#await}` blocks

## Formatting & Linting

- **Prettier:** tabs, single quotes, no trailing commas
- **ESLint:** svelte plugin + typescript-eslint
- Always run `npm run format` before committing
- `{@html}` requires `<!-- eslint-disable svelte/no-at-html-tags -->` comment
- Avoid `as EventListener` cast (triggers ESLint no-undef) — use wrapper functions

## Build Commands

```bash
npm run check    # svelte-check — must be 0 errors
npm run lint     # prettier --check + eslint
npm run build    # vite build (SSR + client)
npm run format   # prettier --write
npm run dev      # dev server on localhost:5173
```

## Folder Structure

```
src/
├── lib/
│   ├── gateway/          # WS client layer
│   │   ├── types.ts      # Protocol types
│   │   ├── connection.ts # WS lifecycle + state machine
│   │   ├── correlator.ts # Request/response correlation
│   │   ├── events.ts     # Event bus
│   │   ├── snapshot.ts   # Snapshot store (presence, health)
│   │   ├── auth.ts       # Token + device identity
│   │   ├── client.ts     # Public GatewayClient API
│   │   └── index.ts      # Barrel export
│   ├── stores/           # Svelte stores
│   ├── components/       # Shared UI components
│   └── utils/            # Helpers
├── routes/
│   ├── +layout.svelte    # App shell
│   └── +page.svelte      # Landing page
└── app.html
```

## Gateway WS Protocol

- **URL:** `ws://127.0.0.1:18789` (default)
- **client.id:** must be `"openclaw-control-ui"` (gateway validates)
- **client.mode:** must be `"webchat"`
- **Protocol version:** `3`
- **Frame types:** `req`, `res`, `event`
- **First frame:** must be `connect` request
- **Tick interval:** 30s (`policy.tickIntervalMs`), timeout at 2x = 60s
- **Reconnection:** exponential backoff, 800ms base, 1.7x multiplier, 15s cap
- **Dev auth:** set `gateway.controlUi.allowInsecureAuth: true` for token-only

## Connection State Machine

```
DISCONNECTED → CONNECTING → AUTHENTICATING → CONNECTED → READY
                                           → PAIRING_REQUIRED
                                           → AUTH_FAILED
READY → RECONNECTING → CONNECTING (loop)
```

## Key Patterns

- Singleton services and gateway client
- Barrel exports from index.ts in each directory
- Connection store bridges gateway to Svelte components
- All gateway interaction goes through GatewayClient.call() or .on()

## Reference Docs

- `builddocs/falcon-dash-architecture-v02.md` — full architecture
- `builddocs/ws-protocol.md` — WS protocol reference
- `builddocs/pm-spec.md` — PM specification
