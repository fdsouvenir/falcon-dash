import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getPMStats } from '$lib/server/pm/stats.js';
import { handlePMError } from '$lib/server/pm/errors.js';

export const GET: RequestHandler = async () => {
	try {
		const stats = getPMStats();
		return json(stats);
	} catch (err) {
		return handlePMError(err);
	}
};
