import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getSubcategory, updateSubcategory, deleteSubcategory } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const subcategory = getSubcategory(params.id);
		if (!subcategory) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Subcategory "${params.id}" not found`);
		return json(subcategory);
	} catch (err) {
		return handlePMError(err);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const subcategory = updateSubcategory(params.id, body);
		if (!subcategory) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Subcategory "${params.id}" not found`);
		emitPMEvent({ action: 'updated', entityType: 'subcategory', entityId: params.id, data: body });
		triggerContextGeneration();
		return json(subcategory);
	} catch (err) {
		return handlePMError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const deleted = deleteSubcategory(params.id);
		if (!deleted) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Subcategory "${params.id}" not found`);
		emitPMEvent({ action: 'deleted', entityType: 'subcategory', entityId: params.id });
		triggerContextGeneration();
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
