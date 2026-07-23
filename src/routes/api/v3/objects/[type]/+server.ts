import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	getObjectReader,
	projectFields,
	validateReadOptions
} from '$lib/server/work3/read/registry.js';
import { parseReadOptions, requireAgentActor, work3ErrorResponse } from '$lib/server/work3/http.js';

/**
 * List/search reads: GET /api/v3/objects/[type]?view=&fields=&limit=&offset=
 * plus type-specific filters. Empty results are definitive (AXI): zero count,
 * empty collection, 200.
 */
export const GET: RequestHandler = async ({ request, params, url }) => {
	const auth = requireAgentActor(request);
	if ('response' in auth) return auth.response;

	try {
		const reader = getObjectReader(params.type);
		const options = parseReadOptions(url, 'list');
		validateReadOptions(reader, options);
		const { items, total } = reader.list(options);
		return json({
			ok: true,
			type: reader.type,
			total,
			count: items.length,
			items: items.map((item) => projectFields(item, options.fields))
		});
	} catch (error) {
		return work3ErrorResponse(error);
	}
};
