/**
 * Production entry point for Falcon Dash.
 *
 * Imports the adapter-node output and attaches WebSocket upgrade handlers
 * on the same HTTP server — no extra port needed.
 *
 * - /terminal-ws → local PTY shell
 *
 * Dev mode starts its own terminal server from hooks.server.ts.
 */

import { server } from './index.js';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';

const wss = new WebSocketServer({ noServer: true });

server.server.on('upgrade', (req, socket, head) => {
	if (req.url === '/terminal-ws') {
		wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
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
