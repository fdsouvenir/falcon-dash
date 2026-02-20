import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
	const envVars = loadEnv(mode, process.cwd(), '');
	const gatewayTarget = envVars.GATEWAY_URL || 'ws://127.0.0.1:18789';

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
			proxy: {
				'/ws': {
					target: gatewayTarget,
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
