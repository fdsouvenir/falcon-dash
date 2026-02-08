import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Falcon Dash',
				short_name: 'Falcon Dash',
				description: 'Web dashboard for the OpenClaw AI platform',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
				navigateFallback: '/',
				runtimeCaching: [
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'images',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 * 30
							}
						}
					},
					{
						urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'fonts',
							expiration: {
								maxEntries: 30,
								maxAgeSeconds: 60 * 60 * 24 * 365
							}
						}
					},
					{
						urlPattern: /\.(?:js|css)$/,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'static-resources',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 * 7
							}
						}
					}
				]
			}
		})
	]
});
