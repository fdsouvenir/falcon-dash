import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { reorderPlans } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { emitPMEvent } from '$lib/server/pm/events.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { ids } = body;

		if (!Array.isArray(ids)) {
			throw new Error('ids must be an array');
		}

		reorderPlans(ids);

		emitPMEvent({
			action: 'reordered',
			entityType: 'plan',
			entityId: ids[0] || 0, // Use first ID as reference
			data: { ids }
		});
		triggerContextGeneration();
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
