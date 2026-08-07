# Deployment

Falcon Dash is an adapter-node SvelteKit application packaged as
`@fdsouvenir/falcon-dash`. It runs on the same host as OpenClaw. Docker images, remote gateways,
fredbot-backend, and an external vault are not current product requirements.

## Runtime requirements

- Node.js 20 or newer;
- an OpenClaw Gateway on the same machine;
- `keepassxc-cli` plus Falcon Dash's KeePassXC database and key file;
- a writable Falcon Dash data directory;
- the Falcon Dash gateway extension when Falcon-specific prompt context or plugin capabilities are
  required.

The last two provisioning paths are not yet fully automated by the package installer. Treat that as
an installation gap, not as permission to make them optional product components.

## Development from source

```bash
npm ci
npm run dev
```

Vite serves the development UI, starts server hooks, and provides development proxy behavior. The
default Vite URL is normally `http://127.0.0.1:5173`; use the URL printed by Vite as authoritative.

For a production-like local build:

```bash
npm run build
node build/start.js
```

`postbuild` copies `src/entry.js` into the adapter-node output as `build/start.js`. That wrapper
attaches `/terminal-ws` and Gateway Control UI WebSocket upgrades to the same HTTP server.

## Package installation

Tagged releases publish `@fdsouvenir/falcon-dash` to GitHub Packages. Registry authentication and
scope configuration are required before installation. The package exposes:

- `falcon-dash start` — start the built server;
- `falcon-dash path` — print the installed package root;
- `falcon-dash version` — print the package version;
- `falcon` — the Work agent/operator CLI.

`postinstall` copies only the namespaced runtime skills `falcon-dash`, `falcon-dash-work`, and
`falcon-dash-vault` into `~/.openclaw/skills/`. The allowlist is intentional: developer workflows
and generic skill names must not be installed into an operator's OpenClaw environment.

`falcon-dash start` defaults to port `3000` and host `0.0.0.0`. Override with `--port=`, `--host=`,
`FALCON_DASH_PORT`, or `FALCON_DASH_HOST`.

## Environment

| Variable                                 | Purpose                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `GATEWAY_URL`                            | Explicit same-host WebSocket URL, including a private container service name |
| `GATEWAY_TOKEN`                          | Explicit OpenClaw gateway token                                              |
| `OPENCLAW_GATEWAY_TOKEN`                 | Secondary gateway-token environment name                                     |
| `FALCON_DASH_PORT` / `FALCON_DASH_HOST`  | Package launcher listen address                                              |
| `PORT` / `HOST`                          | Direct adapter-node listen address                                           |
| `ORIGIN`                                 | Public production origin when deployed behind HTTPS                          |
| `FALCON_DASH_DATA_DIR`                   | Root for Work databases and token files                                      |
| `FALCON_DASH_WORK3_DATABASE_PATH`        | Canonical Work database override                                             |
| `FALCON_DASH_WORK3_EVENTS_DATABASE_PATH` | Work event-log database override                                             |
| `FALCON_DASH_URL`                        | Same-host base URL used by the gateway context hook                          |
| `FALCON_DASH_TOKEN`                      | Explicit agent token used by the context hook                                |
| `FALCON_AGENT_ID`                        | Selects a per-agent token file for context injection                         |

When the gateway URL/token are not explicit, Falcon Dash reads the OpenClaw CLI configuration and
then `~/.openclaw/openclaw.json`. Local configuration must provide a port and auth token. Do not
configure another-host gateway as a deployment shortcut.

## Data and files

Default paths are under the co-resident OpenClaw home:

| Path                                           | Contents                                          |
| ---------------------------------------------- | ------------------------------------------------- |
| `~/.openclaw/data/falcon-dash/work3.db`        | canonical Work data and outbox                    |
| `~/.openclaw/data/falcon-dash/work3-events.db` | append-only Work event history                    |
| `~/.openclaw/data/falcon-dash/tokens/`         | agent token files used by local context injection |
| `~/.openclaw/passwords.kdbx`                   | built-in vault database                           |
| `~/.openclaw/vault.key`                        | built-in vault key file                           |
| `~/.falcon-dash/server-identity.json`          | server gateway device identity and device token   |

Back up both Work databases together and the vault database with its key file. Protect token and key
files with restrictive permissions. Do not commit any of them.

## Reverse proxy

A reverse proxy may terminate HTTPS and forward to the local Falcon Dash server. It must preserve:

- ordinary HTTP requests;
- SSE responses without buffering for `/api/gateway/events` and `/api/work3/events`;
- WebSocket upgrades for `/terminal-ws` and `/api/gateway/proxy`;
- the public `ORIGIN` used by SvelteKit.

The OpenClaw Gateway itself should remain on loopback or a same-host private network. Expose Falcon
Dash, not the raw gateway, as the application boundary.

## Health and operations

Use `/api/health` and `/api/ready` for service checks. A ready Falcon Dash process can still have a
disconnected gateway; gateway-backed pages must show that condition explicitly while local Work
and diagnostics remain truthful.

Falcon Dash does not prescribe systemd, a container runtime, or another process manager. A chosen
manager must run the package command, provide the environment above, preserve the local filesystem,
and restart cleanly on failure.

## Release path

`.github/workflows/publish.yml` publishes on `v*` tags after `npm ci`. `prepublishOnly` builds the
application and CLI. Before a release, run the repo validation required by [../QUALITY.md](../QUALITY.md)
and verify a clean installation on a machine that does not contain a developer checkout.

Run release validation after `npm ci`, not against an existing `node_modules`. The lockfile is the
authoritative toolchain for CI and publishing, including Prettier. Formatting committed for a
release must be produced and checked with the exact formatter version recorded in `package-lock.json`.

That clean-install test must include OpenClaw discovery, vault provisioning, SecretRef resolution,
gateway extension installation, Work database creation, and agent context injection. At present,
the vault and extension steps expose known packaging gaps.
