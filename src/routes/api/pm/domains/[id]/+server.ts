import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDomain, updateDomain, deleteDomain } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const domain = getDomain(params.id);
		if (!domain) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Domain "${params.id}" not found`);
		return json(domain);
	} catch (err) {
		return handlePMError(err);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const domain = updateDomain(params.id, body);
		if (!domain) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Domain "${params.id}" not found`);
		emitPMEvent({
			action: 'updated',
			entityType: 'domain',
			entityId: params.id,
			data: body
		});
		return json(domain);
	} catch (err) {
		return handlePMError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteDomain(params.id);
		if (!deleted) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Domain "${params.id}" not found`);
		emitPMEvent({ action: 'deleted', entityType: 'domain', entityId: params.id });
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
