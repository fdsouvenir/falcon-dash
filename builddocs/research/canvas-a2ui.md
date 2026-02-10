# Canvas & A2UI Research — falcon-dash Integration

**Date:** 2026-02-07  
**Context:** How should falcon-dash render agent-generated Canvas/A2UI content?

---

## 1. How Canvas Works Today

### Architecture Overview

```
┌──────────────────────────┐
│  Canvas Host Server      │  HTTP server on port 18793 (default)
│  (part of OpenClaw GW)   │  Binds based on gateway.bind mode
│                          │
│  Routes:                 │
│  /__openclaw__/canvas/*  │  → Static HTML/CSS/JS from canvasHost.root
│  /__openclaw__/a2ui/*    │  → A2UI host page + bundle
│  /__openclaw__/ws        │  → WebSocket for live-reload
└──────────┬───────────────┘
           │
           │  node.invoke("canvas.present", {url})
           │  node.invoke("canvas.a2ui.pushJSONL", {jsonl})
           │
┌──────────▼───────────────┐
│  Node App (Mac/iOS/      │  WKWebView / Android WebView
│  Android)                │  Renders the canvas URL
│                          │  Contains <openclaw-a2ui-host>
└──────────────────────────┘
```

### Two Rendering Modes

**Mode 1: Static HTML Canvas**
- Agent writes HTML/CSS/JS files to `canvasHost.root` (default `~/.openclaw/workspace/canvas/`)
- Canvas host serves them at `http://<host>:18793/__openclaw__/canvas/<path>`
- Live-reload: chokidar watches directory, broadcasts `"reload"` over WS at `/__openclaw__/ws`
- All HTML responses get a live-reload + action bridge script injected before `</body>`
- Agent triggers `node.invoke("canvas.present", {url})` → node WebView navigates there

**Mode 2: A2UI (Agent-to-UI) Declarative Components**
- Agent sends JSONL payloads via `node.invoke("canvas.a2ui.pushJSONL", {jsonl})`
- The A2UI host page (`/__openclaw__/a2ui/`) contains:
  - A `<canvas>` element (background decorative animation)
  - An `<openclaw-a2ui-host>` web component (Lit-based, ~17K lines bundled)
  - The web component processes A2UI messages and renders declarative UI
- A2UI uses a component tree model (not raw HTML)

### A2UI Message Protocol (v0.8)

Four message types, sent as JSONL (one JSON object per line):

| Message | Purpose |
|---------|---------|
| `surfaceUpdate` | Define/update components on a surface |
| `beginRendering` | Signal the client to start rendering a surface with a root component |
| `dataModelUpdate` | Update the data model (reactive data binding) |
| `deleteSurface` | Remove a surface |

(`createSurface` is v0.9, not yet supported)

### A2UI Component Catalog

The A2UI bundle includes a full component library rendered via Lit web components:

**Layout:** `Row`, `Column`, `List`, `Card`, `Tabs`, `Divider`, `Modal`  
**Content:** `Text` (h1-h5, body, caption), `Image` (icon/avatar/feature/header), `Icon` (Material-style), `Video`, `AudioPlayer`  
**Input:** `Button`, `CheckBox`, `TextField`, `DateTimeInput`, `MultipleChoice`, `Slider`

Components support:
- **Data binding** — values can be `{literalString: "..."}` or `{path: "/data/model/path"}`
- **Template children** — dynamic lists from data model via `{template: {componentId, dataBinding}}`
- **Actions** — Buttons dispatch `userAction` events with name + context to the native bridge
- **Flex layout** — Row/Column support `distribution` (justify-content) and `alignment` (align-items), children support `weight` (flex-grow)

### Action Bridge

The injected script (for both HTML canvas and A2UI) provides:
- `globalThis.OpenClaw.postMessage(payload)` — post to native bridge
- `globalThis.OpenClaw.sendUserAction(action)` — send user action to agent
- Platform bridges: iOS `webkit.messageHandlers`, Android `window.openclawCanvasA2UIAction`
- **No web-to-web bridge exists today** — actions are designed for native node apps

### Canvas Host Configuration

```json5
{
  canvasHost: {
    enabled: true,        // default: true
    root: "~/.openclaw/workspace/canvas",
    port: 18793,          // default: gateway.port + 4
    liveReload: true,     // default: true (watches files, injects WS reload)
  }
}
```

### Gateway WS Methods for Canvas

Canvas is controlled via `node.invoke` — there are no dedicated canvas WS methods:

| Command | Description |
|---------|-------------|
| `canvas.present` | Show canvas, optionally navigate to URL |
| `canvas.hide` | Hide canvas |
| `canvas.navigate` | Navigate to URL |
| `canvas.eval` | Execute JS in canvas WebView |
| `canvas.snapshot` | Capture screenshot (returns base64) |
| `canvas.a2ui.pushJSONL` | Push A2UI JSONL messages |
| `canvas.a2ui.reset` | Reset A2UI renderer state |

All go through: `node.invoke({nodeId, command: "canvas.*", params: {...}})`

---

## 2. Architectural Options for falcon-dash

### Option A: Iframe the Canvas Host

**How:** Embed `<iframe src="http://<host>:18793/__openclaw__/a2ui/">` or `/__openclaw__/canvas/...` in the dashboard.

**Pros:**
- Zero rendering work — canvas host already serves everything
- Live-reload works out of the box
- Full HTML canvas support (arbitrary agent HTML)
- Security isolation via iframe sandbox

**Cons:**
- Requires canvas host to be network-reachable from the browser (same host or tunneled)
- Port 18793 is separate from gateway port 18789 — CORS/mixed-content issues if dashboard is on different origin
- A2UI action bridge expects native iOS/Android handlers — won't work in a web iframe without adaptation
- Iframe UX is clunky for inline chat rendering (sizing, scrolling, no shared styles)
- No way to push A2UI messages to the iframe without postMessage bridge (the current WS only does reload)
- Can't render canvas inline in chat messages (each would need its own iframe)

### Option B: Embed A2UI Web Component Directly

**How:** Import `a2ui.bundle.js` into falcon-dash. Use `<openclaw-a2ui-host>` and call `.applyMessages(messages)` / `.reset()`.

**Pros:**
- Native integration — A2UI renders directly in falcon-dash DOM
- Can render inline in chat messages, PM views, custom app panels
- Shared styling/theming (can override CSS custom properties)
- Action bridge can be wired to send actions back via the gateway WS
- The web component is self-contained (Lit + signal-based reactivity)
- `.applyMessages([...])` and `.reset()` are clean public APIs

**Cons:**
- ~17K line bundle (but it's already minified/bundled, probably ~100-200KB)
- Only handles A2UI declarative payloads, not arbitrary HTML canvas
- Agent HTML canvas (static files) would need a different approach
- Need to implement a web-based action bridge (replace native postMessage with WS gateway call)
- Need to intercept agent events that carry A2UI payloads (or add a new event type)

### Option C: Hybrid — A2UI Component Inline + Iframe for Full HTML

**How:** 
- For A2UI: Embed the `<openclaw-a2ui-host>` web component directly in falcon-dash
- For HTML canvas: Use sandboxed iframes pointing at the canvas host
- Custom apps (pinned) get their own panel with either rendering mode

**Pros:**
- Best of both worlds — declarative A2UI renders natively, full HTML gets iframe isolation
- A2UI inline in chat is smooth and integrated
- HTML canvas gets security isolation for free
- Custom apps panel can switch between modes transparently

**Cons:**
- Two code paths to maintain
- Need to detect which rendering mode a given canvas uses
- More complex, but each part is straightforward

### Option D: Render A2UI from Scratch (No Bundle Import)

**How:** Parse A2UI JSONL and render using falcon-dash's own React/Svelte components.

**Pros:**
- Full control over styling and behavior
- No external dependency
- Can optimize for web dashboard UX

**Cons:**
- Massive effort — reimplementing 17K lines of rendering logic
- Must track A2UI schema changes
- Component catalog is non-trivial (layout, data binding, templates, actions)
- No advantage over importing the existing bundle

---

## 3. Recommendation

### **Option C: Hybrid (A2UI web component inline + iframe for HTML canvas)**

**Rationale:**

1. **A2UI is the declarative, safe format** — it's a component tree, not raw HTML. It's designed for agent-generated UI. Rendering it inline is both safe and provides the best UX.

2. **The `<openclaw-a2ui-host>` web component is ready to use** — it's a Lit web component with a clean API:
   ```js
   const host = document.querySelector('openclaw-a2ui-host');
   host.applyMessages(parsedJsonlMessages);  // Push A2UI
   host.reset();                              // Clear
   ```

3. **HTML canvas needs iframe isolation** — arbitrary agent-generated HTML cannot be trusted in the same DOM. Iframe with `sandbox` attribute provides security.

4. **The spec's "Canvas Lifecycle" maps cleanly to this approach:**
   - Agent creates canvas → A2UI payload arrives via agent event stream → render inline with `<openclaw-a2ui-host>`
   - User pins as custom app → Persist A2UI state + surface ID in sidebar app registry
   - Agent updates → New A2UI messages pushed to the same host component
   - HTML canvas → Iframe in custom app panel

### Implementation Plan

#### Phase 1: A2UI Inline Rendering
1. **Bundle the A2UI web component** — Copy `a2ui.bundle.js` into falcon-dash assets, or dynamically load from canvas host
2. **Wire the action bridge** — Replace native bridge with web-based handler:
   ```js
   // Before loading A2UI bundle, set up web bridge
   globalThis.openclawCanvasA2UIAction = {
     postMessage: (json) => {
       const { userAction } = JSON.parse(json);
       // Send via WS: node.invoke or custom method
       wsClient.send({ method: 'node.invoke', params: {
         command: 'canvas.a2ui.action', 
         params: { userAction }
       }});
     }
   };
   ```
3. **Render in chat** — When agent event stream contains A2UI payloads, render `<openclaw-a2ui-host>` inline
4. **Render in custom apps** — Sidebar panel wraps `<openclaw-a2ui-host>` with persisted state

#### Phase 2: HTML Canvas via Iframe
1. **Custom app iframe** — For pinned HTML canvases, render `<iframe sandbox="allow-scripts" src="http://<canvasHost>/...">` 
2. **postMessage bridge** — Relay iframe↔dashboard messages for action callbacks
3. **Size auto-detection** — Use ResizeObserver or postMessage to auto-size iframes

#### Phase 3: Canvas Event Pipeline
1. **Define how A2UI payloads arrive** — Today they go through `node.invoke("canvas.a2ui.pushJSONL")` to a specific node. For falcon-dash, we need either:
   - A new agent event type (`event: canvas_update`) in the agent stream
   - Or falcon-dash acts as a "virtual node" that receives canvas.* invocations
   - Or the agent's `canvas` tool is extended with a `target: "dashboard"` mode
2. **Surface registry** — Track active surfaces (ID → A2UI state) for persistence and custom app pinning

---

## 4. Security Considerations

### A2UI: Low Risk
- A2UI is a **declarative component model**, not raw HTML
- Components are predefined (Text, Button, Image, etc.) — no arbitrary DOM injection
- Data binding uses explicit paths, not innerHTML
- The Lit web component renders components from a schema-validated structure
- **Verdict:** Safe to render inline in falcon-dash without sandboxing

### HTML Canvas: High Risk
- Agent writes arbitrary HTML/CSS/JS to the canvas root
- Could contain XSS, fetch calls to internal services, localStorage access, etc.
- **Mitigation:**
  - Always render in `<iframe sandbox="allow-scripts">` (no `allow-same-origin`)
  - This prevents: cookie access, localStorage, parent frame access, popups
  - Content-Security-Policy headers on the iframe
  - Consider: should falcon-dash even support raw HTML canvas? A2UI may be sufficient for dashboard use.

### Action Bridge Security
- A2UI actions dispatch named events with context (not arbitrary code)
- falcon-dash should validate action payloads before forwarding to the gateway
- Rate-limit action dispatch to prevent agent-generated UI from spamming the gateway

### Cross-Origin Considerations
- Canvas host (port 18793) and dashboard may be on different origins
- iframe embedding requires CORS or same-origin
- If falcon-dash is served from the gateway (port 18789), canvas host is cross-origin
- **Options:**
  - Proxy canvas host through the gateway/dashboard origin
  - Add CORS headers to canvas host
  - Serve dashboard from canvas host port (unlikely)

---

## 5. Open Questions

1. **How do A2UI payloads reach the dashboard?** Today they flow through `node.invoke` → node bridge → node WebView. falcon-dash isn't a "node" — we need a new delivery path. Options:
   - Dashboard registers as a virtual node with canvas capability
   - New WS event type for dashboard-targeted canvas updates
   - Agent tool gains `target: "web"` parameter

2. **Can we import the A2UI bundle as an ES module?** It registers `<openclaw-a2ui-host>` as a custom element on load. This should work in any modern browser, but we need to test it outside the A2UI host page context.

3. **Live-reload relevance for dashboard?** The canvas host's live-reload WS is designed for development of static HTML files. For A2UI in dashboard, updates come via the gateway WS agent event stream instead.

4. **Custom app persistence model?** The spec says users can "pin" canvases as sidebar apps. We need to define: what gets persisted? For A2UI: surface ID + last JSONL state? For HTML: URL?

5. **A2UI version evolution** — Currently v0.8. v0.9 adds `createSurface`. falcon-dash should be ready for schema evolution.

---

## 6. Key Source Files Reference

| File | Purpose |
|------|---------|
| `dist/canvas-host/server.js` | Canvas host HTTP server + live-reload WS |
| `dist/canvas-host/a2ui.js` | A2UI HTTP handler + live-reload injection |
| `dist/canvas-host/a2ui/index.html` | A2UI host page (canvas bg + `<openclaw-a2ui-host>`) |
| `dist/canvas-host/a2ui/a2ui.bundle.js` | Lit web component bundle (~17.7K lines) |
| `dist/agents/tools/canvas-tool.js` | Agent's `canvas` tool (present/hide/navigate/eval/snapshot/a2ui_push/a2ui_reset) |
| `dist/cli/nodes-cli/a2ui-jsonl.js` | A2UI JSONL builder + validator |
| `dist/cli/nodes-cli/register.canvas.js` | CLI registration for `openclaw nodes canvas *` |
| `dist/infra/canvas-host-url.js` | URL resolution (respects bind mode, request host, etc.) |
| `skills/canvas/SKILL.md` | User-facing canvas skill docs |
| `docs/platforms/mac/canvas.md` | macOS canvas panel docs |
| `docs/gateway/configuration.md` (§canvasHost) | Configuration reference |
