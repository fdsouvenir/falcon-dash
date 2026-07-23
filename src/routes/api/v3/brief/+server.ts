import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { computeBrief } from '$lib/server/work3/index.js';
import { requireAgentActor, work3ErrorResponse } from '$lib/server/work3/http.js';

/** Bounded session-start brief (doc 04) — consumed by the gateway plugin. */
export const GET: RequestHandler = async ({ request }) => {
	const auth = requireAgentActor(request);
	if ('response' in auth) return auth.response;
	try {
		return json({ ok: true, brief: await computeBrief() });
	} catch (error) {
		return work3ErrorResponse(error);
	}
};
