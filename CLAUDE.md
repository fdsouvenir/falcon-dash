# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Falcon Dash is a web dashboard for the OpenClaw AI Agent platform. Falcon Dash is a product that makes it easy for users of OpenClaw to manage and interact with their agent(s). Falcon Dash is being purpose built by Frederic Souvenir for his business deploying and maintaining AI Agents for customers. The deployment infrastructure repo fredbot-hosting/fredbot-back is availble locally at ~/repos/fredbot-backend/ and via gh.

OpenClaw is a new and rapidly evolving project. Rely on documentation from docs.openclaw.ai/llms-full.txt and the public repo at github.com/openclaw/openclaw for up to date information.

## Your instructions

Document as much as possible. When planning work, always look for relevant github issues to update, and create one if required. You are in charge of ensuring github issues are up to date with reality as you work. Commit early, and commit often. Always err on the side of more commits.

## Development Environment

This machine hosts the dev repo of falcon-dash and has an openclaw gateway running.

- **`.env` file** — set these to connect to a gateway:
  - `GATEWAY_URL=ws://<host>:18789` — WebSocket URL of the gateway (default: `ws://127.0.0.1:18789`)
  - `GATEWAY_TOKEN=<token>` — gateway auth token (auto-read from `~/.openclaw/openclaw.json` if not set)
- **Gateway config fallback** — if env vars are not set, `/api/gateway-config` reads from `~/.openclaw/openclaw.json` (`gateway.auth.token`, `gateway.port`, `gateway.bind`)
- **Dev auth** — set `gateway.controlUi.allowInsecureAuth: true` in the gateway's `openclaw.json` for token-only auth (no device pairing)
- **Vite proxy** — dev server proxies `/ws` to `GATEWAY_URL` for WebSocket connections
- **Production** — set `ORIGIN=https://your-domain.com` to derive `wss://` URLs for reverse proxy

## Reference Docs

Project documentation in `docs/`:

- `docs/PURPOSE.md` — what Falcon Dash is and why it exists
- `docs/LEARNINGS.md` — running list of project discoveries and gotchas
- `docs/End User/` — non-technical user guides (quick start, feature references, walkthroughs)
- `docs/Technical/` — developer documentation (architecture, gateway protocol, stores, components, deployment, PM pipeline, gateway plugin, fredbot integration)

Expect that documentation will lag behind rapid development, reference the live code before making architectural decisions.
