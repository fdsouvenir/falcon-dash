import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			'/ws': {
				target: 'ws://127.0.0.1:18789',
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
});
