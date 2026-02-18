import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { updateComment, deleteComment } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const body = await request.json();
		const comment = updateComment(id, body.body);
		if (!comment) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Comment ${id} not found`);
		emitPMEvent({ action: 'updated', entityType: 'comment', entityId: id, data: body });
		return json(comment);
	} catch (err) {
		return handlePMError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const deleted = deleteComment(id);
		if (!deleted) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Comment ${id} not found`);
		emitPMEvent({ action: 'deleted', entityType: 'comment', entityId: id });
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
