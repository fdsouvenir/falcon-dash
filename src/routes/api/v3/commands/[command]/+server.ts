import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { executeCommand } from '$lib/server/work3/index.js';
import { requireAgentActor, work3ErrorResponse } from '$lib/server/work3/http.js';

/**
 * Single mutation dispatch route (doc 06): POST /api/v3/commands/[command]
 * with body { target, expected_version, idempotency_key, payload }. Bearer
 * only; the resolved actor is always an agent — this route can never mint a
 * person actor.
 */
export const POST: RequestHandler = async ({ request, params }) => {
	const auth = requireAgentActor(request);
	if ('response' in auth) return auth.response;

	try {
		let body: Record<string, unknown>;
		try {
			body = (await request.json()) as Record<string, unknown>;
		} catch {
			throw new Work3Error('validation_failed', 'Request body must be JSON');
		}
		if (body === null || typeof body !== 'object' || Array.isArray(body)) {
			throw new Work3Error('validation_failed', 'Request body must be a JSON object');
		}
		if (body.payload !== undefined && (typeof body.payload !== 'object' || body.payload === null)) {
			throw new Work3Error('validation_failed', 'payload must be an object');
		}

		const result = await executeCommand({
			command: params.command,
			actor: auth.actor,
			target: typeof body.target === 'string' ? body.target : null,
			expected_version:
				typeof body.expected_version === 'number' ? body.expected_version : undefined,
			idempotency_key: typeof body.idempotency_key === 'string' ? body.idempotency_key : undefined,
			payload: (body.payload as Record<string, unknown> | undefined) ?? {}
		});
		return json(result);
	} catch (error) {
		return work3ErrorResponse(error);
	}
};
