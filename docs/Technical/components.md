# Component Architecture

This document describes the current Svelte component and route structure. Visual rules live in
[../DESIGN.md](../DESIGN.md) and implementation constraints in [../FRONTEND.md](../FRONTEND.md).

## Shells and routing

`src/routes/+layout.svelte` is the application boundary. It starts gateway event delivery, keeps
viewport state current, and selects:

- `src/lib/components/AppShell.svelte` for the desktop application shell;
- `src/lib/components/mobile/MobileShell.svelte` for narrow viewports.

The current primary shell destinations are Work, Vault, Channels, and Labs/Settings. Standalone
routes such as Documents, Jobs, Skills, Agents, Approvals, Operations, and Heartbeat reuse the same
root shell. Do not document or reintroduce the removed Agent Rail or browser-direct chat shell.

Work has its own nested layout at `src/routes/work/+layout.svelte`. It owns navigation for Work,
Projects, Needs Resolution, Automations, and Browse. Child pages do not render another copy.

## Component layers

### Shared primitives

`src/lib/components/ui/` contains buttons, fields, inputs, selects, tabs, dialogs, sheets, badges,
and other reusable controls. Prefer these before adding feature-local variants. Shared controls own
keyboard, focus, labeling, disabled, invalid, and pending behavior.

### Work components

`src/lib/components/work/` contains the current Work vocabulary:

- glyphs and IDs for object identity;
- rows, sections, status tones, timelines, source references, and waiting states;
- manifest-driven command bars and forms;
- structured feedback, including stale-version recovery.

Object pages remain type-specific. Shared components provide interaction and anatomy, not a generic
record page that erases Questions, Decisions, Reviews, Authorizations, Changes, or Automations.

### Feature components

Feature-specific components live in focused directories such as `settings/`, `vault/`, `mobile/`,
`canvas/`, `channels/`, and `ops/`. A route page should primarily compose those components and
provide route-level data or navigation.

Some older components remain in the tree without being used by the current shell. File existence is
not proof of current product behavior; confirm imports and routes before documenting a surface.

## Data boundaries

- Page servers load durable Work data and execute human Work commands.
- Browser stores own transient or gateway-derived UI state.
- `src/lib/gateway-api.ts` is the browser adapter for server-side gateway RPC and SSE.
- Components never read gateway credentials, agent bearer tokens, KeePassXC files, or SQLite
  databases directly.
- Server-only modules stay under `src/lib/server/` and must not be imported into browser bundles.

## Svelte conventions

- Use Svelte 5 runes for local reactive state and effects.
- Keep component props typed. Use discriminated types when rendering domain variants.
- Return unsubscribe/cleanup functions from effects that subscribe, schedule, or allocate browser
  resources.
- Derive display state from canonical inputs rather than copying it into another writable store.
- Use URL state for navigational selections that must survive SSR, reload, or sharing.
- Use component-local generated IDs for repeated labeled regions.
- Keep route handlers in `+server.ts`, route loads/actions in `+page.server.ts`, and route UI in
  `+page.svelte`.

## Responsive behavior

The current product has a desktop and a basic responsive/narrow shell. A dedicated mobile product
is planned for v6. Current changes must still preserve usable narrow layouts, safe-area spacing,
focus order, and touch targets; they must not invent v6 navigation or feature semantics early.

When desktop and mobile use separate components, both are part of the current implementation and
must be tested. Shared data semantics should remain in stores, adapters, or server modules rather
than diverging between the two renderers.

## Review checklist

- Is this route reachable in the current shell or by a current direct link?
- Is server-only data kept out of the browser?
- Does an existing shared primitive or Work component already own the interaction?
- Are loading, empty, error, disconnected, pending, and long-content states explicit?
- Do keyboard, zoom, reduced-motion, and narrow-view behavior remain usable?
- Did the exact end-user and technical documents named in [../OWNERSHIP.md](../OWNERSHIP.md) change
  when behavior changed?
