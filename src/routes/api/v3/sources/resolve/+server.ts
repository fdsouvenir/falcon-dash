import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRefs } from '$lib/work3-shared/sources.js';
import { resolveWork3SourceRef } from '$lib/server/work3/index.js';
import { requireAgentActor, work3ErrorResponse } from '$lib/server/work3/http.js';

/**
 * POST /api/v3/sources/resolve { source_refs: [...] } → per-ref availability.
 * A missing native source reports unavailable with a reason — never silent.
 */
export const POST: RequestHandler = async ({ request }) => {
	const auth = requireAgentActor(request);
	if ('response' in auth) return auth.response;

	try {
		let body: Record<string, unknown>;
		try {
			body = (await request.json()) as Record<string, unknown>;
		} catch {
			throw new Work3Error('validation_failed', 'Request body must be JSON');
		}
		const refs = parseSourceRefs(body.source_refs, { required: true });
		const results = await Promise.all(
			refs.map(async (ref) => ({
				kind: ref.kind,
				ref: ref.ref,
				...(await resolveWork3SourceRef(ref))
			}))
		);
		return json({ ok: true, results });
	} catch (error) {
		return work3ErrorResponse(error);
	}
};
