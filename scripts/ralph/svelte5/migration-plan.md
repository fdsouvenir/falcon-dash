# Svelte 4 → 5 Migration Plan

## Context

falcon-dash is an early-stage SvelteKit 2 dashboard (51 `.svelte` files, 14 store files). It currently runs Svelte 4.2.20. Since the codebase is small and there are existing errors to fix afterward, migrating now minimizes total rework. Svelte 5 has been stable since Oct 2024 and is the clear future of the framework.

## Strategy: Two-Phase Upgrade

**Phase A** — Upgrade dependencies only. Svelte 5 includes a legacy/compatibility mode that runs Svelte 4 syntax unchanged. This gives us a safe checkpoint.

**Phase B** — Run the official `sv migrate` tool, then manually fix what it can't handle. Migrate bottom-up (leaf components → containers → pages → layout).

**Stores stay as-is.** The 14 store files (`.ts`) use `writable`/`derived`/`readable` from `svelte/store`, which are fully supported in Svelte 5 with no deprecation. Runes only work in `.svelte`/`.svelte.ts` files, so migrating stores would require file renames for no real benefit.

**Rollback:** If Phase A breaks, revert `package.json` + `package-lock.json` and `npm install`. Everything is on a branch — `main` is untouched.

---

## Phase A: Dependency Upgrade (Legacy Mode)

### A1. Create migration branch

```
git checkout -b feat/svelte-5-migration
```

### A2. Upgrade packages

| Package                        | Current   | Target    | Notes                                                                                                   |
| ------------------------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `svelte`                       | `^4.2.20` | `^5`      | Core framework                                                                                          |
| `@sveltejs/vite-plugin-svelte` | `^3.1.2`  | `^5`      | v4 was the Svelte 5 preview/RC series; v5 is the stable release for Svelte 5. We intentionally skip v4. |
| `eslint-plugin-svelte`         | `^3.14.0` | `^3.14.0` | Already >=3.5 which added runes support. Run `npm update eslint-plugin-svelte` to ensure latest v3.x.   |
| `svelte-check`                 | `^4.3.6`  | `^4.3.6`  | Verify runes-aware type checking works. Bump if needed.                                                 |

Everything else stays unchanged — SvelteKit 2, vite 5, prettier-plugin-svelte 3 all already support Svelte 5.

```bash
npm install -D svelte@^5 @sveltejs/vite-plugin-svelte@^5 && npm update eslint-plugin-svelte svelte-check
```

### A3. Verify svelte.config.js

The `vitePreprocess` import may change path in `@sveltejs/vite-plugin-svelte` v5. Verify the import still resolves. If not, check the package's changelog for the new export path.

### A4. Verify legacy mode works

```bash
npm run check && npm run build && npm run lint && npm run test
```

All 51 `.svelte` files should compile without syntax changes in legacy/compatibility mode. Fix any issues before proceeding.

### A5. Commit checkpoint

Commit the dependency upgrade. The app now runs on Svelte 5 in legacy mode.

---

## Phase B: Syntax Migration

### B1. Run automated migration tool

```bash
npx sv migrate svelte-5
```

The tool auto-transforms:

- `export let` → `$props()`
- `let x = value` (reactive top-level) → `let x = $state(value)`
- Simple `$: x = expr` → `let x = $derived(expr)`
- Complex `$: { sideEffect }` → `$effect()` or `run()` from `svelte/legacy` (if intent is unclear)
- `on:click` → `onclick` (DOM elements)
- `<slot />` → `{@render children()}`
- Slot usage → snippet syntax

**What the tool does NOT handle reliably (requires manual work):**

- `createEventDispatcher` → callback props (too risky for automated migration)
- `beforeUpdate`/`afterUpdate` → `$effect.pre()`/`$effect()` (intent unclear)
- Event modifiers (`|preventDefault`, `|stopPropagation`)
- `$bindable()` annotations for props that accept `bind:`
- Multiple `on:event` handlers on same element
- Component event forwarding (`on:click` on a child component without explicit handler)

Then immediately verify:

```bash
npm run check && npm run build
```

If the tool generates `run()` calls from `svelte/legacy`, review each one — prefer converting to proper `$derived()`/`$effect()` rather than keeping the legacy helper.

### B2. Manual cleanup — pattern by pattern

#### Reactive state: `let` → `$state()`

In Svelte 5 runes mode, top-level `let` variables are NOT automatically reactive. They need `$state()`. The `sv migrate` tool handles this conversion. Manual review needed for:

- Mutable variables that drive template rendering must be `$state()`
- Arrays/objects need `$state()` for deep reactivity (Svelte 5 uses Proxy-based reactivity at runtime, not compile-time assignment tracking)

```ts
// Before (Svelte 4 — reactivity via assignment)
let count = 0;
let items = [];

// After (Svelte 5 — explicit $state)
let count = $state(0);
let items = $state<string[]>([]);
```

#### Props (`export let` → `$props()`)

~52 declarations across 26 files. The `sv migrate` tool handles most of these. Manual cleanup needed for:

- Adding `Props` interface with proper TypeScript types
- Components with `children` need `Snippet` import and type
- **`children` is a reserved prop name** in Svelte 5 — content inside component tags becomes the `children` snippet

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		open?: boolean;
		title?: string;
		children?: Snippet;
	}
	let { open = false, title = '', children }: Props = $props();
</script>
```

#### Bindable props: `$bindable()`

In Svelte 5 runes mode, props are NOT bindable by default (unlike Svelte 4's `export let`). Any prop that parents bind to via `bind:propName` must declare `$bindable()`:

```ts
// Component accepting bind:value
interface Props {
	value?: string;
}
let { value = $bindable('') }: Props = $props();
```

Search for all `bind:` usage on child components to identify which props need `$bindable()`. Key candidates:

- `bind:value` on form inputs within custom components
- `bind:this` for component refs (still works, but returns only exported functions)

#### Event dispatchers → callback props (21 components)

This is the highest-effort change. Each component + all its call sites must be updated together.

**Component side:**

```svelte
<!-- Before -->
const dispatch = createEventDispatcher<{ close: void; save: string }>();
dispatch('close');
dispatch('save', content);

<!-- After -->
interface Props {
  onclose?: () => void;
  onsave?: (content: string) => void;
}
let { onclose, onsave }: Props = $props();
onclose?.();
onsave?.(content);
```

**Call site side:**

```svelte
<!-- Before -->
<MyComponent on:close={handleClose} on:save={handleSave} />
<!-- After -->
<MyComponent onclose={handleClose} onsave={handleSave} />
```

**Critical: Remove `CustomEvent<T>` wrapper at call sites.** Parent handlers that typed params as `CustomEvent<T>` now receive the data directly:

```ts
// Before: function handleSave(e: CustomEvent<string>) { const val = e.detail; }
// After:  function handleSave(val: string) { ... }
```

**21 components to migrate** (with their dispatched events):

- BottomSheet (`close`), MobileMoreMenu (`close`), MobileTabBar (`more`)
- MessageComposer (`send`, `abort`), CommandPalette (`select`), ChatHeader, ChannelSettings (`close`)
- FileEditor (`save`, `cancel`), FileActions (`newfile`, `newfolder`), ConfirmDialog (`confirm`, `cancel`)
- CanvasFrame (`load`, `error`), A2UIHost
- CronJobForm, CronJobList
- KanbanBoard, PmSearch, PmSidebar, ProjectList, TaskDetail, BulkActions
- OnboardingWizard

#### Component event forwarding

Svelte 5 does NOT have automatic event forwarding. In Svelte 4, `<Button on:click />` on a component forwarded the event up without an explicit handler. In Svelte 5, this requires spreading rest props:

```svelte
<!-- Child component -->
let { onclick, ...restProps }: Props = $props();
<button onclick={onclick} {...restProps}>

<!-- Or spread everything -->
let { children, ...restProps }: Props = $props();
<button {...restProps}>
```

Search for any `on:eventname` on child Svelte components that don't have an explicit handler (bare forwarding). These need to be converted to explicit callback prop passing or rest-prop spreading.

#### Event modifiers — removed in Svelte 5

`|preventDefault`, `|stopPropagation`, `|once`, `|capture` no longer exist. Must wrap manually:

```svelte
<!-- Before -->
<form on:submit|preventDefault={handleConnect}>
<button on:click|stopPropagation={toggle}>

<!-- After -->
<form onsubmit={(e) => { e.preventDefault(); handleConnect(); }}>
<button onclick={(e) => { e.stopPropagation(); toggle(); }}>
```

For `|capture`, use the event name suffix: `onclickcapture={...}`

Files: `+page.svelte` (root), `CronJobForm`, `CronJobList` (×4), `BulkActions`, `files/+page`, `passwords/+page`

#### Multiple event handlers on same element

Svelte 4 allowed `on:click={one} on:click={two}`. Svelte 5 does NOT — must combine:

```svelte
<button onclick={(e) => { one(e); two(e); }}>
```

Search codebase for duplicate `on:` directives on the same element.

#### `afterUpdate` → `$effect` (4 files)

`afterUpdate` is deprecated in Svelte 5 runes mode. Replace with `$effect()`:

- `VirtualList.svelte` — scroll-to-end after item changes
- `MessageList.svelte` — auto-scroll to bottom
- `LogsViewer.svelte` — auto-scroll after log updates
- `chat/+page.svelte` — auto-scroll

**Important:** `$effect()` runs AFTER DOM updates (same timing as `afterUpdate`), but it only re-runs when its tracked dependencies change, unlike `afterUpdate` which ran after every update. Explicitly reference the dependencies:

```svelte
// Before
afterUpdate(() => { if (shouldScroll) el.scrollTop = el.scrollHeight; });

// After
$effect(() => {
  items.length; // explicitly track dependency
  tick().then(() => { if (shouldScroll) el.scrollTop = el.scrollHeight; });
});
```

#### `$effect` cleanup pattern

`$effect()` supports a cleanup return function, similar to React's `useEffect`. Any `onDestroy` cleanup that pairs with reactive side effects can be consolidated into the `$effect`:

```ts
// Before (Svelte 4)
onMount(() => {
	window.addEventListener('resize', handler);
});
onDestroy(() => {
	window.removeEventListener('resize', handler);
});

// After (Svelte 5 — optional improvement, not required)
$effect(() => {
	window.addEventListener('resize', handler);
	return () => window.removeEventListener('resize', handler);
});
```

This is an optional improvement — `onMount`/`onDestroy` still work. But where setup+teardown are tightly coupled to reactive state, `$effect` cleanup is cleaner.

#### `beforeUpdate` → `$effect.pre()` (if any)

Search for `beforeUpdate` usage. If found, replace with `$effect.pre()`.

#### `svelte-ignore` comment format (~42 comments)

Svelte 5 uses underscores instead of hyphens. Batch replace:

```bash
find src -name '*.svelte' -exec sed -i 's/svelte-ignore a11y-/svelte-ignore a11y_/g' {} +
```

#### Slots → `{@render}` (3 components)

- `+layout.svelte`: `<slot />` → `{@render children?.()}`
- `BottomSheet.svelte`: `<slot />` → `{@render children?.()}`
- `VirtualList.svelte`: `<slot {item} index={i} />` → `{@render children({ item, index: i })}`

VirtualList is the complex case — requires `Snippet<[{ item: T; index: number }]>` typing.

#### Touch events are passive by default

`ontouchstart` and `ontouchmove` are passive in Svelte 5. The app uses custom `use:swipe` and `use:longpress` actions — verify these don't call `e.preventDefault()` on touch events. If they do, they'll need to use `on` from `svelte/events` inside the action to register non-passive listeners.

Files to check: `src/lib/actions/` (swipe, longpress, pullToRefresh actions)

#### Event handler delegation gotcha

Svelte 5 delegates `onevent` handlers at the document root. If any code manually calls `stopPropagation()` on delegated events, other Svelte event handlers higher in the tree may not fire. Review any `stopPropagation` usage for correctness.

#### HTML structure enforcement

Svelte 5 is stricter about valid HTML (e.g., `<tr>` must be inside `<tbody>`). The build may surface new warnings/errors for invalid nesting. Fix any that appear.

#### Null/undefined rendering

Svelte 5 renders `null` and `undefined` as empty string (not the literal text "null"/"undefined"). This is generally better behavior but could change visible output if any templates relied on seeing "null" or "undefined".

#### CSS scoping change

Svelte 5 uses `:where(.svelte-xyz)` instead of `.svelte-xyz` for scoped styles. This changes specificity (`:where()` has zero specificity). If any component styles relied on specificity to override Tailwind, they may need adjustment. Also, Tailwind `@apply` inside scoped styles may need wrapping:

```css
main :global {
	@apply bg-blue-100;
}
```

### B3. No changes needed for:

- Store files (14 files in `src/lib/stores/`) — `writable`/`derived`/`readable` fully supported
- Gateway files (8 files in `src/lib/gateway/`) — only 2 use `svelte/store` types, which still work
- `bind:value`, `bind:this` on DOM elements — unchanged
- `class:` directives — unchanged
- `use:` actions — unchanged (but check passive touch events above)
- `{#if}`, `{#each}`, `{#await}` blocks — unchanged
- Transitions (`transition:fade`, `transition:fly`) — unchanged
- `$storeName` auto-subscriptions in `.svelte` files — unchanged
- `onMount`, `onDestroy` — still valid in Svelte 5

---

## Phase C: Finalize

### C1. Update CLAUDE.md

Replace "Critical: Svelte 4 Syntax" section with Svelte 5 patterns:

- `$state()` for reactive variables
- `$props()` for props (not `export let`)
- `$derived()` / `$effect()` for reactivity (not `$:`)
- `onclick` etc. (not `on:click`)
- Callback props for events (not `createEventDispatcher`)
- `{@render children()}` for slots (not `<slot />`)
- `$bindable()` for props that accept `bind:`

### C2. Update project memory

Update MEMORY.md to reflect Svelte 5.

### C3. Full verification

```bash
npm run format   # Fix formatting
npm run check    # 0 errors
npm run build    # Must succeed
npm run lint     # Must pass
npm run test     # Playwright e2e
```

### C4. Manual smoke test

Until the Playwright suite covers all modules, manual verification is needed:

- Gateway connection flow on `/`
- Chat: send, abort, command palette
- Mobile: tab bar, more menu, bottom sheet, swipe/longpress gestures
- Files: create, edit, save
- Projects: kanban, task detail
- Settings: all tabs
- PWA: service worker

Post-migration, expanding Playwright coverage to replace this manual checklist should be a priority.

---

## Migration order (bottom-up)

1. **Leaf components** (no dispatchers, no slots): ConnectionStatus, OfflineIndicator, RenderedContent, ThinkingBlock, ToolCallCard, MessageActionBar, MessageList, FilePreview, CronRunHistory, PmDashboard, settings tabs
2. **Dispatcher components** (21 files, migrated with their call sites)
3. **Slot components**: VirtualList, BottomSheet
4. **Pages**: all route `+page.svelte` files
5. **Layout**: `+layout.svelte`

---

## Key files to modify

- `package.json` — dependency versions
- `svelte.config.js` — verify import path
- `CLAUDE.md` — update syntax documentation
- All 51 `.svelte` files — syntax migration
- `src/lib/actions/` — verify passive touch event compatibility
- 0 store files — no changes
- 0 gateway files — no changes

## Risk mitigation

- **Rollback:** Everything is on a branch. If Phase A breaks, revert `package.json` + `package-lock.json` and `npm install`.
- The `sv migrate` tool may generate imperfect output → verify with `npm run check` after each step
- If the tool produces `run()` from `svelte/legacy`, convert to proper `$derived()`/`$effect()` instead
- `createEventDispatcher` migration must update both component AND all call sites atomically
- Component event forwarding (bare `on:click` on child components) needs explicit callback props or rest-prop spreading
- `afterUpdate` replacement may behave differently for scroll logic → test carefully
- `$effect()` tracks dependencies at runtime (not compile-time) — ensure all dependencies are referenced
- Touch gesture actions may break if they call `preventDefault()` → test on mobile
- CSS specificity changes from `:where()` scoping → verify no visual regressions with Tailwind
- `stopPropagation` in delegated event handlers → verify no lost events
