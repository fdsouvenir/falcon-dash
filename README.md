# Falcon Dash

[![CI](https://github.com/fdsouvenir/falcon-dash/actions/workflows/ci.yml/badge.svg)](https://github.com/fdsouvenir/falcon-dash/actions/workflows/ci.yml)
[![License: CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC_BY--NC--ND_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)

The primary user interface for [OpenClaw](https://github.com/fdsouvenir/openclaw) — a web dashboard that connects to the OpenClaw Gateway over WebSocket to provide real-time control of the AI agent, project management, file browsing, and system monitoring.

Falcon Dash is designed to be installed alongside OpenClaw and serves as the main operator console. It reads its configuration directly from `~/.openclaw/openclaw.json`, so once OpenClaw is running, the dashboard connects automatically with no manual setup.

## Features

- **Chat** — Real-time conversation with the OpenClaw agent. Supports streaming responses, thinking blocks, tool call visualization, slash commands, threads, bookmarks, and search. Markdown rendering includes syntax highlighting (Shiki), math (KaTeX), and diagrams (Mermaid).
- **Project Management** — Full PM system with domains, focuses, projects, tasks, and subtasks. Includes a navigation tree, project list with filtering, project detail overlays, and task detail panels. Powered by the `openclaw-pm` gateway plugin.
- **Documents** — Browse and edit files in the OpenClaw workspace. Supports creating, renaming, and deleting files and directories.
- **Agent Jobs** — Create and manage cron jobs that run on a schedule (cron expressions, intervals, or one-shot timestamps). View run history and job status.
- **Heartbeat** — Monitor system health with heartbeat history and status indicators.
- **Passwords** — KeePassXC vault integration for secure credential storage and retrieval.
- **Settings** — Configuration editor, device management, Discord integration, execution approvals, live gateway logs, model selection, skill management, and workspace file browsing.
- **Canvas** — Renders A2UI (Agent-to-UI) surfaces pushed by the agent. Supports dynamic bundle loading, custom app panels, and pinned apps in the sidebar.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A running [OpenClaw](https://github.com/fdsouvenir/openclaw) gateway (default: `ws://127.0.0.1:18789`)

## Quick Start

```bash
# Clone and install
git clone https://github.com/fdsouvenir/falcon-dash.git
cd falcon-dash
npm install

# Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser. If OpenClaw is running, the dashboard reads the gateway token from `~/.openclaw/openclaw.json` and connects automatically. If the config file is unavailable, a manual token entry screen is shown.

## Docker

Pull the pre-built image from GitHub Container Registry:

```bash
docker pull ghcr.io/fdsouvenir/falcon-dash:latest
docker run -p 3000:3000 ghcr.io/fdsouvenir/falcon-dash:latest
```

Or build locally:

```bash
docker build -t falcon-dash .
docker run -p 3000:3000 falcon-dash
```

## Gateway Connection

Falcon Dash connects to the OpenClaw Gateway using WebSocket protocol v3.

- **Auto-configuration** — On startup, the server-side `/api/gateway-config` endpoint reads `~/.openclaw/openclaw.json` to extract the gateway token and URL. The dashboard connects once this config is resolved.
- **Reconnection** — Exponential backoff (800ms base, 1.7x multiplier, 15s cap) with tick-based health monitoring. If the gateway rotates its token, the reconnector automatically re-reads the config before each retry.
- **Dev proxy** — In development, Vite proxies `/ws` to the gateway so the browser connects through the dev server.

### Dev Auth

For local development, set `gateway.controlUi.allowInsecureAuth: true` in `~/.openclaw/openclaw.json` to use token-only authentication (no device pairing required).

## Gateway Plugins

Falcon Dash ships with gateway plugins that extend OpenClaw's capabilities.

### Canvas Operator Bridge

Routes the agent's canvas commands (present, hide, navigate, push A2UI) to the dashboard. This allows the agent to render rich UI surfaces directly in the browser.

```bash
cd openclaw-canvas-bridge
npm install && npm run build
openclaw plugins install ./openclaw-canvas-bridge
```

### Project Management (openclaw-pm)

Provides the PM backend — domains, projects, tasks, milestones, comments, dependencies, and search. Data is stored in a local SQLite database at `~/.openclaw/data/pm.db`.

```bash
cd openclaw-pm
npm install && npm run build
openclaw plugins install ./openclaw-pm
```

Restart the gateway after installing plugins.

## Scripts

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `npm run dev`           | Start the Vite dev server with HMR   |
| `npm run build`         | Production build                     |
| `npm run preview`       | Preview the production build locally |
| `npm run check`         | TypeScript type checking             |
| `npm run lint`          | ESLint                               |
| `npm run test`          | Run unit tests                       |
| `npm run test:coverage` | Run tests with coverage report       |
| `npm run format`        | Format all files with Prettier       |

## Tech Stack

- **Framework** — [SvelteKit](https://kit.svelte.dev/) with [Svelte 5](https://svelte.dev/) (runes API)
- **Styling** — [Tailwind CSS v4](https://tailwindcss.com/)
- **Language** — TypeScript (strict mode)
- **Server DB** — [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (WAL mode)
- **Markdown** — unified pipeline (remark + rehype) with [Shiki](https://shiki.style/) syntax highlighting, [KaTeX](https://katex.org/) math, and [Mermaid](https://mermaid.js.org/) diagrams

## Architecture

```
src/
  lib/
    gateway/       WebSocket client (connection, correlator, event bus,
                   snapshot store, reconnector, stream manager, diagnostics)
    stores/        Svelte stores (gateway, chat, sessions, PM, files, etc.)
    components/    UI components (chat, PM, settings, canvas, etc.)
    canvas/        A2UI bridge and canvas delivery system
    chat/          Markdown pipeline, commands, highlighting
    server/        Server-side code (PM database, file config, passwords)
  routes/
    /              Chat view (default) or welcome screen
    /projects      Project management dashboard
    /documents     File browser and editor
    /jobs          Cron job management
    /heartbeat     System health monitoring
    /passwords     Password vault (KeePassXC)
    /settings      Configuration and administration
    /apps/[id]     Custom canvas app panels
    /api/          Server endpoints (files, passwords, gateway config)
```

The gateway layer is composed of six classes wired together as singletons in `src/lib/stores/gateway.ts`:

- **GatewayConnection** — WebSocket lifecycle and handshake
- **RequestCorrelator** — Maps request IDs to Promises for req/res correlation
- **EventBus** — Pub/sub for gateway event frames
- **SnapshotStore** — Hydrates state from the gateway hello-ok payload
- **Reconnector** — Exponential backoff with token refresh
- **AgentStreamManager** — Reassembles streaming agent responses

## Configuration

Falcon Dash reads its gateway connection settings from the OpenClaw config file:

```
~/.openclaw/openclaw.json
```

Key fields used:

```json
{
	"gateway": {
		"port": 18789,
		"bind": "loopback",
		"auth": {
			"token": "your-gateway-token"
		},
		"controlUi": {
			"allowInsecureAuth": true
		}
	}
}
```

The token and URL can also be entered manually through the dashboard's token entry screen and are persisted to `localStorage`.

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License](https://creativecommons.org/licenses/by-nc-nd/4.0/). See the [LICENSE](LICENSE) file for details, or read the [full legal code](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode).
