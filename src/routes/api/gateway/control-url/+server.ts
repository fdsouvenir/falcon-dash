import { json } from '@sveltejs/kit';

/**
 * Returns the gateway's Control UI URL.
 * Now points to the same-origin proxy so the iframe works behind
 * Cloudflare Access (no CSP / loopback issues).
 */
export function GET() {
	return json({ url: '/api/gateway/proxy/' });
}
