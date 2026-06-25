# Components

This document describes the UI component architecture. All components live in `src/lib/components/`.

See also:

- [Stores](stores.md) -- the reactive state that components consume
- [Architecture overview](architecture.md) -- where components sit in the system
- [Work management](work-management.md) -- Work data model behind the Work surface

## Svelte 5 conventions

Falcon Dash uses Svelte 5 with runes. Key conventions enforced across the codebase:

### Runes

- `$state()` for local reactive state
- `$derived()` for computed values
- `$effect()` for side effects (including store subscriptions)
- `$props()` for component props

### Event handlers

Use `onevent` attributes (not Svelte 4's `on:event` directive):

```svelte
<!-- Correct -->
<button onclick={handleClick}>Click</button>

<!-- Wrong (Svelte 4 syntax) -->
<button on:click={handleClick}>Click</button>
```

For DOM events that need type narrowing, use wrapper functions instead of `as EventListener` casts (which trigger ESLint `no-undef`):

```typescript
function handleKeydown(e: KeyboardEvent) { ... }
function wrapKeydown(e: Event) { handleKeydown(e as KeyboardEvent); }
```

### Snippets

Child content uses `{@render children()}` (Svelte 5 snippets), not `<slot>`:

```svelte
<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

{@render children()}
```

## AppShell and layout

### Root layout (`src/routes/+layout.svelte`)

The root layout handles the top-level application state machine:

1. **Loading** -- fetching `/api/gateway-config`, shows spinner
2. **No token** -- renders `TokenEntry` for manual gateway token entry
3. **Has token** -- renders `AppShell` (desktop) or `MobileShell` (mobile) based on `isMobile` store

On READY state, the layout:

- Restores the active session from localStorage
- Subscribes to session, notification, and approval events
- Creates a `#general` channel per agent via `ensureDefaultChannel()`

### AppShell (`src/lib/components/AppShell.svelte`)

Desktop layout with a three-column structure:

```
+--AgentRail--+--Sidebar--+--Main Content--+
|  Agent      |  Sessions |  Page content  |
|  icons      |  Channels |  (from router) |
|  + button   |  Search   |                |
|             |           |  Canvas panel  |
|             |           |  (floating)    |
+-------------+-----------+----------------+
```

- `AgentRail` -- left edge, always visible on desktop, hidden on mobile
- `Sidebar` -- collapsible session/channel list
- Main area -- renders page content with optional exec approval banner and floating canvas panel
- Canvas panel appears on all pages when a surface is active (not just the chat page)

### MobileShell (`src/lib/components/mobile/MobileShell.svelte`)

Mobile layout with bottom tab navigation:

```
+--MobileHeader--+
|  Page content  |
|                |
+--BottomTabBar--+
```

The mobile shell includes its own `MobileHeader` and `BottomTabBar` components, plus mobile-specific variants of many pages (prefixed `Mobile*`).

## Chat components

### ChatView (`src/lib/components/ChatView.svelte`)

The primary chat interface. Manages:

- Active session tracking (creates/destroys `ChatSessionStore` instances)
- Message rendering loop with type-specific adapters
- Scroll management (auto-scroll on new messages, scroll-to-bottom button)
- Thread panel (slide-in overlay)
- Chat search overlay
- Connection resilience (reconnect reconciliation)

### Message rendering

Each message is rendered based on its role and content:

- **User messages** -- plain text with reply preview
- **Assistant messages** -- `MarkdownRenderer` with tool call adapters
- **Divider messages** -- visual separator

Assistant messages include contextual sub-components:

- `ReasoningAdapter` -- collapsible thinking/reasoning block
- `ToolAdapter` / `ToolGroup` -- tool call status and results
- `PlanAdapter` -- step-by-step plan display
- `SourcesAdapter` -- citation links
- `SuggestionAdapter` -- follow-up suggestions
- `ReactionDisplay` / `ReactionPicker` -- emoji reactions
- `MessageActions` -- copy, reply, bookmark, thread

### MessageComposer (`src/lib/components/MessageComposer.svelte`)

Text input with:

- Multi-line textarea with auto-resize
- File attachment (drag-and-drop, paste, file picker)
- Slash command menu (`SlashCommandMenu`)
- Reply preview bar
- Send/abort button (context-dependent)
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

### ChatHeader (`src/lib/components/ChatHeader.svelte`)

Session info bar with session name, model indicator, chat settings access, and search toggle.

## Work surface

### Work routes (`src/routes/work/**`)

Routeable Work surface for the `/work` module:

- **Overview** -- `/work` is an executive status board. Top signals focus the matching overview
  section (`#needs-you`, `#at-risk`, `#due-next`, `#recent`) instead of opening an arbitrary item
  detail. The main content is a project health table followed by grouped operator asks,
  blocked/waiting work, a due-next timeline, and a single chronological recent activity log.
- **Search** -- `/work/search?q=...` is a read-only search surface for existing Work records. The
  shell Work search form routes there and result rows link to exact item detail routes. The Work
  shell does not expose manual capture/create controls until a dedicated capture workflow exists.
- **Type pages** -- `/work/projects`, `/work/changes`, `/work/decisions`, `/work/tasks`,
  `/work/routines`, and `/work/observations` use type-specific page anatomy instead of one generic
  list row. Projects show outcomes, upcoming dates, operator moves, supporting work, and blockers;
  change requests show scope, approval, and waiting state; questions show recommendation and impact;
  tasks show parent and due state; routines show cadence, next run, and last result; observations
  render as a feed. Row clicks select the right-side quick inspector in place. The inspector shows
  read-only item context, exposes only status/priority/waiting state controls, and links to the
  full item page. The UI labels `change` as Change request and `decision` as Question to clarify
  the operator-facing distinction.
- **Detail pages** -- `/work/{type}/{id}` gives each item a stable standalone URL. Detail pages do
  not render the peer list; they show type-aware sections, blockers, related work, and the same
  lightweight state controls without text editors for agent-managed narrative fields.
- **Areas** -- `area` remains a Work model type for grouping, but it is not shown as a primary
  operator tab until an explicit area-management workflow exists
- **Operator language** -- waiting states use operator, agent, and external/system labels; no
  person-specific copy is hardcoded
- **Refresh path** -- reloads `/api/work/items` and `/api/work/queue`

Work-specific context, migration, and API behavior live in [Work management](work-management.md).

## Settings components

### SettingsPage (`src/lib/components/settings/SettingsPage.svelte`)

Tab-based settings interface. Available tabs:

| Tab         | Component                     | Purpose                                          |
| ----------- | ----------------------------- | ------------------------------------------------ |
| Agents      | `AgentsTab.svelte`            | Agent management (create, edit identity, delete) |
| Gateway     | `GatewayControlTab.svelte`    | Gateway control and status                       |
| Config      | `ConfigEditor.svelte`         | Raw openclaw.json editor                         |
| Devices     | `DeviceManagement.svelte`     | Device pairing management                        |
| Discord     | `DiscordSetup.svelte`         | Discord integration setup                        |
| Approvals   | `ExecApprovals.svelte`        | Exec approval policy                             |
| Logs        | `LiveLogs.svelte`             | Real-time gateway log viewer                     |
| Skills      | `SkillsTab.svelte`            | Agent skill management                           |
| Workspace   | `WorkspaceFiles.svelte`       | Agent workspace file browser                     |
| Canvas      | `CanvasDiagnosticsTab.svelte` | Canvas bridge diagnostics                        |
| Preferences | `PreferencesTab.svelte`       | User preferences                                 |
| User        | `UserTab.svelte`              | User account settings                            |
| Info        | `InformationTab.svelte`       | System information                               |
| About       | `AboutTab.svelte`             | Version and credits                              |

### AgentsTab (`src/lib/components/settings/AgentsTab.svelte`)

Lists agents as cards with edit/delete actions:

- "Spawn Agent" button for one-click creation (auto-generated `agent-NNN` ID, no form)
- Edit modal for setting name, emoji, and theme after creation
- Delete modal with confirmation (primary agent is protected)
- Tracks `configHash` for optimistic concurrency

## Canvas components

### CanvasBlock (`src/lib/components/canvas/CanvasBlock.svelte`)

Entry point for rendering a canvas surface. Selects the appropriate renderer based on surface type.

### CustomAppPanel (`src/lib/components/canvas/CustomAppPanel.svelte`)

Renders custom application panels delivered via the canvas pipeline.

### HTMLCanvasFrame (`src/lib/components/canvas/HTMLCanvasFrame.svelte`)

Renders HTML content in a sandboxed iframe for canvas surfaces.

### InlineA2UI (`src/lib/components/canvas/InlineA2UI.svelte`)

Renders A2UI (Agent-to-UI) content. Dynamically loads the A2UI bundle from the canvas host (`http://<host>:<gatewayPort+4>/__openclaw__/a2ui/a2ui.bundle.js`) with a placeholder fallback if the bundle is unavailable.

## Mobile variants

The `src/lib/components/mobile/` directory contains mobile-specific implementations:

| Component                        | Purpose                     |
| -------------------------------- | --------------------------- |
| `MobileShell.svelte`             | Root mobile layout          |
| `MobileHeader.svelte`            | Top navigation bar          |
| `BottomTabBar.svelte`            | Bottom tab navigation       |
| `BottomSheet.svelte`             | Slide-up sheet overlay      |
| `MoreSheet.svelte`               | "More" menu sheet           |
| `AgentRail.svelte`               | Mobile agent switcher       |
| `MobileChatSettings.svelte`      | Chat settings for mobile    |
| `MobileSettingsHome.svelte`      | Settings landing page       |
| `MobileSettingsPage.svelte`      | Settings page shell         |
| `MobileDocumentBrowser.svelte`   | File browser for mobile     |
| `MobilePasswordsPage.svelte`     | Password vault for mobile   |
| `MobilePasswordList.svelte`      | Password list for mobile    |
| `MobilePasswordDetail.svelte`    | Password detail for mobile  |
| `MobilePasswordForm.svelte`      | Password form for mobile    |
| `MobileVaultSetup.svelte`        | Vault setup for mobile      |
| `MobileVaultUnlock.svelte`       | Vault unlock for mobile     |
| `MobileCronJobList.svelte`       | Cron job list for mobile    |
| `MobileCronJobForm.svelte`       | Cron job form for mobile    |
| `MobileCronRunHistory.svelte`    | Cron run history for mobile |
| `MobileNotificationSheet.svelte` | Notification sheet          |

## Markdown pipeline

**Files:** `src/lib/chat/markdown.ts`, `src/lib/chat/highlighter.ts`, `src/lib/components/MarkdownRenderer.svelte`, `src/lib/components/CodeBlock.svelte`, `src/lib/components/MermaidDiagram.svelte`

The markdown rendering pipeline processes agent responses through a unified processor:

```
Raw markdown
  -> remark-parse (parse to mdast)
  -> remark-gfm (tables, strikethrough, task lists)
  -> remark-math (KaTeX blocks)
  -> remark-rehype (convert to hast)
  -> rehype-katex (render math)
  -> rehype-sanitize (security)
  -> rehype-stringify (serialize to HTML)
```

Additional processing:

- **Syntax highlighting** via Shiki (preloaded at startup via `preloadHighlighter()`)
- **Mermaid diagrams** via `MermaidDiagram.svelte` (lazy-loaded renderer)
- **Admonitions** -- `>note`, `>tip`, `>warning`, `>caution`, `>important` render as styled callout boxes via `Admonition.svelte`
- **Collapsible sections** -- `<details>`/`<summary>` elements pass through sanitization

### Streaming optimization

`MarkdownRenderer` throttles rendering during streaming via `requestAnimationFrame`, batching rapid delta updates to ~60fps. It also "stream-sanitizes" partial content by closing unclosed markdown fences, bold markers, and italic markers so incomplete content renders correctly.

## Other notable components

| Component               | File                           | Purpose                                        |
| ----------------------- | ------------------------------ | ---------------------------------------------- |
| `TokenEntry`            | `TokenEntry.svelte`            | Gateway token manual entry form                |
| `ConnectionErrorBanner` | `ConnectionErrorBanner.svelte` | Persistent banner for connection issues        |
| `ConnectionStatus`      | `ConnectionStatus.svelte`      | Connection state indicator                     |
| `DiagnosticPanel`       | `DiagnosticPanel.svelte`       | Connection diagnostic viewer                   |
| `PresenceList`          | `PresenceList.svelte`          | Online operators/devices list                  |
| `ToastContainer`        | `ToastContainer.svelte`        | Toast notification renderer                    |
| `InstallPrompt`         | `InstallPrompt.svelte`         | PWA install prompt                             |
| `OnboardingWizard`      | `OnboardingWizard.svelte`      | First-run setup wizard                         |
| `ExecApprovalPrompt`    | `ExecApprovalPrompt.svelte`    | Exec approval decision UI                      |
| `DocumentBrowser`       | `DocumentBrowser.svelte`       | File browser tree view                         |
| `DocumentEditor`        | `DocumentEditor.svelte`        | File editor with save                          |
| `HeartbeatPanel`        | `HeartbeatPanel.svelte`        | Agent health visualization                     |
| `CronJobList`           | `CronJobList.svelte`           | Cron job management                            |
| `PasswordList`          | `PasswordList.svelte`          | KeePassXC vault entries                        |
| `ChatList`              | `ChatList.svelte`              | Session list in sidebar                        |
| `ChannelList`           | `ChannelList.svelte`           | Channel list in sidebar                        |
| `Sidebar`               | `Sidebar.svelte`               | Collapsible sidebar with session/channel lists |
| `AgentRail`             | `AgentRail.svelte`             | Agent icon rail (desktop)                      |
| `ScrollManager`         | `ScrollManager.svelte`         | Virtual scroll container                       |
| `ThreadPanel`           | `ThreadPanel.svelte`           | Thread view overlay                            |
| `ThreadList`            | `ThreadList.svelte`            | Thread list in sidebar                         |
| `ErrorBoundary`         | `ErrorBoundary.svelte`         | Component error boundary                       |
| `WebPreview`            | `WebPreview.svelte`            | URL preview card                               |
| `NotificationCenter`    | `NotificationCenter.svelte`    | Notification history                           |
| `SlashCommandMenu`      | `SlashCommandMenu.svelte`      | Slash command autocomplete                     |
