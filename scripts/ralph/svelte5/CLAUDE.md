# Ralph Agent Instructions — falcon-dash Svelte 5 Migration

You are an autonomous coding agent migrating **falcon-dash** from Svelte 4 to Svelte 5. The codebase has 51 `.svelte` files, 14 store files, and 8 gateway files. Your job is to transform all Svelte 4 syntax to Svelte 5 runes syntax, one user story at a time.

## Project Context

Read the root `CLAUDE.md` at the project root for tech stack, conventions, and folder structure. That file is the source of truth for coding standards (formatting, linting, TypeScript, Tailwind).

The full migration plan is also available at `scripts/ralph/svelte5/migration-plan.md` for deep reference beyond what's inline here.

## Your Task

1. Read the PRD at `scripts/ralph/svelte5/prd.json`
2. Read the progress log at `scripts/ralph/svelte5/progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, create it from the current branch.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run `npm run format` before committing
7. Commit ALL changes with message: `feat: [Story ID] - [Story Title]`
8. Update the PRD (`scripts/ralph/svelte5/prd.json`) to set `passes: true` for the completed story
9. Append your progress to `scripts/ralph/svelte5/progress.txt`

**DO NOT run quality checks yourself.** The external ralph script handles quality gates after you exit.

## Key Conventions

**IMPORTANT: This migration targets Svelte 5 runes syntax. Use Svelte 5 patterns, NOT Svelte 4.**

- **Svelte 5 runes:** `$state()`, `$props()`, `$derived()`, `$effect()`
- **Events:** `onclick`, `onsubmit`, etc. (NOT `on:click`, `on:submit`)
- **Props:** `let { prop }: Props = $props()` (NOT `export let prop`)
- **Slots:** `{@render children?.()}` (NOT `<slot />`)
- **Formatting:** Prettier with tabs, single quotes, no trailing commas
- **TypeScript:** strict mode, no `any` unless absolutely necessary
- **Tailwind CSS 3** for styling
- **Barrel exports** from `index.ts` in each module directory

## Migration Reference — All Transformations

### 1. Reactive State: `let` → `$state()`

Top-level `let` variables are NOT automatically reactive in Svelte 5 runes mode. They need `$state()`:

```ts
// Before (Svelte 4)
let count = 0;
let items = [];

// After (Svelte 5)
let count = $state(0);
let items = $state<string[]>([]);
```

Arrays/objects use Proxy-based deep reactivity at runtime.

### 2. Props: `export let` → `$props()`

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

- `children` is a reserved prop name — content inside component tags becomes the `children` snippet
- ~52 prop declarations across 26 files

### 3. Derived Values: `$:` → `$derived()`

```ts
// Before
$: doubled = count * 2;
$: filtered = items.filter((i) => i.active);

// After
let doubled = $derived(count * 2);
let filtered = $derived(items.filter((i) => i.active));
```

### 4. Side Effects: `$:` → `$effect()`

```ts
// Before
$: {
	console.log(count);
	doSomething(count);
}

// After
$effect(() => {
	console.log(count);
	doSomething(count);
});
```

`$effect()` tracks dependencies at runtime (not compile-time). Ensure all dependencies are referenced in the body.

### 5. Event Handlers: `on:event` → `onevent`

```svelte
<!-- Before -->
<button on:click={handleClick}>
<form on:submit|preventDefault={handleSubmit}>

<!-- After -->
<button onclick={handleClick}>
<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
```

### 6. Event Dispatchers → Callback Props (21 components)

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

**21 components to migrate:**

- BottomSheet (`close`), MobileMoreMenu (`close`), MobileTabBar (`more`)
- MessageComposer (`send`, `abort`), CommandPalette (`select`), ChatHeader, ChannelSettings (`close`)
- FileEditor (`save`, `cancel`), FileActions (`newfile`, `newfolder`), ConfirmDialog (`confirm`, `cancel`)
- CanvasFrame (`load`, `error`), A2UIHost
- CronJobForm, CronJobList (`toggle`, `edit`, `run`, `delete`)
- KanbanBoard, PmSearch, PmSidebar, ProjectList, TaskDetail, BulkActions
- OnboardingWizard (`complete`, `skip`)

### 7. Slots → `{@render}`

```svelte
<!-- Before -->
<slot />
<slot {item} index={i} />

<!-- After -->
{@render children?.()}
{@render children?.({ item, index: i })}
```

Import `Snippet` type:

```ts
import type { Snippet } from 'svelte';
interface Props {
	children?: Snippet;
	// or with params:
	children?: Snippet<[{ item: T; index: number }]>;
}
```

3 components: `+layout.svelte`, `BottomSheet.svelte`, `VirtualList.svelte`

### 8. `$bindable()` for Bound Props

Props are NOT bindable by default in Svelte 5. Any prop that parents bind to via `bind:propName` must declare `$bindable()`:

```ts
interface Props {
	value?: string;
}
let { value = $bindable('') }: Props = $props();
```

Search for `bind:` usage on child components to identify candidates.

### 9. Event Modifiers — Removed

`|preventDefault`, `|stopPropagation`, `|once`, `|capture` no longer exist. Wrap manually:

```svelte
<!-- Before -->
<form on:submit|preventDefault={handleSubmit}>
<button on:click|stopPropagation={toggle}>

<!-- After -->
<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
<button onclick={(e) => { e.stopPropagation(); toggle(); }}>
```

For `|capture`, use the event name suffix: `onclickcapture={...}`

~9 instances across: `+page.svelte` (root), `CronJobForm`, `CronJobList` (4x), `BulkActions`, `files/+page`, `passwords/+page`

### 10. `afterUpdate` → `$effect()` (4 files)

`afterUpdate` is deprecated in runes mode. Replace with `$effect()`:

```svelte
// Before
afterUpdate(() => { if (shouldScroll) el.scrollTop = el.scrollHeight; });

// After
$effect(() => {
  items.length; // explicitly track dependency
  tick().then(() => { if (shouldScroll) el.scrollTop = el.scrollHeight; });
});
```

4 files: VirtualList, MessageList, LogsViewer, chat/+page

### 11. `svelte-ignore` Hyphens → Underscores

Svelte 5 uses underscores. Batch replace:

```bash
find src -name '*.svelte' -exec sed -i 's/svelte-ignore a11y-/svelte-ignore a11y_/g' {} +
```

### 12. Component Event Forwarding

Svelte 5 does NOT have automatic event forwarding. In Svelte 4, `<Button on:click />` forwarded the event. In Svelte 5, use rest-prop spreading:

```svelte
<!-- Child -->
let { onclick, ...restProps }: Props = $props();
<button onclick={onclick} {...restProps}>
```

### 13. Touch Events — Passive by Default

`ontouchstart` and `ontouchmove` are passive in Svelte 5. If gesture actions call `e.preventDefault()`, use `on` from `svelte/events`:

```ts
import { on } from 'svelte/events';
// In action:
on(node, 'touchstart', handler, { passive: false });
```

Files: `src/lib/utils/gestures.ts`

### 14. Multiple Event Handlers

Svelte 4 allowed `on:click={one} on:click={two}`. Svelte 5 does NOT — combine:

```svelte
<button onclick={(e) => { one(e); two(e); }}>
```

### 15. CSS Scoping Change

Svelte 5 uses `:where(.svelte-xyz)` for zero specificity. If component styles relied on specificity to override Tailwind, they may need adjustment.

### 16. HTML Structure Enforcement

Svelte 5 is stricter about valid HTML nesting (e.g., `<tr>` must be inside `<tbody>`).

## What NOT to Change

- **Store files (14):** `src/lib/stores/*.ts` — `svelte/store` fully supported
- **Gateway files (8):** `src/lib/gateway/*.ts` — pure TypeScript, no Svelte syntax
- **Transitions:** `transition:fade`, `transition:fly` — unchanged
- **`bind:value`, `bind:this` on DOM elements** — unchanged
- **`class:` directives** — unchanged
- **`use:` actions** — unchanged (but check passive touch events)
- **`{#if}`, `{#each}`, `{#await}` blocks** — unchanged
- **`$storeName` auto-subscriptions** — unchanged
- **`onMount`, `onDestroy`** — still valid in Svelte 5

## Progress Report Format

APPEND to `scripts/ralph/svelte5/progress.txt`:

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
```

## Consolidate Patterns

Add reusable patterns to `## Codebase Patterns` at TOP of progress.txt.

## Stop Condition

After completing ONE user story, STOP IMMEDIATELY.

If ALL stories have `passes: true`, reply with:
<promise>COMPLETE</promise>

Otherwise, end your response. Complete exactly ONE story per iteration.
