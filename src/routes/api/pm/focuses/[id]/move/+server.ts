import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { moveFocus } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const focus = moveFocus(params.id, body.domain_id);
		if (!focus) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Focus "${params.id}" not found`);
		return json(focus);
	} catch (err) {
		return handlePMError(err);
	}
};
