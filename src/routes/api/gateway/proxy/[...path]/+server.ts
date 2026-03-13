import type { RequestHandler } from './$types.js';
import { readGatewayUrlSync, resolveTokenSync } from '$lib/server/gateway-config.js';

/**
 * Reverse-proxy every HTTP method to the gateway's Control UI.
 * Solves the CSP / loopback-unreachable problem when Falcon Dash
 * is accessed through Cloudflare Access or any other reverse proxy.
 */
const handler: RequestHandler = async ({ params, request, url }) => {
	const baseUrl = readGatewayUrlSync(); // e.g. http://127.0.0.1:28789
	const path = params.path ?? '';
	const target = new URL(`/${path}${url.search}`, baseUrl);

	const headers = new Headers(request.headers);
	// Remove host header so the gateway sees its own host
	headers.delete('host');

	// Add auth token
	try {
		const token = resolveTokenSync();
		headers.set('Authorization', `Bearer ${token}`);
	} catch {
		// Token not configured — let the request through anyway;
		// the gateway will reject if auth is required.
	}

	try {
		const proxyRes = await fetch(target.href, {
			method: request.method,
			headers,
			body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
			// @ts-expect-error -- Node fetch supports duplex for streaming bodies
			duplex: request.method !== 'GET' && request.method !== 'HEAD' ? 'half' : undefined,
			redirect: 'manual'
		});

		// Build response headers, stripping hop-by-hop headers
		const resHeaders = new Headers(proxyRes.headers);
		for (const h of ['transfer-encoding', 'connection', 'keep-alive']) {
			resHeaders.delete(h);
		}

		return new Response(proxyRes.body, {
			status: proxyRes.status,
			statusText: proxyRes.statusText,
			headers: resHeaders
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: 'Gateway unreachable', details: String(err) }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
