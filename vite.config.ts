import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
	const envVars = loadEnv(mode, process.cwd(), '');
	const gatewayTarget = envVars.GATEWAY_URL || 'ws://127.0.0.1:18789';

	return {
		define: {
			__APP_VERSION__: JSON.stringify(pkg.version)
		},
		plugins: [tailwindcss(), sveltekit()],
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
