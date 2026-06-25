import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vitest/config';
import { loadEnv, type ViteDevServer } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json' with { type: 'json' };

interface OpenClawGatewayConfig {
	mode?: string;
	port?: number;
	bind?: string;
	auth?: {
		token?: string;
	};
	remote?: {
		url?: string;
		token?: string;
	};
}

function tokenFromGateway(gateway: OpenClawGatewayConfig): string | undefined {
	if (gateway.mode === 'remote') {
		return gateway.remote?.token ?? gateway.auth?.token;
	}
	return gateway.auth?.token;
}

function wsUrlFromGateway(gateway: OpenClawGatewayConfig): string | undefined {
	if (gateway.mode === 'remote' && gateway.remote?.url) {
		return gateway.remote.url;
	}
	if (!gateway.port) return undefined;
	const bind = gateway.bind ?? 'loopback';
	const host = bind === 'loopback' ? '127.0.0.1' : bind === 'lan' ? '0.0.0.0' : bind;
	return `ws://${host}:${gateway.port}`;
}

/**
 * Resolve gateway WebSocket URL and auth token from env vars or config file.
 * Runs once at Vite startup for the dev WS proxy.
 */
function resolveGatewayForDev() {
	let token = process.env.GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN;
	let wsUrl = process.env.GATEWAY_URL;

	if (!token || !wsUrl) {
		try {
			const raw = readFileSync(join(homedir(), '.openclaw', 'openclaw.json'), 'utf-8');
			const config = JSON.parse(raw);
			const gateway = (config?.gateway ?? {}) as OpenClawGatewayConfig;
			if (!token) token = tokenFromGateway(gateway);
			if (!wsUrl) wsUrl = wsUrlFromGateway(gateway);
		} catch {
			/* config unreadable — fall through */
		}
	}
	return { wsUrl: wsUrl || 'ws://127.0.0.1:28789', token };
}

/**
 * Vite plugin: proxy WebSocket upgrades on /api/gateway/proxy to the gateway.
 *
 * Uses a custom `configureServer` hook instead of Vite's built-in `proxy` config
 * so that only WS upgrade requests are intercepted — HTTP requests on the same
 * path continue through to the SvelteKit route (which strips X-Frame-Options
 * and rewrites asset paths for the iframe).
 */
function gatewayWsProxy() {
	return {
		name: 'gateway-ws-proxy',
		async configureServer(server: ViteDevServer) {
			const ws = await import('ws');
			const WebSocketServer = ws.WebSocketServer;
			const WebSocket = ws.WebSocket;
			const wss = new WebSocketServer({ noServer: true });
			const { wsUrl, token } = resolveGatewayForDev();

			server.httpServer?.on(
				'upgrade',
				(
					req: import('node:http').IncomingMessage,
					socket: import('node:stream').Duplex,
					head: Buffer
				) => {
					if (!req.url?.startsWith('/api/gateway/proxy')) return;

					wss.handleUpgrade(req, socket, head, (clientWs) => {
						const targetPath =
							(req.url ?? '/api/gateway/proxy').replace('/api/gateway/proxy', '') || '/';
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
			);

			console.log(`[gateway-ws-proxy] Dev WS proxy → ${wsUrl}`);
		}
	};
}

export default defineConfig(({ mode }) => {
	const envVars = loadEnv(mode, process.cwd(), '');

	return {
		define: {
			__APP_VERSION__: JSON.stringify(pkg.version),
			__SENTRY_DSN__: JSON.stringify(envVars.SENTRY_DSN || ''),
			__SENTRY_ENVIRONMENT__: JSON.stringify(envVars.SENTRY_ENVIRONMENT || 'production')
		},
		plugins: [
			gatewayWsProxy(),
			tailwindcss(),
			sveltekit(),
			...(process.env.ANALYZE === 'true'
				? [
						visualizer({
							filename: 'stats.html',
							open: false,
							gzipSize: true,
							brotliSize: true
						})
					]
				: []),
			...(envVars.SENTRY_AUTH_TOKEN
				? [
						sentryVitePlugin({
							org: envVars.SENTRY_ORG,
							project: envVars.SENTRY_PROJECT,
							authToken: envVars.SENTRY_AUTH_TOKEN,
							release: { name: pkg.version },
							sourcemaps: { filesToDeleteAfterUpload: ['./build/**/*.map'] }
						})
					]
				: [])
		],
		build: {
			sourcemap: !!envVars.SENTRY_AUTH_TOKEN
		},
		server: {
			host: '0.0.0.0',
			proxy: {
				'/terminal-ws': {
					target: 'ws://localhost:3001',
					ws: true
				}
			}
		},
		test: {
			include: ['src/**/*.test.ts'],
			environment: 'happy-dom',
			coverage: {
				provider: 'v8',
				reporter: ['text', 'lcov']
			}
		}
	};
});
