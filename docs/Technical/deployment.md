# Deployment Guide

This guide covers deploying Falcon Dash in production environments.

## Prerequisites

Before deploying Falcon Dash, ensure you have:

- **Node.js 20+** — Required for building and running the application
- **npm** — Included with Node.js; used for dependency installation and build scripts
- **OpenClaw Gateway** — A running instance of the OpenClaw gateway (default: `ws://127.0.0.1:18789`)
- **Gateway Plugins** — The `openclaw-canvas-bridge` and `openclaw-pm` plugins installed on your gateway

## Local Development

### Quick Start

```bash
git clone https://github.com/fdsouvenir/falcon-dash.git
cd falcon-dash
npm install
npm run dev
```

Open `http://localhost:5173`. The dashboard reads gateway configuration from `~/.openclaw/openclaw.json` automatically.

### Vite Proxy

In development, Vite proxies `/ws` to the gateway so the browser connects through the dev server. This is configured in `vite.config.ts`:

```ts
server: {
    proxy: {
        '/ws': {
            target: gatewayTarget, // from GATEWAY_URL env or ws://127.0.0.1:18789
            ws: true
        }
    }
}
```

### Remote Gateway

To develop against a gateway running on another machine, create a `.env` file:

```bash
GATEWAY_URL=ws://192.168.x.x:18789
GATEWAY_TOKEN=your-gateway-token
```

On the gateway machine, configure access:

1. Set `gateway.bind: "lan"` in `~/.openclaw/openclaw.json`
2. Add `gateway.controlUi.allowedOrigins: ["http://localhost:5173"]`
3. Approve the dev machine pairing: `openclaw devices approve`

### Useful Scripts

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

## Production Build

Falcon Dash uses the SvelteKit Node adapter (`@sveltejs/adapter-node`). Running `npm run build` produces a standalone Node.js server in the `build/` directory:

```bash
npm run build
```

Start the built server:

```bash
node build/index.js
```

The server listens on port 3000 by default. Override with `PORT` and `HOST` environment variables.

## Environment Variables

| Variable             | Required  | Default                | Description                                                            |
| -------------------- | --------- | ---------------------- | ---------------------------------------------------------------------- |
| `GATEWAY_URL`        | No        | `ws://127.0.0.1:18789` | WebSocket URL of the OpenClaw gateway                                  |
| `GATEWAY_TOKEN`      | No        | —                      | Gateway authentication token (auto-read from config if not set)        |
| `ORIGIN`             | For HTTPS | —                      | Production URL (e.g., `https://falcon.example.com`). Enables WSS proxy |
| `PORT`               | No        | `3000`                 | Server listen port                                                     |
| `HOST`               | No        | `0.0.0.0`              | Server bind address                                                    |
| `OPENCLAW_DATA_DIR`  | No        | `~/.openclaw/data`     | Override the data directory for PM database and context files          |
| `SENTRY_DSN`         | No        | —                      | Sentry error tracking DSN                                              |
| `SENTRY_ENVIRONMENT` | No        | `production`           | Sentry environment tag (e.g., `staging`, `production`)                 |
| `SENTRY_AUTH_TOKEN`  | No        | —                      | Sentry auth token for source map upload (build-time only)              |
| `SENTRY_ORG`         | No        | —                      | Sentry organization slug (required with `SENTRY_AUTH_TOKEN`)           |
| `SENTRY_PROJECT`     | No        | —                      | Sentry project slug (required with `SENTRY_AUTH_TOKEN`)                |

### Auto-Configuration

If `GATEWAY_URL` and `GATEWAY_TOKEN` are not set, Falcon Dash reads the gateway configuration from `~/.openclaw/openclaw.json` via the `/api/gateway-config` endpoint. If that file is unavailable (e.g., in containerized deployments), users see a manual token entry screen on first visit. The token and URL are persisted to `localStorage` in the browser.

When `ORIGIN` is set to an `https://` URL, the gateway config endpoint derives a `wss://` WebSocket URL so the browser connects through the reverse proxy instead of directly to the gateway.

For production deployments, set `GATEWAY_URL` and `GATEWAY_TOKEN` explicitly.

## Gateway Configuration

Falcon Dash connects to the OpenClaw Gateway using WebSocket protocol v3. The gateway configuration lives in `~/.openclaw/openclaw.json`.

### Key Fields

```json
{
	"gateway": {
		"port": 18789,
		"bind": "loopback",
		"auth": {
			"token": "your-gateway-token"
		},
		"controlUi": {
			"allowInsecureAuth": true,
			"allowedOrigins": ["https://falcon.example.com"]
		}
	}
}
```

### Authentication Modes

- **Device pairing (default)** — The dashboard generates an Ed25519 keypair via WebCrypto and signs the gateway's challenge. The device must be approved before it can connect. This is the secure default for production.
- **Insecure auth (dev only)** — Set `gateway.controlUi.allowInsecureAuth: true` to allow token-only authentication without device pairing. Only use this for local development.

### Bind Modes

- `"loopback"` (default) — Gateway listens on `127.0.0.1` only. Use this when the dashboard runs on the same machine.
- `"lan"` — Gateway listens on the LAN interface. Required when the dashboard runs on a different machine or in a container.

### Trusted Proxy

When running behind a reverse proxy (Nginx, Cloudflare, etc.), the gateway receives connections from the proxy, not the end user. Ensure your reverse proxy forwards the standard headers (`X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`) so the gateway can identify the real client.

## Docker Deployment

### Pre-Built Image

Pull the pre-built image from GitHub Container Registry:

```bash
docker pull ghcr.io/fdsouvenir/falcon-dash:latest

# Run with default settings
docker run -p 3000:3000 ghcr.io/fdsouvenir/falcon-dash:latest

# Run with custom gateway URL and token
docker run -p 3000:3000 \
  -e GATEWAY_URL=ws://your-gateway-host:18789 \
  -e GATEWAY_TOKEN=your-gateway-token \
  ghcr.io/fdsouvenir/falcon-dash:latest
```

### Build Locally

```bash
docker build -t falcon-dash .
docker run -p 3000:3000 falcon-dash
```

The Dockerfile uses a multi-stage build:

1. **Builder stage** — Node 22 slim with build tools (python3, make, g++ for native modules), runs `npm ci`, `npm run build`, and `npm prune --production`
2. **Runtime stage** — Node 22 slim with KeePassXC (for password vault), copies the built output, production `node_modules`, and `package.json`

### Docker Compose

For a complete deployment with the gateway and dashboard together:

```yaml
version: '3.8'

services:
  gateway:
    image: ghcr.io/fdsouvenir/openclaw:latest
    container_name: openclaw-gateway
    ports:
      - '18789:18789'
    volumes:
      - openclaw-data:/root/.openclaw
    restart: unless-stopped

  dashboard:
    image: ghcr.io/fdsouvenir/falcon-dash:latest
    container_name: falcon-dash
    ports:
      - '3000:3000'
    environment:
      - GATEWAY_URL=ws://gateway:18789
      - GATEWAY_TOKEN=${GATEWAY_TOKEN}
      - ORIGIN=https://your-domain.com
    volumes:
      - openclaw-data:/root/.openclaw
    depends_on:
      - gateway
    restart: unless-stopped

volumes:
  openclaw-data:
```

Create a `.env` file with your gateway token:

```bash
GATEWAY_TOKEN=your-gateway-token-here
```

Start the stack:

```bash
docker-compose up -d
```

## PM Database

The Project Management system uses better-sqlite3 with WAL mode. The database file is located at:

```
~/.openclaw/data/pm.db
```

Override the data directory with the `OPENCLAW_DATA_DIR` environment variable. The directory is created automatically if it doesn't exist.

### Docker Volume Mounts

In Docker deployments, mount the OpenClaw data directory to persist the PM database across container restarts:

```bash
docker run -p 3000:3000 \
  -v ~/.openclaw:/root/.openclaw \
  -e GATEWAY_URL=ws://host.docker.internal:18789 \
  -e GATEWAY_TOKEN=your-token \
  ghcr.io/fdsouvenir/falcon-dash:latest
```

Or use a named volume in Docker Compose (see the Compose example above — both `gateway` and `dashboard` share the `openclaw-data` volume).

### PM Context Pipeline

Falcon Dash generates markdown context files that give agents read access to PM data:

- **Shared directory:** `~/.openclaw/data/pm-context/` (override via `PM_CONTEXT_DIR` env var)
- **Files generated:** `PROJECTS.md`, `Projects/{id}.md`, `PM-API.md`
- **Symlinks:** created in each agent workspace discovered from `~/.openclaw/openclaw.json`

These files are regenerated automatically after PM mutations (debounced at 5 seconds, max staleness 60 seconds).

### Backups

The PM database is a single SQLite file. Back it up by copying the file while the server is stopped, or use SQLite's `.backup` command:

```bash
sqlite3 ~/.openclaw/data/pm.db ".backup /path/to/backup.db"
```

## Reverse Proxy (Nginx)

When deploying behind a reverse proxy, configure WebSocket proxying and set the `ORIGIN` environment variable.

### Nginx Configuration

```nginx
upstream falcon_dash {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name falcon.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name falcon.example.com;

    ssl_certificate /etc/ssl/certs/falcon.example.com.crt;
    ssl_certificate_key /etc/ssl/private/falcon.example.com.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    location / {
        proxy_pass http://falcon_dash;
        proxy_http_version 1.1;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for WebSocket connections
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

### ORIGIN Variable

When running behind a reverse proxy with HTTPS, set the `ORIGIN` environment variable:

```bash
ORIGIN=https://falcon.example.com node build/index.js
```

This tells SvelteKit the external URL and causes the gateway config endpoint to derive `wss://` URLs so the browser connects through the proxy.

## Cloudflare Access / Tunnel

Falcon Dash can be deployed behind Cloudflare Access for zero-trust authentication and Cloudflare Tunnel for secure ingress without exposing ports.

### Cloudflare Tunnel Setup

1. Install `cloudflared` on the machine running Falcon Dash
2. Authenticate: `cloudflared tunnel login`
3. Create a tunnel: `cloudflared tunnel create falcon-dash`
4. Configure the tunnel to route to the local dashboard:

```yaml
# ~/.cloudflared/config.yml
tunnel: <your-tunnel-id>
credentials-file: ~/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: falcon.example.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: false
  - service: http_status:404
```

5. Route DNS: `cloudflared tunnel route dns falcon-dash falcon.example.com`
6. Run the tunnel: `cloudflared tunnel run falcon-dash`

Set `ORIGIN` on the dashboard:

```bash
ORIGIN=https://falcon.example.com node build/index.js
```

### Cloudflare Access Policy

1. In the Cloudflare Zero Trust dashboard, go to **Access > Applications**
2. Create a self-hosted application for `falcon.example.com`
3. Configure an access policy (e.g., email domain, identity provider, or one-time PIN)
4. Cloudflare Access handles authentication before requests reach Falcon Dash

### WebSocket Considerations

Cloudflare supports WebSocket proxying by default. Ensure the `/ws` path is not blocked by any WAF rules, as the gateway connection depends on it.

## Gateway Plugins

Falcon Dash requires two gateway plugins to function fully:

### Canvas Operator Bridge

Routes the agent's canvas commands to the dashboard UI. This enables rich A2UI surfaces.

```bash
cd openclaw-canvas-bridge
npm install
npm run build
openclaw plugins install ./openclaw-canvas-bridge
```

### Project Management (openclaw-pm)

Provides the PM backend with SQLite storage at `~/.openclaw/data/pm.db`.

```bash
cd openclaw-pm
npm install
npm run build
openclaw plugins install ./openclaw-pm
```

After installing plugins, restart the OpenClaw gateway:

```bash
openclaw restart
```

## Health Checks

Falcon Dash exposes health check endpoints for monitoring and load balancer integration.

### `/api/health`

Basic health check that returns `200 OK` if the application is running.

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
	"status": "ok",
	"version": "0.4.10",
	"uptime": 3600
}
```

### `/api/ready`

Readiness check that returns `200 OK` when the server can handle requests.

```bash
curl http://localhost:3000/api/ready
```

Response:

```json
{
	"ready": true
}
```

## Updating

### Docker

Pull the latest image and restart:

```bash
docker pull ghcr.io/fdsouvenir/falcon-dash:latest
docker-compose up -d
```

### Manual

Pull the latest code, rebuild, and restart:

```bash
cd falcon-dash
git pull
npm ci --production=false
npm run build
pm2 restart falcon-dash
```

## Troubleshooting

### Gateway Connection Issues

If the dashboard cannot connect to the gateway:

1. Verify the gateway is running and accessible at the configured URL
2. Check that `GATEWAY_URL` is set correctly (use `ws://` for local, `ws://host:port` for remote)
3. Ensure `GATEWAY_TOKEN` matches the token in `~/.openclaw/openclaw.json`
4. Check gateway logs for authentication errors
5. For dev environments, enable `gateway.controlUi.allowInsecureAuth: true` in the gateway config

### WebSocket Proxy Errors

If you see WebSocket errors in production:

1. Verify `ORIGIN` is set to your HTTPS URL
2. Check Nginx/Cloudflare WebSocket headers are configured correctly
3. Ensure SSL certificates are valid
4. Check browser console for mixed content warnings (HTTP/HTTPS)

### Permission Issues

If the application cannot read `~/.openclaw/openclaw.json`:

1. Ensure the file exists and is readable by the user running the application
2. In Docker, mount the OpenClaw config directory as a volume
3. Alternatively, set `GATEWAY_URL` and `GATEWAY_TOKEN` explicitly via environment variables

### Plugin Missing

If PM or Canvas features don't work:

1. Verify plugins are installed: `openclaw plugins list`
2. Check plugin build output for errors
3. Restart the gateway after installing plugins
4. Check gateway logs for plugin initialization messages

### PM Database Issues

If PM data is missing after a restart:

1. Check that the data directory is persisted (Docker volume or host mount)
2. Verify the directory is writable: `ls -la ~/.openclaw/data/`
3. Check for SQLite lock issues: ensure only one instance accesses the database
