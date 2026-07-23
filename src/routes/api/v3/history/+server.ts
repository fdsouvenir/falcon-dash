import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { listWork3Events } from '$lib/server/work3/index.js';
import { requireAgentActor, work3ErrorResponse } from '$lib/server/work3/http.js';

/** Event Log reads: GET /api/v3/history?subject=t42&event_type=&limit=&before=. */
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = requireAgentActor(request);
	if ('response' in auth) return auth.response;

	try {
		const limitParam = url.searchParams.get('limit');
		const limit = limitParam === null ? 50 : Number(limitParam);
		if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
			throw new Work3Error('validation_failed', 'limit must be an integer between 1 and 500');
		}
		const events = listWork3Events({
			subjectId: url.searchParams.get('subject') ?? undefined,
			eventType: url.searchParams.get('event_type') ?? undefined,
			before: url.searchParams.get('before') ?? undefined,
			limit
		});
		return json({ ok: true, count: events.length, events });
	} catch (error) {
		return work3ErrorResponse(error);
	}
};
