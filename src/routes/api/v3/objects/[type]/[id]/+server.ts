import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { Work3Error } from '$lib/work3-shared/errors.js';
import {
	getObjectReader,
	projectFields,
	validateReadOptions
} from '$lib/server/work3/read/registry.js';
import { parseReadOptions, requireAgentActor, work3ErrorResponse } from '$lib/server/work3/http.js';

/** Detail read: GET /api/v3/objects/[type]/[id]?view=detail|full&fields=. */
export const GET: RequestHandler = async ({ request, params, url }) => {
	const auth = requireAgentActor(request);
	if ('response' in auth) return auth.response;

	try {
		const reader = getObjectReader(params.type);
		const options = parseReadOptions(url, 'detail');
		validateReadOptions(reader, options);
		const item = await reader.get(params.id, options);
		if (!item) {
			throw new Work3Error('not_found', `No such ${reader.type}: ${params.id}`, {
				details: { type: reader.type, id: params.id }
			});
		}
		return json({ ok: true, type: reader.type, item: projectFields(item, options.fields) });
	} catch (error) {
		return work3ErrorResponse(error);
	}
};
