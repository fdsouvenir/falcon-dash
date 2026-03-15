import { json } from '@sveltejs/kit';
import { resolveTokenSync } from '$lib/server/gateway-config.js';

/**
 * Returns the gateway's Control UI URL with auth token.
 *
 * The Control UI loads in an iframe via the SvelteKit HTTP proxy at
 * /api/gateway/proxy/. WebSocket connections on the same path are proxied
 * by entry.js (production) or Vite's dev proxy (development).
 *
 * Token is passed as a URL fragment so the Control UI auto-connects.
 */
export function GET() {
	let url = '/api/gateway/proxy/';
	try {
		const token = resolveTokenSync();
		url += `#token=${token}`;
	} catch {
		// No token configured — show login screen
	}
	return json({ url });
}
