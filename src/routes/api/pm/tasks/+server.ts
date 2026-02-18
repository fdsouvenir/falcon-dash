import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listTasks, createTask } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { emitPMEvent } from '$lib/server/pm/events.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const page = parseInt(url.searchParams.get('page') ?? '1');
		const limit = parseInt(url.searchParams.get('limit') ?? '50');
		const parentProjectIdParam = url.searchParams.get('parent_project_id');
		const parentTaskIdParam = url.searchParams.get('parent_task_id');
		const status = url.searchParams.get('status') ?? undefined;

		const filters: { parent_project_id?: number; parent_task_id?: number; status?: string } = {};
		if (parentProjectIdParam) filters.parent_project_id = parseInt(parentProjectIdParam);
		if (parentTaskIdParam) filters.parent_task_id = parseInt(parentTaskIdParam);
		if (status) filters.status = status;

		const items = listTasks(Object.keys(filters).length > 0 ? filters : undefined);
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
		const task = createTask(body);
		emitPMEvent({
			action: 'created',
			entityType: 'task',
			entityId: task.id,
			projectId: task.parent_project_id ?? null,
			data: body
		});
		return json(task, { status: 201 });
	} catch (err) {
		return handlePMError(err);
	}
};
