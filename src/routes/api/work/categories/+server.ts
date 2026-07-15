import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listWorkCategories, upsertWorkCategory, WorkError } from '$lib/server/work/index.js';

export const GET: RequestHandler = async () => {
	try {
		const categories = listWorkCategories();
		return json({
			categories: categories.filter((category) => category.kind === 'category'),
			subcategories: categories.filter((category) => category.kind === 'subcategory'),
			all: categories,
			sourceOfTruth: 'work'
		});
	} catch (err) {
		return handleWorkError(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const category = upsertWorkCategory({
			id: body.id,
			title: body.title,
			description: body.description,
			parent_category_id: body.parent_category_id,
			status: body.status,
			kind: body.kind
		});
		return json(category, { status: 201 });
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
