import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listBlocks, createBlock, deleteBlock } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const taskIdParam = url.searchParams.get('task_id');
		if (!taskIdParam) {
			throw new PMError(PM_ERRORS.PM_CONSTRAINT, 'task_id is a required query parameter');
		}
		const taskId = parseInt(taskIdParam);
		const blocks = listBlocks(taskId);
		return json(blocks);
	} catch (err) {
		return handlePMError(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const block = createBlock(body.blocker_id, body.blocked_id);
		return json(block, { status: 201 });
	} catch (err) {
		return handlePMError(err);
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const deleted = deleteBlock(body.blocker_id, body.blocked_id);
		if (!deleted) throw new PMError(PM_ERRORS.PM_NOT_FOUND, 'Block relationship not found');
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
