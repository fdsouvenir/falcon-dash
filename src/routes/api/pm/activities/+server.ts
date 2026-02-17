import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listActivities } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const page = parseInt(url.searchParams.get('page') ?? '1');
		const limit = parseInt(url.searchParams.get('limit') ?? '50');
		const projectIdParam = url.searchParams.get('project_id');

		if (!projectIdParam) {
			throw new PMError(PM_ERRORS.PM_CONSTRAINT, 'project_id is a required query parameter');
		}

		const projectId = parseInt(projectIdParam);
		const items = listActivities(projectId);
		const total = items.length;
		const start = (page - 1) * limit;
		const paged = items.slice(start, start + limit);
		return json({ items: paged, total, page, limit, hasMore: start + limit < total });
	} catch (err) {
		return handlePMError(err);
	}
};
