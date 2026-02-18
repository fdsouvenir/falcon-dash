import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { bulkUpdate, bulkMove } from '$lib/server/pm/bulk.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const action = body.action as string;

		if (action === 'update') {
			const result = bulkUpdate({
				entityType: body.entityType,
				ids: body.ids,
				fields: body.fields
			});
			emitPMEvent({
				action: 'updated',
				entityType: body.entityType,
				entityId: 0,
				data: { ids: body.ids, fields: body.fields }
			});
			return json(result);
		}

		if (action === 'move') {
			const result = bulkMove({
				ids: body.ids,
				target: body.target
			});
			emitPMEvent({
				action: 'moved',
				entityType: 'task',
				entityId: 0,
				data: { ids: body.ids, target: body.target }
			});
			return json(result);
		}

		throw new PMError(PM_ERRORS.PM_CONSTRAINT, `Unknown bulk action: ${action}`);
	} catch (err) {
		return handlePMError(err);
	}
};
