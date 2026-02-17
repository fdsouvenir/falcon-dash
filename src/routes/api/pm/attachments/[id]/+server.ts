import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { deleteAttachment } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const deleted = deleteAttachment(id);
		if (!deleted) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Attachment ${id} not found`);
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
