import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { generateDomainContext } from '$lib/server/pm/context.js';
import { handlePMError } from '$lib/server/pm/errors.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const context = generateDomainContext(params.id);
		return json(context);
	} catch (err) {
		return handlePMError(err);
	}
};
