# Ralph Agent Instructions — falcon-dash Phase 2b: Chat Enhanced

You are an autonomous coding agent building **falcon-dash**, a SvelteKit web dashboard for the OpenClaw AI platform. Phase 1 (Core Infrastructure) and Phase 2a (Chat Core) are complete. You are now implementing **Phase 2b: Chat Enhanced** — rich markdown rendering, syntax highlighting, math, diagrams, message actions, and slash commands.

## Project Context

Read the root `CLAUDE.md` at the project root for tech stack, conventions, and folder structure. That file is the source of truth for coding standards.

Reference docs live in `builddocs/`:

- `builddocs/falcon-dash-architecture-v02.md` — full architecture, module specs, data flows
- `builddocs/ws-protocol.md` — WebSocket protocol reference (frames, methods, events)
- `builddocs/pm-spec.md` — project management specification

## What Phase 1 Built

- **Gateway client layer:** `src/lib/gateway/` — connection, correlator, events, snapshot, auth, client, types, stream
- **Stores:** `src/lib/stores/connection.ts` — connection state bridged to Svelte
- **Components:** `src/lib/components/Sidebar.svelte`, `ConnectionStatus.svelte`
- **Routes:** `/` (connection page), app shell layout
- **Tests:** Playwright smoke test, PWA config

## What Phase 2a Built

Phase 2a created the working chat infrastructure you now enhance:

- **Gateway types:** `src/lib/gateway/types.ts` — ChatMessage, ToolCall, ThinkingBlock, Session, AgentRunState, all chat/session method params/responses
- **Stream manager:** `src/lib/gateway/stream.ts` — AgentStreamManager handling text_delta (full accumulated, NOT incremental), thinking, tool tracking
- **Stores:**
  - `src/lib/stores/sessions.ts` — sessions Map store, activeSessionKey, loadSessions(), switchSession(), updateSession()
  - `src/lib/stores/chat.ts` — messages Map store, getMessages(), sendMessage(), loadHistory(), abortRun(), initChatListeners(), reconnection gap fill
- **Components:**
  - `src/lib/components/chat/MessageList.svelte` — (unused by chat route, renders messages with auto-scroll)
  - `src/lib/components/chat/ThinkingBlock.svelte` — `<details>` with live streaming
  - `src/lib/components/chat/ToolCallCard.svelte` — `<details>` with status badges
  - `src/lib/components/chat/MessageComposer.svelte` — textarea with auto-resize, Enter send, abort button
- **Utils:** `src/lib/utils/time.ts` — formatRelativeTime(), formatFullTimestamp()
- **Routes:** `src/routes/chat/+page.svelte` + `+page.ts` (ssr: false) — full chat UI, inline thinking/tools in messages
- **Sidebar:** Session list with active highlighting, unread badges, New Chat button

### Key Phase 2a Architecture Decisions

- Chat route renders messages directly (not via MessageList) with inline ThinkingBlock/ToolCallCard
- Messages stored as `Map<string, ChatMessage[]>` keyed by sessionKey
- Manual store subscriptions for dynamic session switching (subscribe/unsubscribe pattern)
- `$: if (condition)` reactive statements for triggering loads on store changes
- activeRun uses polling (setInterval 200ms) since AgentStreamManager is a plain class

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, create it from the current branch.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks: `npm run check`, `npm run lint`, `npm run build`, `npm run test`
7. Run `npm run format` before committing (agents never match Prettier config exactly)
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD (`scripts/ralph/prd.json`) to set `passes: true` for the completed story
10. Append your progress to `scripts/ralph/progress.txt`

## Key Conventions (from root CLAUDE.md)

- **Svelte 4** syntax: use `on:event`, NOT Svelte 5 `onevent` syntax
- **Props:** use `export let propName`, NOT `$props()`
- **Reactivity:** use `$:` declarations, NOT `$derived()` or `$effect()`
- **Events:** use `createEventDispatcher`, NOT callback props
- **Blocks:** use `{#if}`, `{#each}`, `{#await}` template blocks
- **Formatting:** Prettier with tabs, single quotes, no trailing commas
- **TypeScript:** strict mode, no `any` unless absolutely necessary
- **Tailwind CSS 3** for styling
- **Barrel exports** from `index.ts` in each module directory
- `{@html}` requires `<!-- eslint-disable svelte/no-at-html-tags -->` comment
- `EventListener` global type triggers ESLint `no-undef` — use wrapper functions instead of `as EventListener`

## Markdown Rendering Pipeline Architecture

### Pipeline Overview

The markdown pipeline converts raw text to sanitized HTML using the unified ecosystem:

```
remarkParse → remarkGfm → [remarkMath] → [admonition plugin] → remarkRehype
→ [rehypeKatex] → [shiki plugin] → rehypeSanitize(customSchema) → rehypeStringify
```

Plugins in brackets `[]` are added by later stories. The pipeline is **synchronous** and returns an HTML string.

### Key Files

| File                                             | Purpose                                           |
| ------------------------------------------------ | ------------------------------------------------- |
| `src/lib/utils/markdown/pipeline.ts`             | `renderMarkdown(text): string` — the pipeline     |
| `src/lib/utils/markdown/sanitize-schema.ts`      | Custom rehype-sanitize schema, extended per story |
| `src/lib/utils/markdown/highlighter.ts`          | Shiki HighlighterManager singleton (US-029)       |
| `src/lib/utils/markdown/mermaid-plugin.ts`       | Rehype plugin for mermaid placeholders (US-031)   |
| `src/lib/utils/markdown/admonition-plugin.ts`    | Remark plugin for admonitions (US-032)            |
| `src/lib/utils/markdown/index.ts`                | Barrel exports                                    |
| `src/lib/components/chat/RenderedContent.svelte` | `{@html}` wrapper with streaming debounce         |

### RenderedContent.svelte Pattern

```svelte
<!-- eslint-disable svelte/no-at-html-tags -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { renderMarkdown } from '$lib/utils/markdown';

	export let content: string;
	export let isStreaming: boolean;

	let renderedHtml = '';
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Debounce during streaming, immediate otherwise
	$: if (content) {
		if (isStreaming) {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				renderedHtml = renderMarkdown(content);
			}, 50);
		} else {
			clearTimeout(debounceTimer);
			renderedHtml = renderMarkdown(content);
		}
	}

	onDestroy(() => clearTimeout(debounceTimer));
</script>

<div class="rendered-content">
	{@html renderedHtml}
</div>
```

### Sanitization Strategy

`sanitize-schema.ts` starts with the GitHub schema from rehype-sanitize and extends it progressively:

- **US-028 (base):** Allow `class` on code/pre/div/span, `data-*` on div
- **US-029 (Shiki):** Allow `style` on `span` (for Shiki inline token colors)
- **US-030 (KaTeX):** Allow MathML elements, KaTeX class names, `style` on KaTeX elements
- **US-031 (Mermaid):** Allow SVG elements (svg, g, rect, path, text, etc.)

Each story extends the SAME schema file — do not create separate schemas.

### Shiki Async Init Pattern (US-029)

```typescript
class HighlighterManager {
	private highlighter: Highlighter | null = null;
	private initPromise: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.highlighter) return;
		if (this.initPromise) return this.initPromise;
		this.initPromise = this.doInit();
		return this.initPromise;
	}

	isReady(): boolean {
		return this.highlighter !== null;
	}

	highlight(code: string, lang: string): string {
		if (!this.highlighter) return ''; // fallback handled by caller
		return this.highlighter.codeToHtml(code, { lang, theme: 'github-dark' });
	}
}

export const highlighterManager = new HighlighterManager();
```

RenderedContent calls `highlighterManager.init()` in `onMount` and triggers re-render when ready.

### Mermaid Post-Pipeline Pattern (US-031)

Mermaid cannot run in the rehype pipeline (needs DOM). Pattern:

1. **Rehype plugin** replaces ` ```mermaid ` code blocks with `<div class="mermaid-placeholder" data-mermaid-source="BASE64_ENCODED_SOURCE">`
2. **Svelte action** (`use:mermaidAction`) finds `.mermaid-placeholder` divs after DOM update
3. **Dynamic import** of `mermaid` on first use
4. **`mermaid.render()`** returns SVG string, inserted into placeholder div
5. Errors caught per-diagram — broken diagrams show raw source

### Svelte Action Pattern for Post-DOM Work

Both code block copy buttons (US-029) and mermaid rendering (US-031) use Svelte actions:

```svelte
<!-- In RenderedContent.svelte -->
<div class="rendered-content" use:codeBlockActions use:mermaidAction>
	{@html renderedHtml}
</div>
```

Actions fire on mount and must handle DOM content changes. The `update` function in the action re-runs when the action's parameter changes, or use a MutationObserver.

### Streaming Performance

- **50ms debounce** during active streaming (`isStreaming=true`)
- **Immediate render** when streaming stops (`isStreaming=false`, i.e., after `text_end`)
- Incomplete markdown during streaming (unclosed fences, partial tables) is acceptable
- Final render on text_end corrects any incomplete markup
- Clear debounce timer on component destroy to prevent memory leaks

## Slash Command Architecture (US-036, US-037)

### Registry Pattern

```typescript
// src/lib/chat/commands/registry.ts
export interface SlashCommand {
	name: string;
	description: string;
	usage?: string;
	execute: (args: string, context: CommandContext) => void | Promise<void>;
}

export interface CommandContext {
	sessionKey: string;
	sendMessage: (content: string) => void;
	abortRun: () => void;
	updateSession: (key: string, patch: Record<string, unknown>) => void;
	injectMessage: (sessionKey: string, role: string, content: string) => void;
	gateway: GatewayClient;
}

export const commands: SlashCommand[] = [];
```

### / Detection in Composer

MessageComposer detects `/` at position 0, shows CommandPalette above textarea. When palette is open, Enter selects command instead of sending. If no commands match, message is sent normally.

### CommandContext Wiring

CommandContext is constructed in `src/routes/chat/+page.svelte` and passed to MessageComposer as a prop. The composer passes it to command.execute() when a command is selected.

## Chat Route Current Structure

The chat route (`src/routes/chat/+page.svelte`) currently has:

- **Lines 137-141:** Inline session header (h2 with displayName) — extracted to ChatHeader in US-034
- **Lines 172-174:** Plain text assistant message rendering (`whitespace-pre-wrap {message.content}`) — replaced by RenderedContent in US-028
- **Line 198:** MessageComposer — modified for slash commands in US-036

## Progress Report Format

APPEND to `scripts/ralph/progress.txt` (never replace, always append):

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

## Consolidate Patterns

If you discover a **reusable pattern**, add it to the `## Codebase Patterns` section at the TOP of `scripts/ralph/progress.txt` (create it if it doesn't exist):

```
## Codebase Patterns
- Example: Svelte stores use writable() from svelte/store
```

Only add patterns that are **general and reusable**, not story-specific details.

## Quality Requirements

- ALL commits must pass: `npm run check` (0 errors), `npm run lint`, `npm run build`, `npm run test`
- Always run `npm run format` before committing
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

## Stop Condition

After completing ONE user story, STOP IMMEDIATELY. Do NOT proceed to the next story.

Check if ALL stories have `passes: true`. If so, reply with:
<promise>COMPLETE</promise>

Otherwise, end your response. The next iteration will pick up the next story.

IMPORTANT: You must complete exactly ONE story per iteration. After committing and marking
the story as passing, your work for this iteration is done. Stop.

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting
- When in doubt, consult `builddocs/` for architecture decisions
