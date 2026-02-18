import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { moveTask } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const body = await request.json();
		const task = moveTask(id, body);
		if (!task) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Task ${id} not found`);
		emitPMEvent({
			action: 'moved',
			entityType: 'task',
			entityId: id,
			projectId: task.parent_project_id ?? null,
			data: body
		});
		return json(task);
	} catch (err) {
		return handlePMError(err);
	}
};
