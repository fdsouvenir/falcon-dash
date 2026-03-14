import { json } from '@sveltejs/kit';
import { resolveTokenSync } from '$lib/server/gateway-config.js';

/**
 * Returns the gateway's Control UI URL with auth token.
 * Points to the same-origin proxy so the iframe works behind
 * Cloudflare Access (no CSP / loopback issues).
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
