import { WebSocketServer, type WebSocket } from 'ws';
import * as pty from 'node-pty';

const TERMINAL_WS_PORT = parseInt(process.env.TERMINAL_WS_PORT || '3001', 10);

let wss: WebSocketServer | null = null;

export function startTerminalServer(): void {
	if (wss) return; // idempotent

	wss = new WebSocketServer({ port: TERMINAL_WS_PORT });
	console.log(`[terminal] WebSocket server listening on port ${TERMINAL_WS_PORT}`);

	wss.on('connection', (ws: WebSocket) => {
		const shell = process.env.SHELL || 'bash';
		const ptyProcess = pty.spawn(shell, [], {
			name: 'xterm-256color',
			cols: 80,
			rows: 24,
			cwd: process.env.HOME || '/',
			env: process.env as Record<string, string>
		});

		ptyProcess.onData((data: string) => {
			if (ws.readyState === ws.OPEN) {
				ws.send(data);
			}
		});

		ptyProcess.onExit(() => {
			if (ws.readyState === ws.OPEN) {
				ws.close();
			}
		});

		ws.on('message', (raw: Buffer | string) => {
			try {
				const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
				if (msg.type === 'input') {
					ptyProcess.write(msg.data);
				} else if (msg.type === 'resize' && msg.cols && msg.rows) {
					ptyProcess.resize(msg.cols, msg.rows);
				}
			} catch {
				// Not JSON — treat as raw input
				ptyProcess.write(typeof raw === 'string' ? raw : raw.toString());
			}
		});

		ws.on('close', () => {
			ptyProcess.kill();
		});

		ws.on('error', () => {
			ptyProcess.kill();
		});
	});

	// Cleanup on SvelteKit shutdown
	process.on('sveltekit:shutdown', () => {
		if (wss) {
			for (const client of wss.clients) {
				client.close();
			}
			wss.close();
			wss = null;
		}
	});
}
