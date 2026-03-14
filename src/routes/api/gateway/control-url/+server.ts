import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { resolveTokenSync } from '$lib/server/gateway-config.js';

/**
 * Returns the gateway's Control UI URL with auth token.
 *
 * In production (GATEWAY_CONTROL_PATH set), returns the Cloudflare Tunnel
 * path (e.g. /setup) which routes directly to the gateway — supporting
 * both HTTP and WebSocket.
 *
 * In dev (no GATEWAY_CONTROL_PATH), falls back to the SvelteKit HTTP proxy
 * at /api/gateway/proxy/ which works for HTTP but not WebSocket.
 *
 * Token is passed as a URL fragment so the Control UI auto-connects.
 */
export function GET() {
	let url = env.GATEWAY_CONTROL_PATH || '/api/gateway/proxy/';
	try {
		const token = resolveTokenSync();
		url += `#token=${token}`;
	} catch {
		// No token configured — show login screen
	}
	return json({ url });
}
