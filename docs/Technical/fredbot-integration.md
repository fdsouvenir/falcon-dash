# fredbot integration

This document describes how Falcon Dash fits within the fredbot-backend deployment infrastructure. The fredbot-backend repo is at `~/repos/fredbot-backend/` (GitHub: `fredbot-hosting/fredbot-backend`).

See also:

- [Architecture overview](architecture.md) -- Falcon Dash system architecture
- [Deployment](deployment.md) -- build, Docker, and reverse proxy details
- [PM pipeline](pm-pipeline.md) -- PM context files that agents consume
- [Gateway plugin](gateway-plugin.md) -- plugin installed alongside the gateway

## What fredbot-backend does

fredbot-backend is an AI agent hosting platform. It manages the full lifecycle of customer deployments from a central control server (`control-01`):

| Capability            | Implementation                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Server provisioning   | `provision-customer.sh` -- Hetzner server creation, Tailscale enrollment, Cloudflare tunnel + DNS |
| Server deprovisioning | `deprovision-customer.sh` -- automated cleanup of DNS, tunnel, server, Tailscale                  |
| Agent management      | OpenClaw + Falcon Dash installed as npm globals, run as systemd services                          |
| Support tasks         | CRM-driven queue with two-phase execution (read-only diagnosis, validated actions)                |
| Monitoring            | Netdata on all servers, heartbeat checks, circuit breaker for failing servers                     |
| Auth                  | Cloudflare Access + agent-auth Worker for tenant email validation                                 |
| CRM                   | Twenty (self-hosted) as source of truth for customers, tasks, and versions                        |
| Version management    | `upgrade-agent.sh` for single-agent upgrades, `sync-versions.sh` for daily audit                  |

## One-instance-per-customer deployment model

Each customer gets a dedicated Hetzner cloud server running:

- **OpenClaw gateway** -- systemd service (`openclaw-gateway`), runs as `openclaw` user
- **Falcon Dash** -- systemd service (`falcon-dash`), serves on port 3000
- **Cloudflare tunnel** -- provides `{slug}-agent.fredbot.link` hostname
- **Tailscale** -- private mesh network for SSH access from control-01
- **Netdata** -- system monitoring (Tailscale-only access)

The agent server is isolated: Tailscale ACLs prevent agents from reaching control-01 or other agent servers. All external access goes through Cloudflare Access, which validates tenant email ownership.

### Services on each agent server

| Service                       | Unit name                 | User       | Purpose                                                             |
| ----------------------------- | ------------------------- | ---------- | ------------------------------------------------------------------- |
| OpenClaw gateway              | `openclaw-gateway`        | `openclaw` | Gateway process, agent management                                   |
| Falcon Dash                   | `falcon-dash`             | `openclaw` | Web dashboard on port 3000                                          |
| Device auto-approve (backend) | `fredbot-backend-approve` | `openclaw` | Oneshot: auto-approves `gateway-client` backend pairing at boot     |
| Device auto-approve (UI)      | `fredbot-device-approve`  | `openclaw` | Long-running: watches `devices/pending.json` for UI client pairings |

## Config management

fredbot-backend writes `~/.openclaw/openclaw.json` during provisioning. This file is the source of truth for:

- Gateway settings (port, bind address, auth)
- Agent list (`agents.list[]`) with workspace paths, identity (name/emoji/theme)
- LLM provider and API key configuration
- Plugin configuration

Falcon Dash reads this config:

- **Server-side:** `/api/gateway-config` reads `gateway.auth.token`, `gateway.port`, `gateway.bind` for the WebSocket connection URL and token
- **Server-side:** `src/lib/server/agents/` reads and writes `agents.list[]` for agent CRUD
- **Server-side:** `src/lib/server/pm/workspace-discovery.ts` reads `agents.list[].workspace` for symlink targets

Config writes from Falcon Dash use optimistic concurrency (hash check) to avoid conflicting with external changes.

## Agent provisioning

When a new customer is provisioned:

1. `provision-customer.sh` creates the server, installs dependencies, and writes `openclaw.json`
2. Agent entries are created in `agents.list[]` with workspace paths
3. `sync-peers.sh` runs on the agent server to generate `BOOTSTRAP.md` in each agent workspace (under `.falcon-dash/`)
4. The workspace directory is created empty -- agents self-onboard via `AGENTS.md` on their first conversation

### Agent creation from Falcon Dash

Falcon Dash can also create agents via the UI:

1. `AgentsTab` or `AgentRail` triggers a POST to `/api/agents`
2. Server auto-generates `agent-NNN` ID (zero-padded, auto-increment) if no ID is provided
3. Identity (name/emoji/theme) is optional -- can be set later via edit
4. `createWorkspace()` creates the workspace directory
5. `triggerSyncPeers()` runs `~/.openclaw/sync-peers.sh` to update peer awareness

### BOOTSTRAP.md

The `BOOTSTRAP.md` file lives at `{workspace}/.falcon-dash/BOOTSTRAP.md`. It is:

- Loaded by the `bootstrap-extra-files` hook (not by Falcon Dash directly)
- Managed by `sync-peers.sh` (self-healing: recreated if missing or corrupted)
- In a backend-managed directory (`.falcon-dash/`) that Falcon Dash should not write to

## Monitoring

### Health checks

- `check-heartbeats.sh` monitors stale support tasks (TIMEOUT after no heartbeat)
- Netdata runs on every agent server with custom alert thresholds
- Falcon Dash's `/heartbeat` page shows agent health from the gateway snapshot

### Sentry

Error tracking is available but configuration details are in the fredbot-backend deployment scripts. Falcon Dash itself does not integrate Sentry directly -- errors surface through gateway health events and Netdata monitoring.

## Update rollout

### Version management

Both Falcon Dash and OpenClaw versions are managed by fredbot-backend:

| Mechanism            | Script                                          | Scope                     |
| -------------------- | ----------------------------------------------- | ------------------------- |
| Single-agent upgrade | `upgrade-agent.sh <slug> [component] [version]` | One customer              |
| Version audit        | `sync-versions.sh`                              | All customers, daily cron |
| Version pinning      | Hardcoded in `provision-customer.sh`            | New customers             |
| Self-service upgrade | Support task `upgrade_container` action         | Customer-initiated        |

`sync-versions.sh` reads actual deployed versions and syncs them to CRM fields (`falconDashVersion`, `openClawVersion`).

### Upgrade process

For Falcon Dash:

```bash
# On control-01
scripts/upgrade-agent.sh <slug> falcon-dash <version>
```

This SSHs to the agent server, updates the npm global, and restarts the systemd service. The script updates the CRM version field after successful deployment.

### Pull-based deployment for control-01 itself

Control-01 scripts deploy via a 1-minute cron (`pull-deploy.sh`) that:

1. Git fetches from the repo
2. Validates with shellcheck
3. Performs atomic deploy with rollback capability

## Non-negotiable boundaries

The system has clear ownership boundaries that should not be violated:

### OpenClaw controls

- Gateway protocol and behavior
- Agent process lifecycle
- Session management
- Canvas pipeline
- Plugin SDK and hooks
- Device pairing and authentication

Falcon Dash is a consumer of the gateway protocol. It does not modify gateway behavior except through the plugin SDK (`falcon-dash-plugin/`).

### Falcon Dash controls

- Dashboard UI and user experience
- Chat rendering (markdown pipeline, Shiki, KaTeX, Mermaid)
- PM system (database, context generation, REST API)
- File browser and editor
- Password vault integration
- Store layer and component architecture

### fredbot-backend controls

- Server provisioning and deprovisioning
- System-level configuration (`openclaw.json` initial setup)
- LLM API key deployment
- Cloudflare Access and DNS
- Tailscale enrollment and ACLs
- Version management and upgrade rollout
- CRM as source of truth
- Support task execution
- Monitoring infrastructure (Netdata, heartbeats)
- Security model (SSH keys, firewall, audit logging)

Falcon Dash should never directly provision servers, manage DNS, or modify infrastructure. fredbot-backend should never modify the PM database or manage UI state. OpenClaw should never be forked or patched -- use the plugin SDK for customization.
