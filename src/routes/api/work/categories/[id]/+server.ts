import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getWorkCategory, upsertWorkCategory, WorkError } from '$lib/server/work/index.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const category = getWorkCategory(params.id);
		if (!category) throw new WorkError('WORK_NOT_FOUND', `Category ${params.id} not found`);
		return json(category);
	} catch (err) {
		return handleWorkError(err);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const current = getWorkCategory(params.id);
		if (!current) throw new WorkError('WORK_NOT_FOUND', `Category ${params.id} not found`);
		const body = await request.json();
		const category = upsertWorkCategory({
			id: params.id,
			title: body.title ?? current.title,
			description: body.description ?? current.description,
			parent_category_id: body.parent_category_id ?? current.parent_category_id,
			status: body.status ?? current.status,
			kind: body.kind ?? current.kind
		});
		return json(category);
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
