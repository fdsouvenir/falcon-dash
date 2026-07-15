import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	deleteWorkBlockerLink,
	getWorkBlockerLink,
	updateWorkBlockerLink,
	WorkError
} from '$lib/server/work/index.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = Number(params.id);
		const blocker = getWorkBlockerLink(id);
		if (!blocker) throw new WorkError('WORK_NOT_FOUND', `Blocker link ${id} not found`);
		return json(blocker);
	} catch (err) {
		return handleWorkError(err);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const id = Number(params.id);
		const body = await request.json();
		const blocker = updateWorkBlockerLink(id, {
			...body,
			actor: body.actor ?? 'agent'
		});
		if (!blocker) throw new WorkError('WORK_NOT_FOUND', `Blocker link ${id} not found`);
		return json(blocker);
	} catch (err) {
		return handleWorkError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = Number(params.id);
		const blocker = deleteWorkBlockerLink(id);
		if (!blocker) throw new WorkError('WORK_NOT_FOUND', `Blocker link ${id} not found`);
		return json({ deleted: true, id });
	} catch (err) {
		return handleWorkError(err);
	}
};

function handleWorkError(err: unknown): Response {
	if (err instanceof WorkError) {
		const status = err.code === 'WORK_NOT_FOUND' ? 404 : err.code === 'WORK_DUPLICATE' ? 409 : 400;
		return json({ error: err.message, code: err.code }, { status });
	}
	const message = err instanceof Error ? err.message : 'Internal server error';
	return json({ error: message, code: 'WORK_INTERNAL' }, { status: 500 });
}
