import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getGatewayClient } from '$lib/server/gateway-client.js';

export const POST: RequestHandler = async ({ request }) => {
	let body: { method: string; params?: Record<string, unknown> };
	try {
		body = await request.json();
	} catch {
		return json(
			{ ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } },
			{ status: 400 }
		);
	}

	if (!body.method || typeof body.method !== 'string') {
		return json(
			{ ok: false, error: { code: 'INVALID_REQUEST', message: 'Missing method' } },
			{ status: 400 }
		);
	}

	const client = getGatewayClient();
	if (client.state !== 'ready') {
		return json(
			{ ok: false, error: { code: 'GATEWAY_NOT_READY', message: `Gateway ${client.state}` } },
			{ status: 503 }
		);
	}

	try {
		const payload = await client.call(body.method, body.params);
		return json({ ok: true, payload });
	} catch (err) {
		const error = err as Error & { code?: string; details?: unknown };
		return json(
			{
				ok: false,
				error: {
					code: error.code ?? 'RPC_ERROR',
					message: error.message,
					details: error.details
				}
			},
			{ status: 502 }
		);
	}
};
