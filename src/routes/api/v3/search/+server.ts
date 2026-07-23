import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { searchWork } from '$lib/server/work3/index.js';
import { requireAgentActor, work3ErrorResponse } from '$lib/server/work3/http.js';

/** FTS5 Browse search: GET /api/v3/search?q=&type=&limit=. */
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = requireAgentActor(request);
	if ('response' in auth) return auth.response;
	try {
		const query = url.searchParams.get('q');
		if (!query) throw new Work3Error('validation_failed', 'q is required');
		const limitParam = url.searchParams.get('limit');
		const results = searchWork(query, {
			type: url.searchParams.get('type') ?? undefined,
			limit: limitParam ? Number(limitParam) : undefined
		});
		return json({ ok: true, query, count: results.length, results });
	} catch (error) {
		return work3ErrorResponse(error);
	}
};
