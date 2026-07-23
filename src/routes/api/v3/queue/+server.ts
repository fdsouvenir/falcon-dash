import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { computeQueue } from '$lib/server/work3/index.js';
import { requireAgentActor, work3ErrorResponse } from '$lib/server/work3/http.js';

/** Server-computed queue buckets (doc 04): totals + bounded compact rows. */
export const GET: RequestHandler = async ({ request }) => {
	const auth = requireAgentActor(request);
	if ('response' in auth) return auth.response;
	try {
		return json({ ok: true, queue: await computeQueue() });
	} catch (error) {
		return work3ErrorResponse(error);
	}
};
