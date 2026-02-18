import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { generateDashboardContext } from '$lib/server/pm/context.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const GET: RequestHandler = async () => {
	try {
		const context = generateDashboardContext();
		return json(context);
	} catch (err) {
		return handlePMError(err);
	}
};

export const POST: RequestHandler = async () => {
	try {
		const result = triggerContextGeneration();
		return json(result);
	} catch (err) {
		return handlePMError(err);
	}
};
