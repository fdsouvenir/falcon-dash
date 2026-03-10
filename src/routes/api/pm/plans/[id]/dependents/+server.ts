import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDependents } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { parseId } from '$lib/server/pm/validation.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseId(params.id);
		const items = getDependents(id);
		return json({ items });
	} catch (err) {
		return handlePMError(err);
	}
};
