import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listProjects, createProject } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { emitPMEvent } from '$lib/server/pm/events.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const page = parseInt(url.searchParams.get('page') ?? '1');
		const limit = parseInt(url.searchParams.get('limit') ?? '50');
		const categoryId = url.searchParams.get('category_id') ?? undefined;
		const subcategoryId = url.searchParams.get('subcategory_id') ?? undefined;
		const status = url.searchParams.get('status') ?? undefined;

		const filters: { category_id?: string; subcategory_id?: string; status?: string } = {};
		if (categoryId) filters.category_id = categoryId;
		if (subcategoryId) filters.subcategory_id = subcategoryId;
		if (status) filters.status = status;

		const items = listProjects(Object.keys(filters).length > 0 ? filters : undefined);
		const total = items.length;
		const start = (page - 1) * limit;
		const paged = items.slice(start, start + limit);
		return json({ items: paged, total, page, limit, hasMore: start + limit < total });
	} catch (err) {
		return handlePMError(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const project = createProject(body);
		emitPMEvent({
			action: 'created',
			entityType: 'project',
			entityId: project.id,
			projectId: project.id,
			data: body
		});
		triggerContextGeneration();
		return json(project, { status: 201 });
	} catch (err) {
		return handlePMError(err);
	}
};
