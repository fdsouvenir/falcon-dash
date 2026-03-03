# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Falcon Dash is a web dashboard for the OpenClaw AI Agent platform. Falcon Dash is a product that makes it easy for users of OpenClaw to manage and interact with their agent(s). Falcon Dash is being purpose built by Frederic Souvenir for his business deploying and maintaining AI Agents for customers. The deployment infrastructure repo fredbot-hosting/fredbot-back is availble locally at ~/repos/fredbot-backend/ and via gh.

OpenClaw is a new and rapidly evolving project. Rely on documentation from docs.openclaw.ai/llms-full.txt and the public repo at github.com/openclaw/openclaw for up to date information.

## Your instructions

Document as much as possible. When planning work, always look for relevant github issues to update, and create one if required. You are in charge of ensuring github issues are up to date with reality as you work. Commit early, and commit often. Always err on the side of more commits and add discoveries and gotchas to docs/LEARNINGS.md.

## Development Environment

This machine hosts the dev repo of falcon-dash and has an openclaw gateway running.

- **Gateway config resolution** (priority chain, no hardcoded port defaults):
  - **URL**: `GATEWAY_URL` env → `openclaw config get gateway --json` CLI → `~/.openclaw/openclaw.json` file
  - **Token**: `GATEWAY_TOKEN` env → `OPENCLAW_GATEWAY_TOKEN` env → `~/.openclaw/openclaw.json` file
- **`.env` file** — optional overrides for remote gateway development:
  - `GATEWAY_URL=ws://<host>:<port>` — WebSocket URL of the gateway
  - `GATEWAY_TOKEN=<token>` — gateway auth token (or `OPENCLAW_GATEWAY_TOKEN` for managed deployments)
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
