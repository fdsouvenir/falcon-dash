import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listPlanVersions } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { parseId } from '$lib/server/pm/validation.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const planId = parseId(params.id);
		const items = listPlanVersions(planId);
		return json({ items, total: items.length });
	} catch (err) {
		return handlePMError(err);
	}
};
