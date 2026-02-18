import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { moveFocus } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const focus = moveFocus(params.id, body.domain_id);
		if (!focus) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Focus "${params.id}" not found`);
		emitPMEvent({
			action: 'moved',
			entityType: 'focus',
			entityId: params.id,
			data: { domain_id: body.domain_id }
		});
		return json(focus);
	} catch (err) {
		return handlePMError(err);
	}
};
