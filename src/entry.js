/**
 * Production entry point for Falcon Dash.
 *
 * Imports the adapter-node output and attaches WebSocket upgrade handlers
 * on the same HTTP server — no extra port needed.
 *
 * - /terminal-ws → local PTY shell
 * - /api/gateway/proxy → proxied to the OpenClaw gateway (Control UI WS)
 *
 * Dev mode uses Vite's built-in proxy for both paths instead.
 */

import { server } from './index.js';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import pty from 'node-pty';

/**
 * Resolve gateway WebSocket URL and auth token.
 * Reads from env vars or ~/.openclaw/openclaw.json (mirrors gateway-config.ts
 * but without $env/dynamic/private which isn't available in entry.js).
 * Resolved per-connection so config changes don't require a restart.
 */
function resolveGatewayConfig() {
	let token = process.env.GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN;
	let wsUrl = process.env.GATEWAY_URL;

	if (!token || !wsUrl) {
		try {
			const raw = readFileSync(join(homedir(), '.openclaw', 'openclaw.json'), 'utf-8');
			const config = JSON.parse(raw);
			if (!token) {
				token = config?.gateway?.auth?.token;
			}
			if (!wsUrl) {
				const port = config?.gateway?.port;
				const bind = config?.gateway?.bind ?? 'loopback';
				const host = bind === 'loopback' ? '127.0.0.1' : bind === 'lan' ? '0.0.0.0' : bind;
				wsUrl = `ws://${host}:${port}`;
			}
		} catch {
			// Config file unreadable — fall through with whatever we have
		}
	}

	return { wsUrl, token };
}

const wss = new WebSocketServer({ noServer: true });
const gatewayProxyWss = new WebSocketServer({ noServer: true });

server.server.on('upgrade', (req, socket, head) => {
	if (req.url === '/terminal-ws') {
		wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
	} else if (req.url && req.url.startsWith('/api/gateway/proxy')) {
		gatewayProxyWss.handleUpgrade(req, socket, head, (clientWs) => {
			const { wsUrl, token } = resolveGatewayConfig();
			// Strip proxy prefix so the gateway sees the original path
			const targetPath = (req.url || '').replace('/api/gateway/proxy', '') || '/';
			const headers = token ? { Authorization: `Bearer ${token}` } : {};
			const upstream = new WebSocket(`${wsUrl}${targetPath}`, { headers });

			upstream.on('open', () => {
				clientWs.on('message', (data) => {
					if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
				});
				upstream.on('message', (data) => {
					if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
				});
			});

			upstream.on('close', (code, reason) => clientWs.close(code, reason));
			clientWs.on('close', () => upstream.close());
			upstream.on('error', () => clientWs.close());
			clientWs.on('error', () => upstream.close());
		});
	}
});

wss.on('connection', (ws) => {
	const shell = process.env.SHELL || 'bash';
	const proc = pty.spawn(shell, [], {
		name: 'xterm-256color',
		cols: 80,
		rows: 24,
		cwd: process.env.HOME || '/',
		env: process.env
	});

	proc.onData((data) => {
		if (ws.readyState === 1) ws.send(data);
	});

	proc.onExit(() => {
		if (ws.readyState === 1) ws.close();
	});

	ws.on('message', (raw) => {
		try {
			const msg = JSON.parse(raw.toString());
			if (msg.type === 'input') proc.write(msg.data);
			else if (msg.type === 'resize' && msg.cols && msg.rows) proc.resize(msg.cols, msg.rows);
		} catch {
			proc.write(raw.toString());
		}
	});

	ws.on('close', () => proc.kill());
	ws.on('error', () => proc.kill());
});

console.log('[terminal] WebSocket upgrade handler attached to HTTP server');
