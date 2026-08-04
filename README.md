# Falcon Dash

[![CI](https://github.com/fdsouvenir/falcon-dash/actions/workflows/ci.yml/badge.svg)](https://github.com/fdsouvenir/falcon-dash/actions/workflows/ci.yml)
[![License: CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC_BY--NC--ND_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)

The operator console for [OpenClaw](https://github.com/openclaw/openclaw) deployments — a web dashboard that lets operators see what their AI agents are doing, approve sensitive actions, manage work, and administer every gateway-backed capability without touching a terminal.

Falcon Dash is designed to be installed alongside OpenClaw. It reads its configuration directly from `~/.openclaw/openclaw.json`, so once OpenClaw is running, the dashboard connects automatically with no manual setup.

## Surfaces

- **Work (default)** — Mission Control for operator work: projects, tasks, decisions, routines, observations, and changes as typed domain objects with lifecycle guards, provenance, and an append-only event log. Includes Needs Resolution, Projects, Automata, and Browse views, plus governance records (plans, reviews, authorizations, change requests). Agents work against the same data through `/api/v3` and the bundled `falcon` CLI.
- **Chat** — Real-time conversation with the agent through the main shell. Streaming responses, thinking blocks, tool call visualization, slash commands, threads, bookmarks, and search. Markdown rendering includes syntax highlighting (Shiki), math (KaTeX), and diagrams (Mermaid).
- **Channels** — Guided setup, readiness checks, validation, and repair for chat channels such as Discord and Telegram.
- **Agents** — Overview and administration of the agents behind the gateway.
- **Approvals** — Review and resolve execution approval requests from agents.
- **Documents** — Browse and edit files in the OpenClaw workspace, including creating, renaming, and deleting files and directories.
- **Jobs** — Create and manage scheduled agent jobs (cron expressions, intervals, or one-shot timestamps) with run history and status.
- **Heartbeat** — System health monitoring with heartbeat history and status indicators.
- **Passwords** — KeePassXC vault integration for secure credential storage, plus SecretRef resolution so gateway configs never store credentials in plaintext.
- **Skills** — Install and manage agent skills.
- **Settings** — Configuration editor, device management, execution approvals, live gateway logs, model selection, and workspace administration.
- **Apps / Canvas** — Renders A2UI (Agent-to-UI) surfaces pushed by the agent, with custom app panels and pinned apps in the sidebar.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A running [OpenClaw](https://github.com/openclaw/openclaw) gateway (default: `ws://127.0.0.1:18789`)

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

For a production build, run `npm run build`, then start the server with the bundled CLI:

```bash
npx falcon-dash start --port=3000
```

See the [Deployment Guide](docs/Technical/deployment.md) for reverse proxy setup, remote gateways, and production hardening.

## Gateway Connection

Falcon Dash maintains its gateway connection server-side; the browser talks to the dashboard over same-origin routes (`/api/gateway/events` for state and event streaming, `/api/gateway/rpc` for calls, `/api/gateway/proxy` for the Gateway Control UI).

- **Configuration resolution** — Explicit environment variables win first (`GATEWAY_URL`, `GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_TOKEN`), then the OpenClaw CLI (`openclaw config get gateway --json`), then `~/.openclaw/openclaw.json`. Remote-mode configs (`gateway.mode: "remote"`) are supported.
- **Reconnection** — Exponential backoff with tick-based health monitoring. If the gateway rotates its token, the reconnector re-reads the config before each retry.

### Dev Auth

For local development, set `gateway.controlUi.allowInsecureAuth: true` in `~/.openclaw/openclaw.json` to use token-only authentication (no device pairing required).

## Gateway Plugin

Falcon Dash registers with the gateway as an OpenClaw plugin (see `openclaw.plugin.json`) exposing its Work, Vault, Channels, Shell, and Labs modules. The gateway-side companion (deployed to `~/.openclaw/extensions/falcon-dash-plugin/`) registers the `falcon` chat channel, bridges canvas surfaces to the dashboard, and injects a bounded Work brief (`gateway-plugin/brief-context.js`, fetched from `/api/v3/brief`) into every agent prompt.

The KeePassXC secret resolver (`bin/keepassxc-secret-resolver.cjs`) bridges vault entries to OpenClaw's secrets system so provider configs can reference credentials by vault path — see [docs/secretrefs.md](docs/secretrefs.md).

See [docs/Technical/gateway-plugin.md](docs/Technical/gateway-plugin.md) for plugin internals.

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
| `npm run test:e2e`      | Playwright end-to-end tests          |
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
    gateway/       Server-side gateway client (connection, correlator,
                   event bus, snapshot store, reconnector, stream manager)
    stores/        Svelte stores (gateway, chat, sessions, files, etc.)
    components/    UI components (shell, chat, work, settings, canvas, etc.)
    canvas/        A2UI bridge and canvas delivery system
    chat/          Markdown pipeline, commands, highlighting
    server/        Server-side code (Work v3 engine, gateway proxy,
                   file config, passwords)
  routes/
    /              Redirects to /work (Mission Control)
    /work          Work v3: Mission Control, projects, automata, browse
    /channels      Channel setup, readiness, and repair
    /agents        Agent overview and administration
    /approvals     Execution approval queue
    /documents     File browser and editor
    /jobs          Scheduled job management
    /heartbeat     System health monitoring
    /passwords     Password vault (KeePassXC)
    /secrets       SecretRef management
    /skills        Skill management
    /settings      Configuration and administration
    /ops           Ops observer (live operational diagnostics)
    /setup         First-run setup wizard
    /apps/[id]     Custom canvas app panels
    /api/          Server endpoints (gateway, v3 work API, files, passwords)
```

Chat and session control live in the main shell and are available from every surface.

## Documentation

- [docs/README.md](docs/README.md) — index of all project documentation
- [docs/PURPOSE.md](docs/PURPOSE.md) — what Falcon Dash is and who it's for
- [docs/End User/quick-start.md](docs/End%20User/quick-start.md) — non-technical user guide
- [docs/Technical/architecture.md](docs/Technical/architecture.md) — system architecture
- [CHANGELOG.md](CHANGELOG.md) — release history

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
