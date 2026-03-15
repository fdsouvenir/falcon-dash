import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json' with { type: 'json' };

// Read gateway target for dev WS proxy (runs once at startup)
let gatewayTarget = 'http://localhost:28789'; // fallback only if config unreadable
try {
	const raw = readFileSync(join(homedir(), '.openclaw', 'openclaw.json'), 'utf-8');
	const config = JSON.parse(raw);
	const port = config?.gateway?.port;
	const bind = config?.gateway?.bind ?? 'loopback';
	const host = bind === 'loopback' ? '127.0.0.1' : bind === 'lan' ? '0.0.0.0' : bind;
	if (port) gatewayTarget = `http://${host}:${port}`;
} catch {
	/* use fallback */
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
				},
				'/api/gateway/proxy': {
					target: gatewayTarget,
					ws: true,
					rewrite: (path) => path.replace(/^\/api\/gateway\/proxy/, '')
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
