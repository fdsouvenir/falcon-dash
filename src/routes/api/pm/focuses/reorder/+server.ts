import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { reorderFocuses } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { emitPMEvent } from '$lib/server/pm/events.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		reorderFocuses(body.ids);
		emitPMEvent({
			action: 'reordered',
			entityType: 'focus',
			entityId: 0,
			data: { ids: body.ids }
		});
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
