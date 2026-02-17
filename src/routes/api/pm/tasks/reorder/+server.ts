import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { reorderTasks } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		reorderTasks(body.ids);
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
