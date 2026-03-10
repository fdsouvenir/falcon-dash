import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { moveSubcategory } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const subcategory = moveSubcategory(params.id, body.category_id);
		if (!subcategory) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Subcategory "${params.id}" not found`);
		emitPMEvent({
			action: 'moved',
			entityType: 'subcategory',
			entityId: params.id,
			data: { category_id: body.category_id }
		});
		return json(subcategory);
	} catch (err) {
		return handlePMError(err);
	}
};
