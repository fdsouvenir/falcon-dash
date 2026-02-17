import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { searchPM } from '$lib/server/pm/search.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = url.searchParams.get('q');
		if (!query) {
			throw new PMError(PM_ERRORS.PM_CONSTRAINT, 'q is a required query parameter');
		}

		const entityType = url.searchParams.get('entity_type') ?? undefined;
		const projectIdParam = url.searchParams.get('project_id');
		const projectId = projectIdParam ? parseInt(projectIdParam) : undefined;
		const limit = parseInt(url.searchParams.get('limit') ?? '20');
		const offset = parseInt(url.searchParams.get('offset') ?? '0');

		const results = searchPM(query, { entityType, projectId, limit, offset });
		return json({ results, query, limit, offset });
	} catch (err) {
		return handlePMError(err);
	}
};
