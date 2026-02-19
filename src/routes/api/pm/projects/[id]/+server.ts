import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getProject, updateProject, deleteProject } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const project = getProject(id);
		if (!project) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Project ${id} not found`);
		return json(project);
	} catch (err) {
		return handlePMError(err);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const body = await request.json();
		const project = updateProject(id, body);
		if (!project) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Project ${id} not found`);
		emitPMEvent({
			action: 'updated',
			entityType: 'project',
			entityId: id,
			projectId: id,
			data: body
		});
		triggerContextGeneration();
		return json(project);
	} catch (err) {
		return handlePMError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const deleted = deleteProject(id);
		if (!deleted) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Project ${id} not found`);
		emitPMEvent({ action: 'deleted', entityType: 'project', entityId: id, projectId: id });
		triggerContextGeneration();
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
