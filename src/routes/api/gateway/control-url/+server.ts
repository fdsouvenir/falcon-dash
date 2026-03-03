import { json } from '@sveltejs/kit';
import { readGatewayUrlSync } from '$lib/server/gateway-config.js';

/**
 * Returns the gateway's HTTP control UI URL.
 * Uses env vars or ~/.openclaw/openclaw.json — does NOT depend on
 * an active gateway connection.
 */
export function GET() {
	try {
		const httpUrl = readGatewayUrlSync();
		return json({ url: new URL(httpUrl).origin });
	} catch {
		return json({ error: 'Could not read gateway configuration.' }, { status: 500 });
	}
}
