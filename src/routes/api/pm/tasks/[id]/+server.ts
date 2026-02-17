import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getTask, updateTask, deleteTask } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const task = getTask(id);
		if (!task) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Task ${id} not found`);
		return json(task);
	} catch (err) {
		return handlePMError(err);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const body = await request.json();
		const task = updateTask(id, body);
		if (!task) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Task ${id} not found`);
		return json(task);
	} catch (err) {
		return handlePMError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const deleted = deleteTask(id);
		if (!deleted) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Task ${id} not found`);
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
