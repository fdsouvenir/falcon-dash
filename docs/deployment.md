# Deployment Guide

This guide covers deploying Falcon Dash in production environments.

## Prerequisites

Before deploying Falcon Dash, ensure you have:

- **Node.js 20+** — Required for building and running the application
- **OpenClaw Gateway** — A running instance of the OpenClaw gateway (default: `ws://127.0.0.1:18789`)
- **Gateway Plugins** — The `openclaw-canvas-bridge` and `openclaw-pm` plugins installed on your gateway

## Docker (Quick Start)

The fastest way to deploy Falcon Dash is using the pre-built Docker image from GitHub Container Registry.

```bash
# Pull the latest image
docker pull ghcr.io/fdsouvenir/falcon-dash:latest

# Run with default settings
docker run -p 3000:3000 ghcr.io/fdsouvenir/falcon-dash:latest

# Run with custom gateway URL and token
docker run -p 3000:3000 \
  -e GATEWAY_URL=ws://your-gateway-host:18789 \
  -e GATEWAY_TOKEN=your-gateway-token \
  ghcr.io/fdsouvenir/falcon-dash:latest
```

The dashboard will be available at `http://localhost:3000`.

## Docker Compose

For a complete deployment with the gateway and dashboard together, use Docker Compose:

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

## Manual Deployment (Node.js)

For deployments without Docker, you can build and run Falcon Dash directly with Node.js.

### 1. Clone and Install

```bash
git clone https://github.com/fdsouvenir/falcon-dash.git
cd falcon-dash
npm ci --production=false
```

### 2. Build

```bash
npm run build
```

This creates a production build in the `build/` directory.

### 3. Run

```bash
# Run with default settings
node build/index.js

# Run with custom port and gateway URL
PORT=8080 GATEWAY_URL=ws://your-gateway-host:18789 node build/index.js
```

### 4. Process Manager (Recommended)

Use a process manager like PM2 to keep the application running:

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start build/index.js --name falcon-dash

# Configure to start on boot
pm2 startup
pm2 save
```

## Environment Variables

Falcon Dash is configured using environment variables:

| Variable             | Required  | Default                | Description                                                            |
| -------------------- | --------- | ---------------------- | ---------------------------------------------------------------------- |
| `GATEWAY_URL`        | No        | `ws://127.0.0.1:18789` | WebSocket URL of the OpenClaw gateway                                  |
| `GATEWAY_TOKEN`      | No        | —                      | Gateway authentication token (auto-read from config if not set)        |
| `ORIGIN`             | For HTTPS | —                      | Production URL (e.g., `https://falcon.example.com`). Enables WSS proxy |
| `PORT`               | No        | `3000`                 | Server listen port                                                     |
| `HOST`               | No        | `0.0.0.0`              | Server bind address                                                    |
| `SENTRY_DSN`         | No        | —                      | Sentry error tracking DSN                                              |
| `SENTRY_ENVIRONMENT` | No        | `production`           | Sentry environment tag (e.g., `staging`, `production`)                 |

### Gateway Connection

If `GATEWAY_URL` and `GATEWAY_TOKEN` are not set, Falcon Dash attempts to read the gateway configuration from `~/.openclaw/openclaw.json`. If that file is unavailable (e.g., in containerized deployments), users will see a manual token entry screen on first visit.

For production deployments, it's recommended to set both variables explicitly.

## Reverse Proxy (Nginx)

When deploying behind a reverse proxy, you need to configure WebSocket proxying and set the `ORIGIN` environment variable.

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

### Environment Configuration

When running behind a reverse proxy with HTTPS, set the `ORIGIN` environment variable:

```bash
ORIGIN=https://falcon.example.com node build/index.js
```

This enables the internal WebSocket proxy to use WSS (secure WebSocket) when connecting to the gateway.

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

Falcon Dash exposes health check endpoints for monitoring and load balancer integration:

### `/api/health`

Basic health check that returns `200 OK` if the application is running.

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
	"status": "ok",
	"timestamp": "2026-02-18T12:00:00.000Z"
}
```

### `/api/ready`

Readiness check that verifies gateway connectivity.

```bash
curl http://localhost:3000/api/ready
```

Response:

```json
{
	"status": "ready",
	"gateway": "connected",
	"timestamp": "2026-02-18T12:00:00.000Z"
}
```

Returns `503 Service Unavailable` if the gateway is not connected.

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
2. Check Nginx WebSocket headers are configured correctly
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
